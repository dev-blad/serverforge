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
import { installStatus } from './status/install.js';
import { installVouches } from './vouches/install.js';
import { vouchesRuntime } from './vouches/runtime.js';
import { installAnnouncements } from './announcements/install.js';
import { installStore } from './store/install.js';
import { storeRuntime } from './store/runtime.js';
import { installGiveaways } from './giveaways/install.js';
import { giveawaysRuntime } from './giveaways/runtime.js';
import { installApplications } from './applications/install.js';
import { applicationsRuntime } from './applications/runtime.js';
import { installReports } from './reports/install.js';
import { reportsRuntime } from './reports/runtime.js';
import { installRaidAlert } from './raidAlert/install.js';
import { raidAlertRuntime } from './raidAlert/runtime.js';
import { installBackup } from './backup/install.js';
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
  status: installStatus,
  vouches: installVouches,
  announcements: installAnnouncements,
  store: installStore,
  giveaways: installGiveaways,
  applications: installApplications,
  reports: installReports,
  raidAlert: installRaidAlert,
  backup: installBackup,
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
  vouchesRuntime,
  storeRuntime,
  giveawaysRuntime,
  applicationsRuntime,
  reportsRuntime,
  raidAlertRuntime,
];
