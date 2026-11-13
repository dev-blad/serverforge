import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, describe, expect, it } from 'vitest';
import { createMemoryDatabase } from '../../src/db/memory.js';
import { createPrismaClient, createPrismaDatabase } from '../../src/db/prisma.js';
import type { Database as Db } from '../../src/db/types.js';

const dir = mkdtempSync(path.join(os.tmpdir(), 'sf-records-'));
const file = path.join(dir, 'test.db');
{
  // Apply the real migrations so the test also checks the migration SQL.
  const sqlite = new DatabaseSync(file);
  const migrations = path.resolve('prisma/migrations');
  for (const name of readdirSync(migrations)
    .filter((n) => !n.endsWith('.toml'))
    .sort()) {
    sqlite.exec(readFileSync(path.join(migrations, name, 'migration.sql'), 'utf8'));
  }
  sqlite.close();
}
const prismaClient = createPrismaClient(`file:${file}`);
afterAll(async () => {
  await prismaClient.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

const backends: [string, () => Db][] = [
  ['memory', () => createMemoryDatabase()],
  ['sqlite (prisma)', () => createPrismaDatabase(prismaClient)],
];

describe.each(backends)('records repository (%s)', (_name, make) => {
  it('numbers records per guild and kind, filters and updates them', async () => {
    const db = make();
    const guild = `g-${Math.random()}`;
    const a = await db.records.create({
      guildId: guild,
      kind: 'order',
      userId: 'u1',
      status: 'open',
      data: { price: 10 },
    });
    const b = await db.records.create({
      guildId: guild,
      kind: 'order',
      userId: 'u2',
      status: 'open',
      data: { price: 20 },
    });
    const v = await db.records.create({
      guildId: guild,
      kind: 'vouch',
      userId: 'u1',
      data: { rating: 5 },
    });
    expect([a.number, b.number, v.number]).toEqual([1, 2, 1]);

    const updated = await db.records.update<{ price: number }>(a.id, {
      status: 'completed',
      data: { price: 15 },
    });
    expect(updated.status).toBe('completed');
    expect(updated.data.price).toBe(15);

    expect(await db.records.count(guild, 'order')).toBe(2);
    expect(await db.records.count(guild, 'order', { status: 'open' })).toBe(1);
    expect(await db.records.count(guild, 'order', { status: ['open', 'completed'] })).toBe(2);
    expect(await db.records.count(guild, 'order', { userId: 'u1' })).toBe(1);
    expect(await db.records.list(guild, 'order', { limit: 1 })).toHaveLength(1);
    expect((await db.records.findByNumber(guild, 'order', 2))?.id).toBe(b.id);
    expect((await db.records.listByStatus('order', 'open')).some((r) => r.id === b.id)).toBe(true);

    await db.records.delete(b.id);
    expect(await db.records.get(b.id)).toBeNull();
    expect(await db.records.count(guild, 'order', { since: new Date(Date.now() + 60_000) })).toBe(
      0,
    );
  });
});
