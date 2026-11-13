import { requireId } from '../shared.js';
import type { ModuleInstaller } from '../types.js';

export interface RaidAlertRuntimeConfig {
  channelId: string;
  pingRoleId: string | null;
  joins: number;
  seconds: number;
}

export const installRaidAlert: ModuleInstaller = (ctx) => {
  const spec = ctx.template.modules.raidAlert;
  if (!spec) throw new Error('raidAlert config missing');
  const config: RaidAlertRuntimeConfig = {
    channelId: requireId(ctx.ids.channels, spec.channel, 'Channel'),
    pingRoleId: spec.pingRole ? (ctx.ids.roles[spec.pingRole] ?? null) : null,
    joins: spec.joins,
    seconds: spec.seconds,
  };
  return Promise.resolve({ ...config });
};
