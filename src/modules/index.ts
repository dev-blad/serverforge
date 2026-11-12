import { installAutoRole } from './autoRole/install.js';
import { autoRoleRuntime } from './autoRole/runtime.js';
import { installAutomod } from './automod/install.js';
import { installButtonRoles } from './buttonRoles/install.js';
import { buttonRolesRuntime } from './buttonRoles/runtime.js';
import { installLogging } from './logging/install.js';
import { loggingRuntime } from './logging/runtime.js';
import { installMemberStats } from './memberStats/install.js';
import { memberStatsRuntime } from './memberStats/runtime.js';
import type { ModuleRuntime } from './runtimeTypes.js';
import { installTickets } from './tickets/install.js';
import { ticketsRuntime } from './tickets/runtime.js';
import { installTixbot } from './tixbot/install.js';
import { tixbotRuntime } from './tixbot/runtime.js';
import type { ModuleInstallers } from './types.js';
import { installVerification } from './verification/install.js';
import { verificationRuntime } from './verification/runtime.js';

/**
 * Feature modules. Each lives in its own folder with:
 *   install.ts  – builder-time setup (panels, AutoMod rules…), returns per-guild config
 *   runtime.ts  – persistent button handlers + event listeners
 *   logic.ts    – pure, unit-tested helpers
 * A module only acts in guilds whose template enabled it (config stored in GuildModule).
 */
export const moduleInstallers: ModuleInstallers = {
  autoRole: installAutoRole,
  verification: installVerification,
  buttonRoles: installButtonRoles,
  logging: installLogging,
  automod: installAutomod,
  tickets: installTickets,
  memberStats: installMemberStats,
  tixbot: installTixbot,
};

/** AutoMod is enforced natively by Discord, so it has no runtime component. */
export const moduleRuntimes: ModuleRuntime[] = [
  autoRoleRuntime,
  verificationRuntime,
  buttonRolesRuntime,
  loggingRuntime,
  ticketsRuntime,
  memberStatsRuntime,
  tixbotRuntime,
];
