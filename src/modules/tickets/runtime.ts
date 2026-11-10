import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  OverwriteType,
  PermissionFlagsBits,
  type Collection,
  type GuildTextBasedChannel,
  type Message,
} from 'discord.js';
import type { AppContext } from '../../bot/types.js';
import { UserFacingError } from '../../errors.js';
import { logEvent } from '../logging/runtime.js';
import type { ModuleRuntime } from '../runtimeTypes.js';
import { requireModule } from '../shared.js';
import { TICKET_CLOSE, TICKET_CONFIRM_CLOSE, type TicketsRuntimeConfig } from './install.js';
import {
  canCloseTicket,
  renderTranscript,
  renderWelcome,
  ticketChannelName,
  type TranscriptMessage,
} from './logic.js';

const USER_ALLOW =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.ReadMessageHistory |
  PermissionFlagsBits.AttachFiles |
  PermissionFlagsBits.EmbedLinks;

async function fetchTranscriptMessages(
  channel: GuildTextBasedChannel,
  limit: number,
): Promise<TranscriptMessage[]> {
  const out: TranscriptMessage[] = [];
  let before: string | undefined;
  while (out.length < limit) {
    const batch: Collection<string, Message> = await channel.messages.fetch({
      limit: Math.min(100, limit - out.length),
      ...(before ? { before } : {}),
    });
    if (batch.size === 0) break;
    for (const m of batch.values()) {
      out.push({
        authorTag: m.author.tag,
        authorId: m.author.id,
        bot: m.author.bot,
        createdAt: m.createdAt,
        content: m.content,
        attachments: [...m.attachments.values()].map((a) => a.url),
        embeds: m.embeds.length,
      });
    }
    before = batch.lastKey();
  }
  return out;
}

async function closeTicket(
  interaction: Parameters<NonNullable<ModuleRuntime['components']>[number]['handle']>[0],
  ctx: AppContext,
): Promise<void> {
  if (!interaction.inCachedGuild() || !interaction.channel) return;
  const config = await requireModule<TicketsRuntimeConfig>(ctx, interaction.guildId, 'tickets');
  const ticket = await ctx.db.tickets.findByChannel(interaction.channelId ?? '');
  if (!ticket || ticket.status !== 'open')
    throw new UserFacingError('This channel is not an open ticket.');
  const member = interaction.member;
  const allowed = canCloseTicket({
    userId: member.id,
    openerId: ticket.openerId,
    memberRoleIds: new Set(member.roles.cache.keys()),
    staffRoleIds: config.staffRoleIds,
    canManageChannels: member.permissions.has(PermissionFlagsBits.ManageChannels),
  });
  if (!allowed) throw new UserFacingError('Only the ticket opener or staff can close this ticket.');

  await interaction.deferReply();
  const channel = interaction.channel;
  const messages = await fetchTranscriptMessages(channel, config.transcriptLimit);
  const opener = await ctx.client.users.fetch(ticket.openerId).catch(() => null);
  const closedAt = new Date();
  const transcript = renderTranscript(
    {
      guildName: interaction.guild.name,
      channelName: 'name' in channel ? channel.name : ticketChannelName(ticket.number),
      ticketNumber: ticket.number,
      openerTag: opener?.tag ?? ticket.openerId,
      openedAt: ticket.createdAt,
      closedByTag: member.user.tag,
      closedAt,
    },
    messages,
  );
  const fileName = `${ticketChannelName(ticket.number)}-transcript.txt`;
  const summary = new EmbedBuilder()
    .setColor(0x95a5a6)
    .setTitle(`🎫 Ticket #${ticket.number} closed`)
    .addFields(
      { name: 'Opened by', value: `<@${ticket.openerId}>`, inline: true },
      { name: 'Closed by', value: `<@${member.id}>`, inline: true },
      { name: 'Messages', value: String(messages.length), inline: true },
    )
    .setTimestamp(closedAt);

  const logChannel = await interaction.guild.channels.fetch(config.logChannelId).catch(() => null);
  if (logChannel?.isSendable()) {
    await logChannel.send({
      embeds: [summary],
      files: [new AttachmentBuilder(Buffer.from(transcript, 'utf8'), { name: fileName })],
      allowedMentions: { parse: [] },
    });
  } else {
    ctx.logger.warn(
      { guildId: interaction.guildId },
      'ticket log channel missing; transcript only sent to opener',
    );
  }
  // Courtesy copy for the opener (ignored if their DMs are closed).
  await opener
    ?.send({
      content: `Your ticket in **${interaction.guild.name}** was closed. Here's a copy of the conversation.`,
      files: [new AttachmentBuilder(Buffer.from(transcript, 'utf8'), { name: fileName })],
    })
    .catch(() => undefined);

  await ctx.db.tickets.close(ticket.id, member.id, closedAt);
  await interaction.editReply({
    content: '🔒 Ticket closed. Transcript saved. This channel will be deleted in 5 seconds.',
  });
  setTimeout(() => {
    channel
      .delete('ServerForge: ticket closed')
      .catch((error: unknown) =>
        ctx.logger.warn({ err: error }, 'could not delete ticket channel'),
      );
  }, 5000);
}

