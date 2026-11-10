import { Events } from 'discord.js';
import type { AppContext } from '../../bot/types.js';
import { DiscordGuildGateway } from '../../services/builder/discordGateway.js';
import type { ModuleRuntime } from '../runtimeTypes.js';
import type { MemberStatsRuntimeConfig } from './install.js';
import { StatsThrottle, formatStatsName } from './logic.js';

async function updateCount(ctx: AppContext, guildId: string): Promise<void> {
  const config = await ctx.moduleConfig.get<MemberStatsRuntimeConfig>(guildId, 'memberStats');
  if (!config) return;
  const guild = await ctx.client.guilds.fetch(guildId);
  const gateway = new DiscordGuildGateway(guild, ctx.logger);
  const count = await gateway.memberCount(config.includeBots);
  const name = formatStatsName(config.format, count);
  const channel = guild.channels.cache.get(config.channelId);
  if (channel && channel.name === name) return;
  await gateway.renameChannel(config.channelId, name);
}

export const memberStatsRuntime: ModuleRuntime = {
  id: 'memberStats',
  register(client, ctx) {
    const throttle = new StatsThrottle((guildId) =>
      updateCount(ctx, guildId).catch((error: unknown) =>
        ctx.logger.warn({ err: error, guildId }, 'member count update failed'),
      ),
    );
    client.on(Events.GuildMemberAdd, (m) => void throttle.request(m.guild.id));
    client.on(Events.GuildMemberRemove, (m) => void throttle.request(m.guild.id));
    // Catch up on anything that changed while the bot was offline.
    client.once(Events.ClientReady, () => {
      void ctx.db.modules
        .listEnabled('memberStats')
        .then((records) => records.forEach((r) => throttle.request(r.guildId)))
        .catch((error: unknown) => ctx.logger.warn({ err: error }, 'member stats catch-up failed'));
    });
  },
};
