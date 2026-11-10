import { AuditLogEvent, Events, type Guild } from 'discord.js';
import type { AppContext } from '../../bot/types.js';
import { toDiscordEmbed } from '../../services/builder/discordGateway.js';
import type { EmbedPayload } from '../../services/builder/gateway.js';
import type { ModuleRuntime } from '../runtimeTypes.js';
import type { LoggingRuntimeConfig } from './install.js';
import {
  banEmbed,
  memberJoinEmbed,
  memberLeaveEmbed,
  messageDeleteEmbed,
  messageEditEmbed,
  roleChangeEmbed,
  timeoutEmbed,
} from './logic.js';

/**
 * Post an embed to the guild's mod-log or join/leave log, if the logging module is enabled.
 * Other modules (verification, tickets) use this too. Never throws.
 */
export async function logEvent(
  ctx: AppContext,
  guild: Guild,
  target: 'mod' | 'joinLeave',
  embed: EmbedPayload,
): Promise<void> {
  try {
    const config = await ctx.moduleConfig.get<LoggingRuntimeConfig>(guild.id, 'logging');
    const channelId = target === 'mod' ? config?.modLogId : config?.joinLeaveId;
    if (!channelId) return;
    const channel = guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId));
    if (channel?.isSendable()) {
      await channel.send({ embeds: [toDiscordEmbed(embed)], allowedMentions: { parse: [] } });
    }
  } catch (error) {
    ctx.logger.debug({ err: error, guildId: guild.id }, 'log event failed');
  }
}

function safe(ctx: AppContext, label: string, fn: () => Promise<void>): void {
  fn().catch((error: unknown) => ctx.logger.warn({ err: error, label }, 'logging handler failed'));
}

export const loggingRuntime: ModuleRuntime = {
  id: 'logging',
  register(client, ctx) {
    client.on(Events.GuildMemberAdd, (member) =>
      safe(ctx, 'join', () =>
        logEvent(
          ctx,
          member.guild,
          'joinLeave',
          memberJoinEmbed({
            id: member.id,
            tag: member.user.tag,
            createdAt: member.user.createdAt,
            memberCount: member.guild.memberCount,
            avatarUrl: member.user.displayAvatarURL(),
          }),
        ),
      ),
    );

    client.on(Events.GuildMemberRemove, (member) =>
      safe(ctx, 'leave', () =>
        logEvent(
          ctx,
          member.guild,
          'joinLeave',
          memberLeaveEmbed({
            id: member.id,
            tag: member.user.tag,
            joinedAt: member.joinedAt,
            roles: member.roles.cache.filter((r) => r.id !== member.guild.id).map((r) => r.id),
          }),
        ),
      ),
    );

    client.on(Events.MessageDelete, (message) =>
      safe(ctx, 'delete', async () => {
        if (!message.guild || message.author?.bot) return;
        await logEvent(
          ctx,
          message.guild,
          'mod',
          messageDeleteEmbed({
            authorId: message.author?.id ?? null,
            authorTag: message.author?.tag ?? null,
            channelId: message.channelId,
            content: message.content,
            attachments: [...message.attachments.values()].map((a) => a.url),
          }),
        );
      }),
    );

    client.on(Events.MessageUpdate, (before, after) =>
      safe(ctx, 'edit', async () => {
        if (!after.guild || after.author?.bot || !after.author) return;
        const embed = messageEditEmbed({
          authorId: after.author.id,
          authorTag: after.author.tag,
          channelId: after.channelId,
          url: after.url,
          before: before.partial ? null : before.content,
          after: after.content ?? '',
        });
        if (embed) await logEvent(ctx, after.guild, 'mod', embed);
      }),
    );

    client.on(Events.GuildBanAdd, (ban) =>
      safe(ctx, 'ban', async () => {
        let reason = ban.reason ?? null;
        if (!reason) {
          const logs = await ban.guild
            .fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 })
            .catch(() => null);
          const entry = logs?.entries.first();
          if (entry?.targetId === ban.user.id) reason = entry.reason ?? null;
        }
        await logEvent(
          ctx,
          ban.guild,
          'mod',
          banEmbed({ id: ban.user.id, tag: ban.user.tag, reason, banned: true }),
        );
      }),
    );

    client.on(Events.GuildBanRemove, (ban) =>
      safe(ctx, 'unban', () =>
        logEvent(
          ctx,
          ban.guild,
          'mod',
          banEmbed({ id: ban.user.id, tag: ban.user.tag, reason: null, banned: false }),
        ),
      ),
    );

    client.on(Events.GuildMemberUpdate, (before, after) =>
      safe(ctx, 'member update', async () => {
        if (before.partial) return;
        const beforeUntil = before.communicationDisabledUntilTimestamp ?? null;
        const afterUntil = after.communicationDisabledUntilTimestamp ?? null;
        if (beforeUntil !== afterUntil) {
          await logEvent(
            ctx,
            after.guild,
            'mod',
            timeoutEmbed({
              id: after.id,
              tag: after.user.tag,
              until: afterUntil && afterUntil > Date.now() ? new Date(afterUntil) : null,
            }),
          );
        }
        const added = after.roles.cache
          .filter((r) => !before.roles.cache.has(r.id))
          .map((r) => r.id);
        const removed = before.roles.cache
          .filter((r) => !after.roles.cache.has(r.id))
          .map((r) => r.id);
        const embed = roleChangeEmbed({ id: after.id, tag: after.user.tag, added, removed });
        if (embed) await logEvent(ctx, after.guild, 'mod', embed);
      }),
    );
  },
};
