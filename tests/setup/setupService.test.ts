import { beforeEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { createMemoryDatabase } from '../../src/db/memory.js';
import { silentLogger } from '../../src/logger.js';
import { LicenseService } from '../../src/services/license/licenseService.js';
import { KeyAttemptGuard } from '../../src/services/rateLimit/rateLimiter.js';
import { SetupService, type GuildContext } from '../../src/services/setup/setupService.js';
import { loadTemplates } from '../../src/services/template/loader.js';
import { TemplateRegistry } from '../../src/services/template/registry.js';
import { FakeGuild } from '../fakes/fakeGuild.js';
import { instantQueue } from '../builder/setup.js';

const registry = new TemplateRegistry(await loadTemplates(path.resolve('templates')));

function context(fake: FakeGuild, name = 'My Server'): GuildContext {
  return {
    id: fake.guildId,
    name,
    ownerId: 'owner',
    ownerName: 'Owner',
    gateway: fake,
    snapshot: async (t) => fake.snapshot(t),
  };
}

describe('SetupService', () => {
  let db: ReturnType<typeof createMemoryDatabase>;
  let licenses: LicenseService;
  let setup: SetupService;
  let now: Date;

  beforeEach(() => {
    db = createMemoryDatabase();
    licenses = new LicenseService(db.licenses, db.guilds, 'pepper-for-tests-123', registry);
    now = new Date('2026-11-10T12:00:00Z');
    setup = new SetupService({
      db,
      licenses,
      templates: registry,
      keyGuard: new KeyAttemptGuard({ perUser: 3, perGuild: 10, windowMs: 60_000 }),
      installers: {},
      logger: silentLogger,
      queueFactory: instantQueue,
      now: () => now,
    });
  });

  const key = async (tier: 'starter' | 'pro' | 'elite') =>
    (await licenses.generate({ tier }))[0]!.key;

  async function fullSetup(
    fake: FakeGuild,
    rawKey: string,
    opts: { mode?: 'alongside' | 'clean'; confirmation?: string } = {},
  ) {
    const guild = context(fake);
    const { session } = await setup.start({ guild, userId: 'owner', rawKey, dryRun: false });
    const options = setup.parseOptions({
      serverName: 'Pixel Pals',
      brandColor: 'ff0066',
      mode: opts.mode ?? 'alongside',
      confirmation: opts.confirmation,
    });
    const preview = await setup.submitOptions(session.id, guild, 'owner', options);
    const outcome = await setup.confirm({ sessionId: session.id, guild, userId: 'owner' });
    return { preview, outcome, guild };
  }

  it('runs the whole flow: key → options → preview → confirm → build', async () => {
    const fake = new FakeGuild();
    const k = await key('pro');
    const { preview, outcome } = await fullSetup(fake, k);
    expect(preview.check.kind).toBe('setup');
    expect(preview.options).toEqual({
      serverName: 'Pixel Pals',
      brandColor: '#FF0066',
      mode: 'alongside',
    });
    expect(preview.preflight.ok).toBe(true);
    expect(outcome.result.status).toBe('succeeded');
    expect(outcome.run.status).toBe('succeeded');
    const guild = (await db.guilds.get(fake.guildId))!;
    expect(guild).toMatchObject({ tier: 'pro', templateId: 'pro' });
    expect(guild.builtAt).toEqual(now);
    expect((await licenses.find(k))!.status).toBe('active');
    // Placeholders rendered with the customer's options
    const titles = [...fake.messages.values()].map((m) => m.payload.embeds?.[0]?.title);
    expect(titles).toContain('Welcome to Pixel Pals! 👋');
  });

  it('dry-run previews with defaults and never binds the key', async () => {
    const fake = new FakeGuild();
    const k = await key('elite');
    const guild = context(fake);
    const { session } = await setup.start({ guild, userId: 'owner', rawKey: k, dryRun: true });
    const preview = await setup.preview(session, guild);
    expect(preview.options).toEqual({
      serverName: 'My Server',
      brandColor: '#5865F2',
      mode: 'alongside',
    });
    expect(preview.plan.summary.create.channels).toBeGreaterThan(15);
    await expect(setup.confirm({ sessionId: session.id, guild, userId: 'owner' })).rejects.toThrow(
      /dry run/,
    );
    expect((await licenses.find(k))!.status).toBe('unused');
    expect(fake.calls).toEqual([]);
  });

  it('validates options and requires typed confirmation for clean builds', () => {
    expect(() =>
      setup.parseOptions({ serverName: 'x', brandColor: '#fff', mode: 'alongside' }),
    ).toThrow(/between 2 and 100/);
    expect(() =>
      setup.parseOptions({ serverName: 'Okay', brandColor: 'blue', mode: 'alongside' }),
    ).toThrow(/valid hex colour/);
    expect(() =>
      setup.parseOptions({
        serverName: 'Okay',
        brandColor: '#fff',
        mode: 'clean',
        confirmation: 'yes',
      }),
    ).toThrow(/type `CLEAN BUILD` exactly/);
    expect(
      setup.parseOptions({
        serverName: 'Okay',
        brandColor: '#fff',
        mode: 'clean',
        confirmation: ' clean build ',
      }).mode,
    ).toBe('clean');
  });

  it('restricts sessions to the same user, guild and lifetime', async () => {
    const fake = new FakeGuild();
    const guild = context(fake);
    const { session } = await setup.start({
      guild,
      userId: 'owner',
      rawKey: await key('starter'),
      dryRun: false,
    });
    await expect(setup.getSession(session.id, fake.guildId, 'intruder')).rejects.toThrow(
      /Only the person who ran/,
    );
    await expect(setup.getSession(session.id, 'other-guild', 'owner')).rejects.toThrow(
      /another server/,
    );
    now = new Date(now.getTime() + 31 * 60 * 1000);
    await expect(setup.getSession(session.id, fake.guildId, 'owner')).rejects.toThrow(/expired/);
  });

  it('blocks confirm when pre-flight fails and leaves the key unused', async () => {
    const fake = new FakeGuild();
    fake.isAdmin = false;
    fake.botPermissions = 0n;
    const k = await key('starter');
    const guild = context(fake);
    const { session } = await setup.start({ guild, userId: 'owner', rawKey: k, dryRun: false });
    await setup.submitOptions(
      session.id,
      guild,
      'owner',
      setup.parseOptions({ serverName: 'Abc', brandColor: '#000000', mode: 'alongside' }),
    );
    await expect(setup.confirm({ sessionId: session.id, guild, userId: 'owner' })).rejects.toThrow(
      /Pre-flight|problems need fixing/,
    );
    expect((await licenses.find(k))!.status).toBe('unused');
  });

  it('upgrades an existing build and re-syncs with the same key', async () => {
    const fake = new FakeGuild();
    const starter = await key('starter');
    await fullSetup(fake, starter);
    const before = fake.channels.size;

    const { preview, outcome } = await fullSetup(fake, await key('elite'));
    expect(preview.check.kind).toBe('upgrade');
    expect(preview.plan.summary.remove).toEqual({ roles: 0, channels: 0 });
    expect(outcome.result.status).toBe('succeeded');
    expect(fake.channels.size).toBeGreaterThan(before);
    expect((await db.guilds.get(fake.guildId))!.tier).toBe('elite');

    // Same old key → resync of the current (elite) license, nothing to create
    const again = await fullSetup(fake, starter);
    expect(again.preview.check.kind).toBe('resync');
    expect(again.preview.plan.summary.create).toEqual({
      roles: 0,
      categories: 0,
      channels: 0,
      messages: 0,
    });
  });

  it('/forge resync repairs deleted resources', async () => {
    const fake = new FakeGuild();
    await expect(setup.previewResync(context(fake))).rejects.toThrow(/hasn't been set up/);
    await fullSetup(fake, await key('starter'));
    fake.channels.delete(fake.channelByName('general')!.id);
    const outcome = await setup.resync(context(fake), 'owner');
    expect(outcome.result.status).toBe('succeeded');
    expect(outcome.run.kind).toBe('resync');
    expect(fake.channelByName('general')).toBeDefined();
  });

  it('offers rollback of a failed build', async () => {
    const fake = new FakeGuild();
    let n = 0;
    fake.failOn = (m) =>
      m === 'createChannel' && ++n === 3
        ? Object.assign(new Error('Missing Access'), { code: 50001 })
        : undefined;
    const { outcome } = await fullSetup(fake, await key('starter'));
    expect(outcome.result.status).toBe('failed');
    expect(outcome.result.error).toMatch(/can't access a channel/);
    fake.failOn = undefined;
    await expect(setup.rollback(outcome.run.id, context(fake), 'stranger')).rejects.toThrow(
      /Only the person/,
    );
    const rb = await setup.rollback(outcome.run.id, context(fake), 'owner');
    expect(rb.deleted).toBeGreaterThan(0);
    expect(fake.channels.size).toBe(0);
  });

  it('resumes builds that were running when the bot stopped', async () => {
    const fake = new FakeGuild();
    const k = await key('starter');
    // Simulate a crash: activate + a run stuck in "running" with part of the server built
    const guild = context(fake);
    const { session } = await setup.start({ guild, userId: 'owner', rawKey: k, dryRun: false });
    let n = 0;
    fake.failOn = (m) => (m === 'createChannel' && ++n === 2 ? new Error('crash') : undefined);
    await setup.submitOptions(
      session.id,
      guild,
      'owner',
      setup.parseOptions({ serverName: 'Abc', brandColor: '#000000', mode: 'alongside' }),
    );
    const { run } = await setup.confirm({ sessionId: session.id, guild, userId: 'owner' });
    await db.runs.update(run.id, { status: 'running' });
    fake.failOn = undefined;

    const done: string[] = [];
    const resumed = await setup.resumeInterrupted(
      async () => guild,
      async (o) => void done.push(o.result.status),
    );
    expect(resumed).toBe(1);
    expect(done).toEqual(['succeeded']);
    expect((await db.runs.get(run.id))!.status).toBe('interrupted');
    expect(fake.channelByName('general')).toBeDefined();
  });

  it('counts bad keys toward the rate limit', async () => {
    const guild = context(new FakeGuild());
    for (let i = 0; i < 3; i += 1) {
      await expect(
        setup.start({ guild, userId: 'u', rawKey: 'FORGE-AAAA-AAAA-AAAA', dryRun: false }),
      ).rejects.toThrow(/couldn't find/);
    }
    await expect(
      setup.start({ guild, userId: 'u', rawKey: await key('pro'), dryRun: false }),
    ).rejects.toThrow(/Too many/);
  });
});
