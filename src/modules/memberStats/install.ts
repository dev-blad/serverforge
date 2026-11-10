import { requireId } from '../shared.js';
import type { ModuleInstaller } from '../types.js';
import { formatStatsName } from './logic.js';

export interface MemberStatsRuntimeConfig {
  channelId: string;
  format: string;
  includeBots: boolean;
}

export const installMemberStats: ModuleInstaller = async (ctx) => {
  const spec = ctx.template.modules.memberStats;
  if (!spec) throw new Error('memberStats config missing');
  const channelId = requireId(ctx.ids.channels, spec.channel, 'Channel');
  try {
    const count = await ctx.gateway.memberCount(spec.includeBots);
    await ctx.queue.run('update member count', () =>
      ctx.gateway.renameChannel(channelId, formatStatsName(spec.format, count)),
    );
  } catch (error) {
    // Renames are heavily rate limited; the runtime will catch up on the next join/leave.
    ctx.logger.warn({ err: error }, 'initial member count update failed');
  }
  const config: MemberStatsRuntimeConfig = {
    channelId,
    format: spec.format,
    includeBots: spec.includeBots,
  };
  return { ...config };
};