export const ticketsRuntime: ModuleRuntime = {
  id: 'tickets',
  components: [
    {
      area: 'ticket',
      async handle(interaction, id, ctx) {
        if (!interaction.isButton() || !interaction.inCachedGuild()) return;
        const guild = interaction.guild;

        if (id.action === 'open') {
          const config = await requireModule<TicketsRuntimeConfig>(ctx, guild.id, 'tickets');
          const open = await ctx.db.tickets.countOpenByUser(guild.id, interaction.user.id);
          if (open >= config.maxOpenPerUser) {
            throw new UserFacingError(
              `You already have ${open} open ticket${open === 1 ? '' : 's'}. Please use your existing ticket.`,
              { title: 'Ticket already open' },
            );
          }
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          const number = await ctx.db.tickets.nextNumber(guild.id);
          const me = guild.members.me ?? (await guild.members.fetchMe());
          const channel = await guild.channels.create({
            name: ticketChannelName(number),
            type: ChannelType.GuildText,
            parent: config.categoryId,
            topic: `Ticket #${number} opened by ${interaction.user.tag} (${interaction.user.id})`,
            reason: 'ServerForge ticket',
            permissionOverwrites: [
              { id: guild.id, type: OverwriteType.Role, deny: PermissionFlagsBits.ViewChannel },
              { id: interaction.user.id, type: OverwriteType.Member, allow: USER_ALLOW },
              {
                id: me.id,
                type: OverwriteType.Member,
                allow: USER_ALLOW | PermissionFlagsBits.ManageChannels,
              },
              ...config.staffRoleIds.map((roleId) => ({
                id: roleId,
                type: OverwriteType.Role,
                allow: USER_ALLOW | PermissionFlagsBits.ManageMessages,
              })),
            ],
          });
          await ctx.db.tickets.create({
            guildId: guild.id,
            channelId: channel.id,
            openerId: interaction.user.id,
            number,
          });
          const staffMentions = config.staffRoleIds.map((r) => `<@&${r}>`).join(' ');
          await channel.send({
            content: `${renderWelcome(config.welcomeMessage, interaction.user.id)}\n\n${staffMentions}`,
            components: [
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                  .setCustomId(TICKET_CLOSE)
                  .setLabel('Close ticket')
                  .setEmoji('🔒')
                  .setStyle(ButtonStyle.Danger),
              ),
            ],
            allowedMentions: { users: [interaction.user.id], roles: config.staffRoleIds },
          });
          await interaction.editReply({ content: `🎫 Your ticket is open: ${channel.toString()}` });
          await logEvent(ctx, guild, 'mod', {
            title: '🎫 Ticket opened',
            description: `#${number} by ${interaction.user.toString()} — ${channel.toString()}`,
            color: 0x3498db,
            timestamp: true,
          });
          return;
        }

        if (id.action === 'close') {
          const ticket = await ctx.db.tickets.findByChannel(interaction.channelId);
          if (!ticket || ticket.status !== 'open')
            throw new UserFacingError('This channel is not an open ticket.');
          await interaction.reply({
            content: 'Are you sure you want to close this ticket? A transcript will be saved.',
            components: [
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                  .setCustomId(TICKET_CONFIRM_CLOSE)
                  .setLabel('Yes, close it')
                  .setStyle(ButtonStyle.Danger),
              ),
            ],
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (id.action === 'confirm') {
          await closeTicket(interaction, ctx);
        }
      },
    },
  ],
};
