import { requireId } from '../shared.js';
import type { ModuleInstaller } from '../types.js';

export interface VouchesRuntimeConfig {
  channelId: string;
  staffRoleIds: string[];
  cooldownHours: number;
}

export const installVouches: ModuleInstaller = (ctx) => {
  const spec = ctx.template.modules.vouches;
  if (!spec) throw new Error('vouches config missing');
  const config: VouchesRuntimeConfig = {
    channelId: requireId(ctx.ids.channels, spec.channel, 'Channel'),
    staffRoleIds: spec.staffRoles.map((k) => ctx.ids.roles[k]).filter((id): id is string => !!id),
    cooldownHours: spec.cooldownHours,
  };
  return Promise.resolve({ ...config });
};
