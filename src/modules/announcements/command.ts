import {
  ActionRowBuilder,
  ChannelType,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { customId } from '../../bot/customId.js';
import type { ComponentHandler, SlashCommand } from '../../bot/types.js';
import { UserFacingError } from '../../errors.js';
import { toDiscordEmbed } from '../../services/builder/discordGateway.js';
import { brandColor, requireStaff } from '../common.js';
import { requireModule } from '../shared.js';
import type { AnnouncementsRuntimeConfig } from './install.js';
import { announcementEmbed, cleanImageUrl } from './logic.js';

const data = new SlashCommandBuilder()
  .setName('announce')
  .setDescription('[Staff] Post a branded announcement')
  .setDMPermission(false)
  .addRoleOption((o) => o.setName('ping').setDescription('Role to ping (optional)'))
  .addChannelOption((o) =>
    o
      .setName('channel')
      .setDescription('Post somewhere other than the announcements channel')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
  );

export const announceCommand: SlashCommand = {
  data: data.toJSON(),
  scope: 'global',
  async execute(interaction, ctx) {
    if (!interaction.inCachedGuild()) return;
    const config = await requireModule<AnnouncementsRuntimeConfig>(
      ctx,
      interaction.guildId,
      'announcements',
    );
    requireStaff(interaction, config.staffRoleIds);
    const ping = interaction.options.getRole('ping');
    const channel = interaction.options.getChannel('channel');
    const modal = new ModalBuilder()
      .setCustomId(
        customId('announce', 'send', ping?.id ?? 'none', channel?.id ?? config.channelId),
      )
      .setTitle('New announcement')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Title')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(256)
            .setPlaceholder('New products just dropped!')
            .setRequired(true),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('message')
            .setLabel('Message')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(4000)
            .setRequired(true),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('image')
            .setLabel('Image link (optional)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('https://…/banner.png')
            .setRequired(false),
        ),
      );
    await interaction.showModal(modal);
  },
};

export const announceComponents: ComponentHandler = {
  area: 'announce',
  async handle(interaction, id, ctx) {
    if (!interaction.isModalSubmit() || id.action !== 'send' || !interaction.inCachedGuild())
      return;
    const config = await requireModule<AnnouncementsRuntimeConfig>(
      ctx,
      interaction.guildId,
      'announcements',
    );
    requireStaff(interaction, config.staffRoleIds);
    const [pingId, channelId] = id.args;
    const channel = await interaction.guild.channels
      .fetch(channelId ?? config.channelId)
      .catch(() => null);
    if (!channel?.isSendable()) throw new UserFacingError('I can’t post in that channel.');

    const embed = toDiscordEmbed(
      announcementEmbed({
        serverName: interaction.guild.name,
        title: interaction.fields.getTextInputValue('title'),
        message: interaction.fields.getTextInputValue('message'),
        image: cleanImageUrl(interaction.fields.getTextInputValue('image')),
        authorName: interaction.member.displayName,
        color: await brandColor(ctx, interaction.guildId),
      }),
    );
    const mention =
      pingId && pingId !== 'none'
        ? pingId === interaction.guildId
          ? '@everyone'
          : `<@&${pingId}>`
        : undefined;
    const sent = await channel.send({
      ...(mention ? { content: mention } : {}),
      embeds: [embed],
      allowedMentions:
        mention === '@everyone'
          ? { parse: ['everyone'] }
          : { roles: pingId && pingId !== 'none' ? [pingId] : [] },
    });
    await interaction.reply({
      content: `📢 Announcement posted: ${sent.url}`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
