/* eslint-disable @typescript-eslint/require-await -- in-memory repos implement async interfaces synchronously */
import { randomUUID } from 'node:crypto';
import type {
  BuildRunRecord,
  Database,
  GuildRecord,
  LicenseRecord,
  ModuleRecord,
  ResourceRecord,
  SetupSessionRecord,
  TicketRecord,
  FeatureRecord,
  RecordFilter,
} from './types.js';

/**
 * In-memory implementation of every repository. Used by unit tests and handy for
 * experimenting without a database. Not durable — do not use in production.
 */
export function createMemoryDatabase(): Database & { dump(): Record<string, unknown[]> } {
  const licenses = new Map<string, LicenseRecord>();
  const guilds = new Map<string, GuildRecord>();
  const resources = new Map<string, ResourceRecord>();
  const modules = new Map<string, ModuleRecord>();
  const runs = new Map<string, BuildRunRecord>();
  const sessions = new Map<string, SetupSessionRecord>();
  const tickets = new Map<string, TicketRecord>();
  const records = new Map<string, FeatureRecord>();
  const clone = <T>(v: T): T => structuredClone(v);
  const matches = (r: FeatureRecord, f: RecordFilter = {}) => {
    if (f.status !== undefined) {
      const wanted = Array.isArray(f.status) ? f.status : [f.status];
      if (!wanted.includes(r.status ?? '')) return false;
    }
    if (f.userId !== undefined && r.userId !== f.userId) return false;
    if (f.since && r.createdAt < f.since) return false;
    return true;
  };
  const newestFirst = (a: FeatureRecord, b: FeatureRecord) =>
    b.createdAt.getTime() - a.createdAt.getTime() || b.number - a.number;

  return {
    dump: () => ({
      licenses: [...licenses.values()],
      guilds: [...guilds.values()],
      resources: [...resources.values()],
      modules: [...modules.values()],
      runs: [...runs.values()],
      sessions: [...sessions.values()],
      tickets: [...tickets.values()],
      records: [...records.values()],
    }),
    close: () => Promise.resolve(),

    licenses: {
      async create(data) {
        const record: LicenseRecord = {
          id: randomUUID(),
          status: 'unused',
          guildId: null,
          activatedAt: null,
          activatedBy: null,
          revokedAt: null,
          createdAt: new Date(),
          ...data,
        };
        if ([...licenses.values()].some((l) => l.keyHash === data.keyHash)) {
          throw new Error('Unique constraint failed on keyHash');
        }
        licenses.set(record.id, record);
        return clone(record);
      },
      async findById(id) {
        const r = licenses.get(id);
        return r ? clone(r) : null;
      },
      async findByHash(hash) {
        const r = [...licenses.values()].find((l) => l.keyHash === hash);
        return r ? clone(r) : null;
      },
      async list(filter = {}) {
        return [...licenses.values()]
          .filter(
            (l) =>
              (!filter.status || l.status === filter.status) &&
              (!filter.tier || l.tier === filter.tier) &&
              (!filter.guildId || l.guildId === filter.guildId),
          )
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, filter.limit ?? Infinity)
          .map(clone);
      },
      async activate(id, guildId, userId, at) {
        const r = licenses.get(id);
        if (!r || r.status !== 'unused') return false;
        Object.assign(r, { status: 'active', guildId, activatedBy: userId, activatedAt: at });
        return true;
      },
      async revoke(id, at) {
        const r = licenses.get(id);
        if (!r) throw new Error(`License ${id} not found`);
        Object.assign(r, { status: 'revoked', revokedAt: at });
        return clone(r);
      },
    },

    guilds: {
      async get(id) {
        const r = guilds.get(id);
        return r ? clone(r) : null;
      },
      async upsert(record) {
        const existing = guilds.get(record.id);
        const now = new Date();
        const next: GuildRecord = {
          ...record,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        guilds.set(record.id, next);
        return clone(next);
      },
      async markBuilt(id, at) {
        const r = guilds.get(id);
        if (r) r.builtAt = at;
      },
      async list() {
        return [...guilds.values()].map(clone);
      },
    },

    resources: {
      async list(guildId) {
        return [...resources.values()].filter((r) => r.guildId === guildId).map(clone);
      },
      async get(guildId, key) {
        const r = resources.get(`${guildId}|${key}`);
        return r ? clone(r) : null;
      },
      async upsert(record) {
        resources.set(`${record.guildId}|${record.key}`, clone(record));
      },
      async delete(guildId, key) {
        resources.delete(`${guildId}|${key}`);
      },
      async listByRun(guildId, runId) {
        return [...resources.values()]
          .filter((r) => r.guildId === guildId && r.runId === runId)
          .map(clone);
      },
    },

    modules: {
      async list(guildId) {
        return [...modules.values()].filter((m) => m.guildId === guildId).map(clone);
      },
      async get(guildId, moduleId) {
        const r = modules.get(`${guildId}|${moduleId}`);
        return r ? clone(r) : null;
      },
      async upsert(record) {
        modules.set(`${record.guildId}|${record.moduleId}`, clone(record));
      },
      async listEnabled(moduleId) {
        return [...modules.values()].filter((m) => m.moduleId === moduleId && m.enabled).map(clone);
      },
    },

    runs: {
      async create(data) {
        const record: BuildRunRecord = {
          id: randomUUID(),
          startedAt: new Date(),
          finishedAt: null,
          error: null,
          completed: 0,
          total: 0,
          ...data,
        };
        runs.set(record.id, record);
        return clone(record);
      },
      async get(id) {
        const r = runs.get(id);
        return r ? clone(r) : null;
      },
      async update(id, patch) {
        const r = runs.get(id);
        if (r) Object.assign(r, patch);
      },
      async listByStatus(status) {
        return [...runs.values()].filter((r) => r.status === status).map(clone);
      },
      async latest(guildId) {
        const r = [...runs.values()]
          .filter((x) => x.guildId === guildId)
          .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
        return r ? clone(r) : null;
      },
    },

    sessions: {
      async create(data) {
        const record: SetupSessionRecord = { id: randomUUID(), createdAt: new Date(), ...data };
        sessions.set(record.id, record);
        return clone(record);
      },
      async get(id) {
        const r = sessions.get(id);
        return r ? clone(r) : null;
      },
      async update(id, patch) {
        const r = sessions.get(id);
        if (r) Object.assign(r, patch);
      },
      async delete(id) {
        sessions.delete(id);
      },
      async purgeExpired(now) {
        let n = 0;
        for (const [id, s] of sessions) {
          if (s.expiresAt <= now) {
            sessions.delete(id);
            n += 1;
          }
        }
        return n;
      },
    },

    tickets: {
      async create(data) {
        const record: TicketRecord = {
          id: randomUUID(),
          status: 'open',
          createdAt: new Date(),
          closedAt: null,
          closedBy: null,
          ...data,
        };
        tickets.set(record.id, record);
        return clone(record);
      },
      async findByChannel(channelId) {
        const r = [...tickets.values()].find((t) => t.channelId === channelId);
        return r ? clone(r) : null;
      },
      async countOpenByUser(guildId, userId) {
        return [...tickets.values()].filter(
          (t) => t.guildId === guildId && t.openerId === userId && t.status === 'open',
        ).length;
      },
      async nextNumber(guildId) {
        const numbers = [...tickets.values()]
          .filter((t) => t.guildId === guildId)
          .map((t) => t.number);
        return (numbers.length ? Math.max(...numbers) : 0) + 1;
      },
      async close(id, closedBy, at) {
        const r = tickets.get(id);
        if (r) Object.assign(r, { status: 'closed', closedBy, closedAt: at });
      },
    },
    records: {
      async create(input) {
        const number =
          [...records.values()]
            .filter((r) => r.guildId === input.guildId && r.kind === input.kind)
            .reduce((max, r) => Math.max(max, r.number), 0) + 1;
        const now = new Date();
        const record: FeatureRecord = {
          id: randomUUID(),
          guildId: input.guildId,
          kind: input.kind,
          number,
          userId: input.userId ?? null,
          status: input.status ?? null,
          data: clone(input.data) as Record<string, unknown>,
          createdAt: now,
          updatedAt: now,
        };
        records.set(record.id, record);
        return clone(record) as never;
      },
      async get(id) {
        const r = records.get(id);
        return (r ? clone(r) : null) as never;
      },
      async findByNumber(guildId, kind, number) {
        const r = [...records.values()].find(
          (x) => x.guildId === guildId && x.kind === kind && x.number === number,
        );
        return (r ? clone(r) : null) as never;
      },
      async update(id, patch) {
        const r = records.get(id);
        if (!r) throw new Error(`Record ${id} not found`);
        if (patch.status !== undefined) r.status = patch.status;
        if (patch.data !== undefined) r.data = clone(patch.data) as Record<string, unknown>;
        r.updatedAt = new Date();
        return clone(r) as never;
      },
      async list(guildId, kind, filter = {}) {
        const out = [...records.values()]
          .filter((r) => r.guildId === guildId && r.kind === kind && matches(r, filter))
          .sort(newestFirst);
        return clone(filter.limit ? out.slice(0, filter.limit) : out) as never;
      },
      async count(guildId, kind, filter = {}) {
        return [...records.values()].filter(
          (r) => r.guildId === guildId && r.kind === kind && matches(r, filter),
        ).length;
      },
      async listByStatus(kind, status) {
        return clone(
          [...records.values()].filter((r) => r.kind === kind && r.status === status),
        ) as never;
      },
      async delete(id) {
        records.delete(id);
      },
    },
  };
}
