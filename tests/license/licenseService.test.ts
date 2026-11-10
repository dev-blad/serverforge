import { beforeEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { createMemoryDatabase } from '../../src/db/memory.js';
import { LicenseService } from '../../src/services/license/licenseService.js';
import { KeyAttemptGuard } from '../../src/services/rateLimit/rateLimiter.js';
import { loadTemplates } from '../../src/services/template/loader.js';
import { TemplateRegistry } from '../../src/services/template/registry.js';
import { fulfilPurchase, StripeProviderStub } from '../../src/services/license/payments.js';
import { UserFacingError } from '../../src/errors.js';

const PEPPER = 'test-pepper-0123456789';
const OPTIONS = { serverName: 'Test', brandColor: '#123456', mode: 'alongside' as const };
const registry = new TemplateRegistry(await loadTemplates(path.resolve('templates')));

describe('LicenseService', () => {
  let db: ReturnType<typeof createMemoryDatabase>;
  let service: LicenseService;

  beforeEach(() => {
    db = createMemoryDatabase();
    service = new LicenseService(db.licenses, db.guilds, PEPPER, registry);
  });

  const one = async (options: Parameters<LicenseService['generate']>[0]) =>
    (await service.generate(options))[0]!.key;

  const activate = async (key: string, guildId: string) => {
    const check = await service.checkActivation(key, { guildId, userId: 'u1' });
    await service.commitActivation(check, {
      guildId,
      userId: 'u1',
      ownerId: 'o1',
      options: OPTIONS,
    });
    return check;
  };

  it('generates keys and stores only a hash', async () => {
    const generated = await service.generate({ tier: 'pro', count: 3, note: 'fiverr 123' });
    expect(generated).toHaveLength(3);
    const stored = JSON.stringify(db.dump().licenses);
    for (const { key, license } of generated) {
      expect(stored).not.toContain(key);
      expect(license.keyHash).toBe(service.hash(key));
      expect(license.last4).toBe(key.slice(-4));
      expect(license.status).toBe('unused');
      expect(license.note).toBe('fiverr 123');
    }
  });

  it('validates tier/template combinations and counts', async () => {
    await expect(service.generate({ tier: 'pro', templateId: 'gaming' })).rejects.toThrow(
      /is an elite template/,
    );
    await expect(service.generate({ tier: 'pro', templateId: 'nope' })).rejects.toThrow(
      /not available/,
    );
    await expect(service.generate({ tier: 'pro', count: 0 })).rejects.toThrow(/between 1 and 500/);
    const [themed] = await service.generate({ tier: 'elite', templateId: 'gaming' });
    expect(themed!.license.templateId).toBe('gaming');
  });

  it('rejects malformed, unknown and revoked keys with friendly errors', async () => {
    await expect(service.resolve('hello')).rejects.toThrow(/doesn't look like a ServerForge key/);
    await expect(service.resolve('FORGE-AAAA-BBBB-CCCC')).rejects.toThrow(/couldn't find that key/);
    const key = await one({ tier: 'starter' });
    await service.revoke(key);
    await expect(service.resolve(key)).rejects.toBeInstanceOf(UserFacingError);
    await expect(service.resolve(key)).rejects.toThrow(/revoked/);
  });

  it('activates a key once and binds it to the guild', async () => {
    const key = await one({ tier: 'starter' });
    const check = await activate(key, 'g1');
    expect(check.kind).toBe('setup');
    const license = (await service.find(key))!;
    expect(license.status).toBe('active');
    expect(license.guildId).toBe('g1');
    expect(license.activatedBy).toBe('u1');
    expect((await db.guilds.get('g1'))!.tier).toBe('starter');
  });

  it('allows re-running in the same guild (resync) but rejects other guilds', async () => {
    const key = await one({ tier: 'pro' });
    await activate(key, 'g1');
    const again = await service.checkActivation(key, { guildId: 'g1', userId: 'u1' });
    expect(again.kind).toBe('resync');
    await expect(service.checkActivation(key, { guildId: 'g2', userId: 'u2' })).rejects.toThrow(
      /already been activated in another server/,
    );
  });

  it('is race-safe: a key cannot bind to two guilds', async () => {
    const key = await one({ tier: 'pro' });
    const c1 = await service.checkActivation(key, { guildId: 'g1', userId: 'u1' });
    const c2 = await service.checkActivation(key, { guildId: 'g2', userId: 'u2' });
    await service.activate(c1.license, 'g1', 'u1');
    await expect(service.activate(c2.license, 'g2', 'u2')).rejects.toThrow(
      /just activated somewhere else/,
    );
    // Same guild is idempotent
    await expect(service.activate(c1.license, 'g1', 'u1')).resolves.toMatchObject({
      guildId: 'g1',
    });
  });

  it('upgrades to a higher tier and records the new tier', async () => {
    const starter = await one({ tier: 'starter' });
    const elite = await one({ tier: 'elite' });
    await activate(starter, 'g1');
    const check = await activate(elite, 'g1');
    expect(check.kind).toBe('upgrade');
    expect(check.previousTier).toBe('starter');
    const guild = (await db.guilds.get('g1'))!;
    expect(guild.tier).toBe('elite');
    expect(guild.licenseId).toBe(check.license.id);

    // Re-using the old starter key now resyncs with the guild's current (elite) license
    const resync = await service.checkActivation(starter, { guildId: 'g1', userId: 'u1' });
    expect(resync.kind).toBe('resync');
    expect(resync.license.tier).toBe('elite');
  });

  it('rejects downgrades and same-tier duplicates without consuming the key', async () => {
    const pro = await one({ tier: 'pro' });
    const starter = await one({ tier: 'starter' });
    const pro2 = await one({ tier: 'pro' });
    await activate(pro, 'g1');
    await expect(service.checkActivation(starter, { guildId: 'g1', userId: 'u1' })).rejects.toThrow(
      /already has \*\*Pro\*\*/,
    );
    await expect(service.checkActivation(pro2, { guildId: 'g1', userId: 'u1' })).rejects.toThrow(
      /already has \*\*Pro\*\*/,
    );
    expect((await service.find(starter))!.status).toBe('unused');
    expect((await service.find(pro2))!.status).toBe('unused');
  });

  it('treats a same-tier themed key as an upgrade (theme switch)', async () => {
    const elite = await one({ tier: 'elite' });
    const gaming = await one({ tier: 'elite', templateId: 'gaming' });
    await activate(elite, 'g1');
    const check = await service.checkActivation(gaming, { guildId: 'g1', userId: 'u1' });
    expect(check.kind).toBe('upgrade');
    expect(check.templateId).toBe('gaming');
  });

  it('revokes by key or id and lists by status', async () => {
    const generated = await service.generate({ tier: 'starter', count: 2 });
    await service.revoke(generated[0]!.license.id);
    expect((await service.list({ status: 'revoked' })).length).toBe(1);
    expect((await service.list({ status: 'unused' })).length).toBe(1);
    await expect(service.revoke('nope')).rejects.toThrow(/No license found/);
    expect(LicenseService.mask(generated[0]!.license)).toMatch(/^FORGE-\*{4}-\*{4}-.{4}$/);
  });

  it('counts failed attempts towards the rate limit and locks out', async () => {
    const guard = new KeyAttemptGuard({ perUser: 3, perGuild: 10, windowMs: 60_000 });
    for (let i = 0; i < 3; i += 1) {
      await expect(
        service.checkActivation('FORGE-AAAA-BBBB-CCCC', { guildId: 'g', userId: 'u', guard }),
      ).rejects.toThrow(/couldn't find/);
    }
    const key = await one({ tier: 'starter' });
    await expect(
      service.checkActivation(key, { guildId: 'g', userId: 'u', guard }),
    ).rejects.toThrow(/Too many invalid key attempts/);
    // A different user in the same guild is still allowed
    await expect(
      service.checkActivation(key, { guildId: 'g', userId: 'other', guard }),
    ).resolves.toMatchObject({
      kind: 'setup',
    });
  });
});

describe('payments stub', () => {
  it('fulfils a purchase by generating and delivering keys', async () => {
    const db = createMemoryDatabase();
    const licenses = new LicenseService(db.licenses, db.guilds, PEPPER, registry);
    const delivered: string[][] = [];
    const keys = await fulfilPurchase(
      { orderId: 'o1', buyerEmail: 'buyer@example.com', tier: 'pro', quantity: 2 },
      { licenses, delivery: { deliver: async (_to, k) => void delivered.push(k) } },
    );
    expect(keys).toHaveLength(2);
    expect(delivered[0]).toEqual(keys);
    await expect(new StripeProviderStub().parseWebhook()).rejects.toThrow(/not implemented/);
  });
});
