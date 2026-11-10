import type { ModuleInstaller } from '../types.js';

export interface AutoRoleRuntimeConfig {
  memberRoleId: string | null;
  botRoleId: string | null;
}

export const installAutoRole: ModuleInstaller = (ctx) => {
  const spec = ctx.template.modules.autoRole;
  const config: AutoRoleRuntimeConfig = {
    memberRoleId: spec?.memberRole ? (ctx.ids.roles[spec.memberRole] ?? null) : null,
    botRoleId: spec?.botRole ? (ctx.ids.roles[spec.botRole] ?? null) : null,
  };
  return Promise.resolve({ ...config });
};
