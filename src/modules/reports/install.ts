import { requireId } from '../shared.js';
import type { ModuleInstaller } from '../types.js';
import type { Weekday } from './logic.js';

export interface ReportsRuntimeConfig {
  channelId: string;
  day: Weekday;
  hour: number;
}

export const installReports: ModuleInstaller = (ctx) => {
  const spec = ctx.template.modules.reports;
  if (!spec) throw new Error('reports config missing');
  const config: ReportsRuntimeConfig = {
    channelId: requireId(ctx.ids.channels, spec.channel, 'Channel'),
    day: spec.day,
    hour: spec.hour,
  };
  return Promise.resolve({ ...config });
};
