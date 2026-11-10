import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/prisma/client.js';
import type { Tier } from '../services/template/schema.js';
import type {
  BuildRunRecord,
  Database,
  GuildOptions,
  GuildRecord,
  LicenseRecord,
  LicenseStatus,
  ModuleRecord,
  ResourceKind,
  ResourceRecord,
  SetupSessionRecord,
  TicketRecord,
} from './types.js';
import type { ModuleId } from '../services/template/schema.js';

/**
 * Prisma-backed repositories (SQLite via better-sqlite3 driver adapter).
 * To move to Postgres: switch the datasource provider in prisma/schema.prisma, install
 * @prisma/adapter-pg and construct `new PrismaPg({ connectionString })` below instead.
 */

function sqliteFile(url: string): string {
  const file = url.replace(/^file:/, '');
  if (file !== ':memory:') mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  return file;
}

export function createPrismaClient(databaseUrl: string): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: sqliteFile(databaseUrl) });
  return new PrismaClient({ adapter });
}

const json = <T>(text: string | null): T | null => (text ? (JSON.parse(text) as T) : null);

type PrismaLicense = Awaited<ReturnType<PrismaClient['license']['findFirstOrThrow']>>;
type PrismaGuild = Awaited<ReturnType<PrismaClient['guild']['findFirstOrThrow']>>;
type PrismaRun = Awaited<ReturnType<PrismaClient['buildRun']['findFirstOrThrow']>>;
type PrismaResource = Awaited<ReturnType<PrismaClient['guildResource']['findFirstOrThrow']>>;
type PrismaModule = Awaited<ReturnType<PrismaClient['guildModule']['findFirstOrThrow']>>;
type PrismaSession = Awaited<ReturnType<PrismaClient['setupSession']['findFirstOrThrow']>>;
type PrismaTicket = Awaited<ReturnType<PrismaClient['ticket']['findFirstOrThrow']>>;

const toLicense = (r: PrismaLicense): LicenseRecord => ({
  ...r,
  tier: r.tier as Tier,
  status: r.status as LicenseStatus,
});

const toGuild = (r: PrismaGuild): GuildRecord => ({
  ...r,
  tier: r.tier as Tier,
  options: json<GuildOptions>(r.options) ?? {
    serverName: '',
    brandColor: '#5865F2',
    mode: 'alongside',
  },
});

const toRun = (r: PrismaRun): BuildRunRecord => ({
  ...r,
  tier: r.tier as Tier,
  kind: r.kind as BuildRunRecord['kind'],
  mode: r.mode as BuildRunRecord['mode'],
  status: r.status as BuildRunRecord['status'],
  options: json<GuildOptions>(r.options) ?? {
    serverName: '',
    brandColor: '#5865F2',
    mode: 'alongside',
  },
});

const toResource = (r: PrismaResource): ResourceRecord => ({
  guildId: r.guildId,
  key: r.key,
  kind: r.kind as ResourceKind,
  discordId: r.discordId,
  channelId: r.channelId,
  runId: r.runId,
  created: r.created,
  previous: r.previous,
});

const toModule = (r: PrismaModule): ModuleRecord => ({
  guildId: r.guildId,
  moduleId: r.moduleId as ModuleId,
  enabled: r.enabled,
  config: json<Record<string, unknown>>(r.config) ?? {},
});

const toSession = (r: PrismaSession): SetupSessionRecord => ({
  ...r,
  mode: r.mode as SetupSessionRecord['mode'],
  options: json<GuildOptions>(r.options),
});

const toTicket = (r: PrismaTicket): TicketRecord => ({
  ...r,
  status: r.status as TicketRecord['status'],
});

