import { requireId } from '../shared.js';
import type { ModuleInstaller } from '../types.js';

export interface GiveawaysRuntimeConfig {
  channelId: string;
  staffRoleIds: string[];
  pingRoleId: string | null;
}

export const installGiveaways: ModuleInstaller = (ctx) => {
  const spec = ctx.template.modules.giveaways;
  if (!spec) throw new Error('giveaways config missing');
  const config: GiveawaysRuntimeConfig = {
    channelId: requireId(ctx.ids.channels, spec.channel, 'Channel'),
    staffRoleIds: spec.staffRoles.map((k) => ctx.ids.roles[k]).filter((id): id is string => !!id),
    pingRoleId: spec.pingRole ? (ctx.ids.roles[spec.pingRole] ?? null) : null,
  };
  return Promise.resolve({ ...config });
};
