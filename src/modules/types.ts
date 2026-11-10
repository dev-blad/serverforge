import type { Database, ResourceKind, ResourceRecord } from '../db/types.js';
import type { Logger } from '../logger.js';
import type { GuildGateway } from '../services/builder/gateway.js';
import type { TaskQueue } from '../services/builder/queue.js';
import type { ModuleId, Template } from '../services/template/schema.js';

/** Discord ids of template resources, by template key. */
export interface IdMap {
  roles: Record<string, string>;
  channels: Record<string, string>;
}

/** Everything a module needs to install itself into a guild during a build. */
export interface ModuleInstallContext {
  guildId: string;
  /** The rendered template being built. */
  template: Template;
  ids: IdMap;
  gateway: GuildGateway;
  /** Run every Discord call through the queue (pacing + retries). */
  queue: TaskQueue;
  db: Database;
  runId: string | null;
  logger: Logger;
  /** Record a resource created by the module (idempotency + rollback). */
  track(record: {
    key: string;
    kind: ResourceKind;
    discordId: string;
    channelId?: string | null;
  }): Promise<void>;
  /** A tracked resource by key, or null. */
  tracked(key: string): Promise<ResourceRecord | null>;
}

/**
 * Builder-time half of a feature module: creates whatever Discord resources the module needs
 * (panels, AutoMod rules, …) idempotently and returns its resolved per-guild config
 * (Discord ids rather than template keys), which is stored in the GuildModule table and read
 * by the module's runtime handlers.
 */
export type ModuleInstaller = (ctx: ModuleInstallContext) => Promise<Record<string, unknown>>;

export type ModuleInstallers = Partial<Record<ModuleId, ModuleInstaller>>;
