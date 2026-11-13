import { requireId } from '../shared.js';
import type { ModuleInstaller } from '../types.js';

export interface AnnouncementsRuntimeConfig {
  channelId: string;
  staffRoleIds: string[];
}

export const installAnnouncements: ModuleInstaller = (ctx) => {
  const spec = ctx.template.modules.announcements;
  if (!spec) throw new Error('announcements config missing');
  const config: AnnouncementsRuntimeConfig = {
    channelId: requireId(ctx.ids.channels, spec.channel, 'Channel'),
    staffRoleIds: spec.staffRoles.map((k) => ctx.ids.roles[k]).filter((id): id is string => !!id),
  };
  return Promise.resolve({ ...config });
};
