import type { ModuleInstaller } from '../types.js';

export interface LoggingRuntimeConfig {
  modLogId: string | null;
  joinLeaveId: string | null;
}

export const installLogging: ModuleInstaller = (ctx) => {
  const spec = ctx.template.modules.logging;
  const config: LoggingRuntimeConfig = {
    modLogId: spec?.modLog ? (ctx.ids.channels[spec.modLog] ?? null) : null,
    joinLeaveId: spec?.joinLeaveLog ? (ctx.ids.channels[spec.joinLeaveLog] ?? null) : null,
  };
  return Promise.resolve({ ...config });
};
