import type { Guild } from 'discord.js';
import type { Logger } from '../logger.js';
import { DiscordGuildGateway, snapshotGuild } from '../services/builder/discordGateway.js';
import type { GuildContext } from '../services/setup/setupService.js';

export async function guildContext(guild: Guild, logger: Logger): Promise<GuildContext> {
  const owner = await guild.fetchOwner().catch(() => null);
  return {
    id: guild.id,
    name: guild.name,
    ownerId: guild.ownerId,
    ownerName: owner?.displayName ?? owner?.user.username ?? 'the owner',
    gateway: new DiscordGuildGateway(guild, logger),
    snapshot: (tracked) => snapshotGuild(guild, tracked),
  };
}
