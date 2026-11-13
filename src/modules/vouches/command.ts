import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../bot/types.js';
import { UserFacingError } from '../../errors.js';
import { toDiscordEmbed } from '../../services/builder/discordGateway.js';
import { brandColor, requireStaff } from '../common.js';
import { requireModule } from '../shared.js';
import type { VouchesRuntimeConfig } from './install.js';
import { statsEmbed, type VouchData } from './logic.js';
import { currentStats, submitVouch } from './service.js';

const data = new SlashCommandBuilder()
  .setName('vouch')
  .setDescription('Vouches and reviews')
  .setDMPermission(false)
  .addSubcommand((s) =>
    s
      .setName('submit')
      .setDescription('Leave a star rating and review')
      .addIntegerOption((o) =>
        o
          .setName('rating')
          .setDescription('How many stars?')
          .setRequired(true)
          .addChoices(
            { name: '⭐⭐⭐⭐⭐ 5 — Excellent', value: 5 },
            { name: '⭐⭐⭐⭐ 4 — Great', value: 4 },
            { name: '⭐⭐⭐ 3 — Good', value: 3 },
            { name: '⭐⭐ 2 — Poor', value: 2 },
            { name: '⭐ 1 — Bad', value: 1 },
          ),
      )
      .addStringOption((o) =>
        o
          .setName('review')
          .setDescription('Your review')
          .setRequired(true)
          .setMinLength(5)
          .setMaxLength(1000),
      )
      .addUserOption((o) => o.setName('staff').setDescription('Who helped you? (optional)')),
  )
  .addSubcommand((s) =>
    s.setName('stats').setDescription('Show the average rating and latest vouches'),
  )
  .addSubcommand((s) =>
    s
      .setName('remove')
      .setDescription('[Staff] Remove a vouch')
      .addIntegerOption((o) =>
        o.setName('number').setDescription('Vouch number').setRequired(true).setMinValue(1),
      ),
  );

export const vouchCommand: SlashCommand = {
  data: data.toJSON(),
  scope: 'global',
  async execute(interaction, ctx) {
    if (!interaction.inCachedGuild()) return;
    const config = await requireModule<VouchesRuntimeConfig>(ctx, interaction.guildId, 'vouches');
    const sub = interaction.options.getSubcommand();

    if (sub === 'submit') {
      const staff = interaction.options.getUser('staff');
      if (staff?.id === interaction.user.id)
        throw new UserFacingError('You can’t vouch for yourself.');
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const result = await submitVouch(ctx, interaction.guild, interaction.user, config, {
        rating: interaction.options.getInteger('rating', true),
        review: interaction.options.getString('review', true),
        staffId: staff && !staff.bot ? staff.id : null,
      });
      await interaction.editReply(
        `⭐ Thanks! Your vouch (#${result.number}) has been posted in <#${result.channelId}>.`,
      );
      return;
    }

    if (sub === 'stats') {
      const stats = await currentStats(ctx, interaction.guildId);
      const recent = await ctx.db.records.list<VouchData>(interaction.guildId, 'vouch', {
        limit: 5,
      });
      const embed = toDiscordEmbed(
        statsEmbed({
          serverName: interaction.guild.name,
          stats,
          recent: recent.map((v) => ({
            number: v.number,
            rating: v.data.rating,
            customerId: v.userId ?? '',
          })),
        }),
      ).setColor(await brandColor(ctx, interaction.guildId));
      await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
      return;
    }

    // remove
    requireStaff(interaction, config.staffRoleIds);
    const number = interaction.options.getInteger('number', true);
    const record = await ctx.db.records.findByNumber<VouchData>(
      interaction.guildId,
      'vouch',
      number,
    );
    if (!record) throw new UserFacingError(`There’s no vouch #${number}.`);
    if (record.data.channelId && record.data.messageId) {
      const channel = await interaction.guild.channels
        .fetch(record.data.channelId)
        .catch(() => null);
      if (channel?.isTextBased())
        await channel.messages.delete(record.data.messageId).catch(() => undefined);
    }
    await ctx.db.records.delete(record.id);
    await interaction.reply({
      content: `🗑️ Vouch #${number} removed.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
