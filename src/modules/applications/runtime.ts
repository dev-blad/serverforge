import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { customId } from '../../bot/customId.js';
import { UserFacingError } from '../../errors.js';
import { toDiscordEmbed } from '../../services/builder/discordGateway.js';
import { requireStaff } from '../common.js';
import type { ModuleRuntime } from '../runtimeTypes.js';
import { requireModule } from '../shared.js';
import type { ApplicationsRuntimeConfig } from './install.js';
import { applicantResultMessage, applicationReviewEmbed, type ApplicationData } from './logic.js';

function reviewButtons(number: number) {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(customId('apply', 'review', String(number), 'accepted'))
        .setLabel('Accept')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(customId('apply', 'review', String(number), 'denied'))
        .setLabel('Deny')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger),
    ),
  ];
}

export const applicationsRuntime: ModuleRuntime = {
  id: 'applications',
  components: [
    {
      area: 'apply',
      async handle(interaction, id, ctx) {
        if (!interaction.inCachedGuild()) return;
        const config = await requireModule<ApplicationsRuntimeConfig>(
          ctx,
          interaction.guildId,
          'applications',
        );

        if (interaction.isButton() && id.action === 'open') {
          const pending = await ctx.db.records.count(interaction.guildId, 'application', {
            userId: interaction.user.id,
            status: 'pending',
          });
          if (pending)
            throw new UserFacingError('You already have an application waiting for review.');
          const modal = new ModalBuilder()
            .setCustomId(customId('apply', 'submit'))
            .setTitle(config.title);
          for (const q of config.questions) {
            const input = new TextInputBuilder()
              .setCustomId(q.key)
              .setLabel(q.label)
              .setStyle(q.style === 'short' ? TextInputStyle.Short : TextInputStyle.Paragraph)
              .setRequired(q.required)
              .setMaxLength(q.style === 'short' ? 200 : 1000);
            if (q.placeholder) input.setPlaceholder(q.placeholder);
            modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
          }
          await interaction.showModal(modal);
          return;
        }

        if (interaction.isModalSubmit() && id.action === 'submit') {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          const data: ApplicationData = {
            answers: config.questions.map((q) => ({
              question: q.label,
              answer: interaction.fields.getTextInputValue(q.key),
            })),
            reviewMessageId: null,
            reviewedBy: null,
            reason: null,
          };
          const record = await ctx.db.records.create({
            guildId: interaction.guildId,
            kind: 'application',
            userId: interaction.user.id,
            status: 'pending',
            data,
          });
          const review = await interaction.guild.channels
            .fetch(config.reviewChannelId)
            .catch(() => null);
          if (review?.isSendable()) {
            const sent = await review.send({
              embeds: [
                toDiscordEmbed(
                  applicationReviewEmbed({
                    number: record.number,
                    applicantId: interaction.user.id,
                    applicantName: interaction.member.displayName,
                    data,
                    status: 'pending',
                    createdAt: record.createdAt,
                  }),
                ),
              ],
              components: reviewButtons(record.number),
              allowedMentions: { parse: [] },
            });
            await ctx.db.records.update(record.id, { data: { ...data, reviewMessageId: sent.id } });
          }
          await interaction.editReply(
            '📝 Thanks — your application has been sent to the team. We’ll let you know the outcome by DM.',
          );
          return;
        }

        if (interaction.isButton() && id.action === 'review') {
          requireStaff(interaction, config.staffRoleIds);
          const [numberArg, decision] = id.args;
          if (decision !== 'accepted' && decision !== 'denied') return;
          const record = await ctx.db.records.findByNumber<ApplicationData>(
            interaction.guildId,
            'application',
            Number(numberArg),
          );
          if (!record) throw new UserFacingError('That application no longer exists.');
          if (record.status !== 'pending')
            throw new UserFacingError(`That application was already ${record.status}.`);
          const data: ApplicationData = { ...record.data, reviewedBy: interaction.user.id };
          const updated = await ctx.db.records.update<ApplicationData>(record.id, {
            status: decision,
            data,
          });
          const applicant = await interaction.guild.members
            .fetch(record.userId ?? '')
            .catch(() => null);
          await interaction.update({
            embeds: [
              toDiscordEmbed(
                applicationReviewEmbed({
                  number: updated.number,
                  applicantId: updated.userId ?? '',
                  applicantName: applicant?.displayName ?? 'Applicant',
                  data,
                  status: decision,
                  createdAt: updated.createdAt,
                }),
              ),
            ],
            components: [],
          });
          if (decision === 'accepted' && config.acceptRoleId && applicant) {
            await applicant.roles
              .add(config.acceptRoleId, 'ServerForge: application accepted')
              .catch(() => undefined);
          }
          await applicant
            ?.send(applicantResultMessage(decision, interaction.guild.name))
            .catch(() => undefined);
        }
      },
    },
  ],
};
