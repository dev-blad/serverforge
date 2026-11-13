import type { ModuleInstaller } from '../types.js';

export interface BackupRuntimeConfig {
  keep: number;
}

export const installBackup: ModuleInstaller = (ctx) => {
  const spec = ctx.template.modules.backup;
  if (!spec) throw new Error('backup config missing');
  const config: BackupRuntimeConfig = { keep: spec.keep };
  return Promise.resolve({ ...config });
};
