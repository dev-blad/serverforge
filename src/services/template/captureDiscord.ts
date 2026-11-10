import { ChannelType, OverwriteType, type Guild } from 'discord.js';
import { channelTypeToKind } from '../builder/discordGateway.js';
import type { CaptureSource } from './capture.js';

/** Read everything /forge capture needs from a live guild. */
export async function captureSourceFromGuild(guild: Guild): Promise<CaptureSource> {
  await Promise.all([guild.roles.fetch(), guild.channels.fetch()]);
  return {
    guildId: guild.id,
    guildName: guild.name,
    everyonePermissions: guild.roles.everyone.permissions.bitfield.toString(),
    features: [...guild.features],
    rulesChannelId: guild.rulesChannelId,
    publicUpdatesChannelId: guild.publicUpdatesChannelId,
    roles: [...guild.roles.cache.values()].map((r) => ({
      id: r.id,
      name: r.name,
      color: r.colors.primaryColor,
      hoist: r.hoist,
      mentionable: r.mentionable,
      permissions: r.permissions.bitfield.toString(),
      position: r.position,
      managed: r.managed,
    })),
    channels: [...guild.channels.cache.values()]
      .filter((c) => !c.isThread())
      .map((c) => ({
        id: c.id,
        name: c.name,
        type: channelTypeToKind(c.type),
        parentId: c.parentId,
        position: 'rawPosition' in c ? c.rawPosition : 0,
        topic: 'topic' in c ? (c.topic ?? null) : null,
        slowmode: 'rateLimitPerUser' in c ? (c.rateLimitPerUser ?? 0) : 0,
        nsfw: 'nsfw' in c ? c.nsfw : false,
        userLimit: 'userLimit' in c ? c.userLimit : null,
        bitrate: 'bitrate' in c ? c.bitrate : null,
        tags:
          c.type === ChannelType.GuildForum
            ? c.availableTags.map((t) => ({
                name: t.name,
                emoji: t.emoji?.name ?? null,
                moderated: t.moderated,
              }))
            : [],
        overwrites:
          'permissionOverwrites' in c
            ? [...c.permissionOverwrites.cache.values()].map((o) => ({
                id: o.id,
                type: o.type === OverwriteType.Role ? ('role' as const) : ('member' as const),
                allow: o.allow.bitfield.toString(),
                deny: o.deny.bitfield.toString(),
              }))
            : [],
      })),
  };
}
