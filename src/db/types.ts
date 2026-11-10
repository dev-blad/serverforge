import type { ModuleId, Tier } from '../services/template/schema.js';

/**
 * Repository interfaces. Services depend only on these, never on Prisma directly, so the
 * storage backend can be swapped (Prisma/SQLite in production, in-memory in tests).
 */

export type LicenseStatus = 'unused' | 'active' | 'revoked';

export interface LicenseRecord {
  id: string;
  keyHash: string;
  last4: string;
  tier: Tier;
  templateId: string | null;
  status: LicenseStatus;
  note: string | null;
  guildId: string | null;
  activatedAt: Date | null;
  activatedBy: string | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface LicenseFilter {
  status?: LicenseStatus;
  tier?: Tier;
  guildId?: string;
  limit?: number;
}

export interface LicenseRepository {
  create(
    data: Pick<LicenseRecord, 'keyHash' | 'last4' | 'tier' | 'templateId' | 'note'>,
  ): Promise<LicenseRecord>;
  findById(id: string): Promise<LicenseRecord | null>;
  findByHash(keyHash: string): Promise<LicenseRecord | null>;
  list(filter?: LicenseFilter): Promise<LicenseRecord[]>;
  /**
   * Atomically bind an *unused* license to a guild. Returns false if the license was not
   * unused any more (e.g. two guilds racing with the same key).
   */
  activate(id: string, guildId: string, userId: string, at: Date): Promise<boolean>;
  revoke(id: string, at: Date): Promise<LicenseRecord>;
}

export type BuildMode = 'alongside' | 'clean';

export interface GuildOptions {
  serverName: string;
  brandColor: string;
  mode: BuildMode;
}

export interface GuildRecord {
  id: string;
  tier: Tier;
  templateId: string;
  licenseId: string | null;
  ownerId: string;
  options: GuildOptions;
  builtAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GuildRepository {
  get(id: string): Promise<GuildRecord | null>;
  upsert(record: Omit<GuildRecord, 'createdAt' | 'updatedAt'>): Promise<GuildRecord>;
  markBuilt(id: string, at: Date): Promise<void>;
  list(): Promise<GuildRecord[]>;
}

export type ResourceKind =
  'role' | 'category' | 'channel' | 'message' | 'automod' | 'everyone' | 'guild';

export interface ResourceRecord {
  guildId: string;
  /** Namespaced template key, e.g. "role:member", "channel:general", "message:rules". */
  key: string;
  kind: ResourceKind;
  discordId: string;
  channelId: string | null;
  runId: string | null;
  /** true = created by ServerForge, false = adopted pre-existing resource. */
  created: boolean;
  /** JSON of previous state for modified (not created) resources. */
  previous: string | null;
}

export interface ResourceRepository {
  list(guildId: string): Promise<ResourceRecord[]>;
  get(guildId: string, key: string): Promise<ResourceRecord | null>;
  upsert(record: ResourceRecord): Promise<void>;
  delete(guildId: string, key: string): Promise<void>;
  listByRun(guildId: string, runId: string): Promise<ResourceRecord[]>;
}

export interface ModuleRecord {
  guildId: string;
  moduleId: ModuleId;
  enabled: boolean;
  /** Resolved config (Discord IDs instead of template keys). */
  config: Record<string, unknown>;
}

export interface ModuleRepository {
  list(guildId: string): Promise<ModuleRecord[]>;
  get(guildId: string, moduleId: ModuleId): Promise<ModuleRecord | null>;
  upsert(record: ModuleRecord): Promise<void>;
  listEnabled(moduleId: ModuleId): Promise<ModuleRecord[]>;
}

export type BuildKind = 'setup' | 'upgrade' | 'resync';
export type BuildStatus = 'running' | 'succeeded' | 'failed' | 'rolled_back' | 'interrupted';

export interface BuildRunRecord {
  id: string;
  guildId: string;
  licenseId: string | null;
  templateId: string;
  tier: Tier;
  kind: BuildKind;
  mode: BuildMode;
  status: BuildStatus;
  options: GuildOptions;
  userId: string;
  total: number;
  completed: number;
  error: string | null;
  startedAt: Date;
  finishedAt: Date | null;
}

export interface BuildRunRepository {
  create(
    data: Omit<BuildRunRecord, 'id' | 'startedAt' | 'finishedAt' | 'error' | 'completed' | 'total'>,
  ): Promise<BuildRunRecord>;
  get(id: string): Promise<BuildRunRecord | null>;
  update(
    id: string,
    patch: Partial<Pick<BuildRunRecord, 'status' | 'total' | 'completed' | 'error' | 'finishedAt'>>,
  ): Promise<void>;
  listByStatus(status: BuildStatus): Promise<BuildRunRecord[]>;
  latest(guildId: string): Promise<BuildRunRecord | null>;
}

export interface SetupSessionRecord {
  id: string;
  guildId: string;
  userId: string;
  licenseId: string;
  dryRun: boolean;
  mode: BuildMode | null;
  options: GuildOptions | null;
  createdAt: Date;
  expiresAt: Date;
}

export interface SetupSessionRepository {
  create(data: Omit<SetupSessionRecord, 'id' | 'createdAt'>): Promise<SetupSessionRecord>;
  get(id: string): Promise<SetupSessionRecord | null>;
  update(id: string, patch: Partial<Pick<SetupSessionRecord, 'mode' | 'options'>>): Promise<void>;
  delete(id: string): Promise<void>;
  purgeExpired(now: Date): Promise<number>;
}

export interface TicketRecord {
  id: string;
  guildId: string;
  channelId: string;
  openerId: string;
  number: number;
  status: 'open' | 'closed';
  createdAt: Date;
  closedAt: Date | null;
  closedBy: string | null;
}

export interface TicketRepository {
  create(
    data: Pick<TicketRecord, 'guildId' | 'channelId' | 'openerId' | 'number'>,
  ): Promise<TicketRecord>;
  findByChannel(channelId: string): Promise<TicketRecord | null>;
  countOpenByUser(guildId: string, userId: string): Promise<number>;
  nextNumber(guildId: string): Promise<number>;
  close(id: string, closedBy: string, at: Date): Promise<void>;
}

export interface Database {
  licenses: LicenseRepository;
  guilds: GuildRepository;
  resources: ResourceRepository;
  modules: ModuleRepository;
  runs: BuildRunRepository;
  sessions: SetupSessionRepository;
  tickets: TicketRepository;
  close(): Promise<void>;
}
