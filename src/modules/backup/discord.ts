import {
  ChannelType,
  OverwriteType,
  PermissionsBitField,
  type Guild,
  type GuildBasedChannel,
  type NonThreadGuildBasedChannel,
} from 'discord.js';
import type {
  CurrentServer,
  RestorePlan,
  ServerSnapshot,
  SnapshotChannelType,
  SnapshotOverwrite,
} from './logic.js';

const TYPES: Partial<Record<ChannelType, SnapshotChannelType>> = {
  [ChannelType.GuildText]: 'text',
  [ChannelType.GuildVoice]: 'voice',
  [ChannelType.GuildAnnouncement]: 'announcement',
  [ChannelType.GuildForum]: 'forum',
  [ChannelType.GuildStageVoice]: 'stage',
};
const DISCORD_TYPES: Record<SnapshotChannelType, ChannelType> = {
  text: ChannelType.GuildText,
  voice: ChannelType.GuildVoice,
  announcement: ChannelType.GuildAnnouncement,
  forum: ChannelType.GuildForum,
  stage: ChannelType.GuildStageVoice,
};

function overwritesOf(guild: Guild, channel: GuildBasedChannel): SnapshotOverwrite[] {
  if (channel.isThread()) return [];
  return [...channel.permissionOverwrites.cache.values()]
    .filter((o) => o.type === OverwriteType.Role)
    .map((o) => {
      const role = guild.roles.cache.get(o.id);
      if (!role) return null;
      return {
        role: role.id === guild.id ? '@everyone' : role.name,
        allow: o.allow.bitfield.toString(),
        deny: o.deny.bitfield.toString(),
      };
    })
    .filter((o): o is SnapshotOverwrite => o !== null);
}

export async function takeSnapshot(guild: Guild, takenBy: string): Promise<ServerSnapshot> {
  await guild.roles.fetch();
  const channels = await guild.channels.fetch();
  const all = [...channels.values()].filter((c): c is NonThreadGuildBasedChannel => !!c);
  return {
    takenAt: new Date().toISOString(),
    takenBy,
    serverName: guild.name,
    roles: [...guild.roles.cache.values()]
      .filter((r) => r.id !== guild.id && !r.managed)
      .sort((a, b) => b.position - a.position)
      .map((r) => ({
        name: r.name,
        color: r.color,
        hoist: r.hoist,
        mentionable: r.mentionable,
        permissions: r.permissions.bitfield.toString(),
        position: r.position,
      })),
    categories: all
      .filter((c) => c.type === ChannelType.GuildCategory)
      .sort((a, b) => ('position' in a ? a.position : 0) - ('position' in b ? b.position : 0))
      .map((c) => ({
        name: c.name,
        position: 'position' in c ? c.position : 0,
        overwrites: overwritesOf(guild, c),
      })),
    channels: all
      .filter((c) => TYPES[c.type] !== undefined)
      .map((c) => ({
        name: c.name,
        type: TYPES[c.type]!,
        topic: 'topic' in c && typeof c.topic === 'string' ? c.topic : null,
        nsfw: 'nsfw' in c ? !!c.nsfw : false,
        slowmode: 'rateLimitPerUser' in c ? (c.rateLimitPerUser ?? 0) : 0,
        userLimit: 'userLimit' in c ? (c.userLimit ?? 0) : 0,
        parent: c.parent?.name ?? null,
        position: 'position' in c ? c.position : 0,
        overwrites: overwritesOf(guild, c),
      })),
  };
}

export async function currentServer(guild: Guild): Promise<CurrentServer> {
  await guild.roles.fetch();
  const channels = [...(await guild.channels.fetch()).values()].filter(
    (c): c is NonThreadGuildBasedChannel => !!c,
  );
  return {
    roles: [...guild.roles.cache.values()].map((r) => r.name),
    categories: channels.filter((c) => c.type === ChannelType.GuildCategory).map((c) => c.name),
    channels: channels
      .filter((c) => TYPES[c.type] !== undefined)
      .map((c) => ({ name: c.name, type: TYPES[c.type]!, parent: c.parent?.name ?? null })),
  };
}

/** Re-create everything in the plan. Returns warnings for anything that couldn't be made. */
export async function applyRestore(guild: Guild, plan: RestorePlan): Promise<string[]> {
  const warnings: string[] = [];
  const reason = 'ServerForge backup restore';

  for (const role of plan.roles) {
    await guild.roles
      .create({
        name: role.name,
        color: role.color,
        hoist: role.hoist,
        mentionable: role.mentionable,
        permissions: new PermissionsBitField(BigInt(role.permissions)),
        reason,
      })
      .catch((e: Error) => warnings.push(`Role "${role.name}": ${e.message}`));
  }
  await guild.roles.fetch();
  const roleId = (name: string) =>
    name === '@everyone' ? guild.id : guild.roles.cache.find((r) => r.name === name)?.id;
  const overwrites = (list: SnapshotOverwrite[]) =>
    list
      .map((o) => {
        const id = roleId(o.role);
        return id
          ? { id, type: OverwriteType.Role, allow: BigInt(o.allow), deny: BigInt(o.deny) }
          : null;
      })
      .filter((o): o is NonNullable<typeof o> => o !== null);

  for (const category of plan.categories) {
    await guild.channels
      .create({
        name: category.name,
        type: ChannelType.GuildCategory,
        permissionOverwrites: overwrites(category.overwrites),
        reason,
      })
      .catch((e: Error) => warnings.push(`Category "${category.name}": ${e.message}`));
  }
  const channels = await guild.channels.fetch();
  const categoryId = (name: string | null) =>
    name
      ? channels.find((c) => c?.type === ChannelType.GuildCategory && c.name === name)?.id
      : undefined;

  for (const channel of plan.channels) {
    const parent = categoryId(channel.parent);
    await guild.channels
      .create({
        name: channel.name,
        type: DISCORD_TYPES[channel.type] as ChannelType.GuildText,
        ...(parent ? { parent } : {}),
        ...(channel.topic ? { topic: channel.topic } : {}),
        nsfw: channel.nsfw,
        ...(channel.slowmode ? { rateLimitPerUser: channel.slowmode } : {}),
        permissionOverwrites: overwrites(channel.overwrites),
        reason,
      })
      .catch((e: Error) => warnings.push(`Channel "${channel.name}": ${e.message}`));
  }
  return warnings;
}
