import type { Client } from 'discord.js';
import type { AppContext } from '../../bot/types.js';
import { toDiscordEmbed } from '../../services/builder/discordGateway.js';
import { brandColor } from '../common.js';
import type { ModuleRuntime } from '../runtimeTypes.js';
import type { StoreRuntimeConfig } from '../store/install.js';
import type { OrderData } from '../store/logic.js';
import type { VouchData } from '../vouches/logic.js';
import type { ReportsRuntimeConfig } from './install.js';
import { reportDue, weeklyReportEmbed, type WeeklyNumbers } from './logic.js';

const WEEK = 7 * 86_400_000;

/** Gather the week's numbers and post the report. Exported for tests and manual runs. */
export async function postWeeklyReport(
  ctx: Pick<AppContext, 'db' | 'logger' | 'moduleConfig'>,
  client: Client,
  guildId: string,
  config: ReportsRuntimeConfig,
  now = new Date(),
): Promise<boolean> {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return false;
  const since = new Date(now.getTime() - WEEK);
  const [last] = await ctx.db.records.list<{ members: number }>(guildId, 'report', { limit: 1 });
  const placed = await ctx.db.records.list<OrderData>(guildId, 'order', { since });
  const completed = await ctx.db.records.list<OrderData>(guildId, 'order', { status: 'completed' });
  const completedThisWeek = completed.filter((o) => o.updatedAt >= since);
  const store = await ctx.moduleConfig.get<StoreRuntimeConfig>(guildId, 'store');

  const numbers: WeeklyNumbers = {
    members: guild.memberCount,
    previousMembers: last?.data.members ?? null,
    ordersPlaced: placed.length,
    ordersCompleted: completedThisWeek.length,
    revenue: completedThisWeek.reduce((sum, o) => sum + (o.data.price ?? 0), 0),
    openOrders: await ctx.db.records.count(guildId, 'order', {
      status: ['received', 'in_progress'],
    }),
    vouches: (await ctx.db.records.list<VouchData>(guildId, 'vouch', { since })).map(
      (v) => v.data.rating,
    ),
    giveaways: await ctx.db.records.count(guildId, 'giveaway', { since }),
    applications: await ctx.db.records.count(guildId, 'application', { since }),
  };
  const channel = await guild.channels.fetch(config.channelId).catch(() => null);
  if (!channel?.isSendable()) return false;
  await channel.send({
    embeds: [
      toDiscordEmbed(
        weeklyReportEmbed({
          serverName: guild.name,
          numbers,
          currency: store?.currency ?? null,
          color: await brandColor(ctx, guildId),
          from: since,
          to: now,
        }),
      ),
    ],
  });
  await ctx.db.records.create({ guildId, kind: 'report', data: { members: numbers.members } });
  return true;
}

export const reportsRuntime: ModuleRuntime = {
  id: 'reports',
  register(client, ctx) {
    const timer = setInterval(() => {
      void (async () => {
        const now = new Date();
        for (const module of await ctx.db.modules.listEnabled('reports')) {
          const config = module.config as unknown as ReportsRuntimeConfig;
          const [last] = await ctx.db.records.list(module.guildId, 'report', { limit: 1 });
          if (!reportDue(now, config.day, config.hour, last?.createdAt ?? null)) continue;
          await postWeeklyReport(ctx, client, module.guildId, config, now);
        }
      })().catch((error: unknown) => ctx.logger.warn({ err: error }, 'weekly report sweep failed'));
    }, 10 * 60_000);
    timer.unref();
  },
};