export function createPrismaDatabase(client: PrismaClient): Database {
  return {
    close: () => client.$disconnect(),

    licenses: {
      create: async (data) => toLicense(await client.license.create({ data })),
      findById: async (id) => {
        const r = await client.license.findUnique({ where: { id } });
        return r ? toLicense(r) : null;
      },
      findByHash: async (keyHash) => {
        const r = await client.license.findUnique({ where: { keyHash } });
        return r ? toLicense(r) : null;
      },
      list: async (filter = {}) =>
        (
          await client.license.findMany({
            where: {
              ...(filter.status ? { status: filter.status } : {}),
              ...(filter.tier ? { tier: filter.tier } : {}),
              ...(filter.guildId ? { guildId: filter.guildId } : {}),
            },
            orderBy: { createdAt: 'desc' },
            ...(filter.limit ? { take: filter.limit } : {}),
          })
        ).map(toLicense),
      activate: async (id, guildId, userId, at) => {
        // Conditional update = atomic compare-and-set on status.
        const result = await client.license.updateMany({
          where: { id, status: 'unused' },
          data: { status: 'active', guildId, activatedBy: userId, activatedAt: at },
        });
        return result.count === 1;
      },
      revoke: async (id, at) =>
        toLicense(
          await client.license.update({
            where: { id },
            data: { status: 'revoked', revokedAt: at },
          }),
        ),
    },

    guilds: {
      get: async (id) => {
        const r = await client.guild.findUnique({ where: { id } });
        return r ? toGuild(r) : null;
      },
      upsert: async (record) => {
        const data = { ...record, options: JSON.stringify(record.options) };
        return toGuild(
          await client.guild.upsert({ where: { id: record.id }, create: data, update: data }),
        );
      },
      markBuilt: async (id, at) => {
        await client.guild.update({ where: { id }, data: { builtAt: at } });
      },
      list: async () => (await client.guild.findMany()).map(toGuild),
    },

    resources: {
      list: async (guildId) =>
        (await client.guildResource.findMany({ where: { guildId } })).map(toResource),
      get: async (guildId, key) => {
        const r = await client.guildResource.findUnique({
          where: { guildId_key: { guildId, key } },
        });
        return r ? toResource(r) : null;
      },
      upsert: async (record) => {
        await client.guildResource.upsert({
          where: { guildId_key: { guildId: record.guildId, key: record.key } },
          create: record,
          update: record,
        });
      },
      delete: async (guildId, key) => {
        await client.guildResource.deleteMany({ where: { guildId, key } });
      },
      listByRun: async (guildId, runId) =>
        (
          await client.guildResource.findMany({
            where: { guildId, runId },
            orderBy: { createdAt: 'asc' },
          })
        ).map(toResource),
    },

    modules: {
      list: async (guildId) =>
        (await client.guildModule.findMany({ where: { guildId } })).map(toModule),
      get: async (guildId, moduleId) => {
        const r = await client.guildModule.findUnique({
          where: { guildId_moduleId: { guildId, moduleId } },
        });
        return r ? toModule(r) : null;
      },
      upsert: async (record) => {
        const data = { ...record, config: JSON.stringify(record.config) };
        await client.guildModule.upsert({
          where: { guildId_moduleId: { guildId: record.guildId, moduleId: record.moduleId } },
          create: data,
          update: data,
        });
      },
      listEnabled: async (moduleId) =>
        (await client.guildModule.findMany({ where: { moduleId, enabled: true } })).map(toModule),
    },

    runs: {
      create: async (data) =>
        toRun(
          await client.buildRun.create({
            data: { ...data, options: JSON.stringify(data.options) },
          }),
        ),
      get: async (id) => {
        const r = await client.buildRun.findUnique({ where: { id } });
        return r ? toRun(r) : null;
      },
      update: async (id, patch) => {
        await client.buildRun.update({ where: { id }, data: patch });
      },
      listByStatus: async (status) =>
        (await client.buildRun.findMany({ where: { status } })).map(toRun),
      latest: async (guildId) => {
        const r = await client.buildRun.findFirst({
          where: { guildId },
          orderBy: { startedAt: 'desc' },
        });
        return r ? toRun(r) : null;
      },
    },

    sessions: {
      create: async (data) =>
        toSession(
          await client.setupSession.create({
            data: { ...data, options: data.options ? JSON.stringify(data.options) : null },
          }),
        ),
      get: async (id) => {
        const r = await client.setupSession.findUnique({ where: { id } });
        return r ? toSession(r) : null;
      },
      update: async (id, patch) => {
        await client.setupSession.update({
          where: { id },
          data: {
            ...(patch.mode !== undefined ? { mode: patch.mode } : {}),
            ...(patch.options !== undefined
              ? { options: patch.options ? JSON.stringify(patch.options) : null }
              : {}),
          },
        });
      },
      delete: async (id) => {
        await client.setupSession.deleteMany({ where: { id } });
      },
      purgeExpired: async (now) =>
        (await client.setupSession.deleteMany({ where: { expiresAt: { lte: now } } })).count,
    },

    tickets: {
      create: async (data) => toTicket(await client.ticket.create({ data })),
      findByChannel: async (channelId) => {
        const r = await client.ticket.findUnique({ where: { channelId } });
        return r ? toTicket(r) : null;
      },
      countOpenByUser: (guildId, openerId) =>
        client.ticket.count({ where: { guildId, openerId, status: 'open' } }),
      nextNumber: async (guildId) => {
        const r = await client.ticket.aggregate({ where: { guildId }, _max: { number: true } });
        return (r._max.number ?? 0) + 1;
      },
      close: async (id, closedBy, at) => {
        await client.ticket.update({
          where: { id },
          data: { status: 'closed', closedBy, closedAt: at },
        });
      },
    },
  };
}
