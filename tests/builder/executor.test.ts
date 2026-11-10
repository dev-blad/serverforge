import { describe, expect, it } from 'vitest';
import { silentLogger } from '../../src/logger.js';
import { rollbackRun } from '../../src/services/builder/rollback.js';
import { describeError, isUnknownResource } from '../../src/services/builder/discordErrors.js';
import { BuildExecutor } from '../../src/services/builder/executor.js';
import { RetryError } from '../../src/services/builder/queue.js';
import { FakeGuild } from '../fakes/fakeGuild.js';
import { harness, instantQueue, rendered } from './setup.js';

describe('BuildExecutor', () => {
  it('builds Elite end to end and tracks every resource', async () => {
    const h = harness();
    const { result, plan, runId } = await h.build('elite');
    expect(result.status).toBe('succeeded');
    expect(result.completed).toBe(plan.actions.length);
    const records = await h.db.resources.list(h.guild.guildId);
    const t = rendered('elite');
    expect(records.filter((r) => r.kind === 'role')).toHaveLength(t.roles.length);
    expect(records.filter((r) => r.kind === 'category')).toHaveLength(t.categories.length);
    expect(records.filter((r) => r.kind === 'message')).toHaveLength(t.messages.length);
    expect(records.every((r) => r.runId === runId || r.runId === null)).toBe(true);
    const run = await h.db.runs.get(runId);
    expect(run).toMatchObject({
      status: 'succeeded',
      completed: plan.actions.length,
      total: plan.actions.length,
    });

    // Embeds have real mentions and the brand colour
    const welcome = [...h.guild.messages.values()].find(
      (m) => m.payload.embeds?.[0]?.title === 'Welcome to Test Server! 👋',
    )!;
    const rulesId = h.guild.channelByName('rules')!.id;
    expect(welcome.payload.embeds![0]!.description).toContain(`<#${rulesId}>`);
    expect(welcome.payload.embeds![0]!.color).toBe(0xff8800);
    // Rules embed is pinned
    expect([...h.guild.messages.values()].some((m) => m.pinned)).toBe(true);
    // Elite owner role gets the brand colour
    expect(h.guild.roleByName('Owner')!.color).toBe(0xff8800);
    // Roles are ordered as in the template
    const owner = h.guild.roleByName('Owner')!.position;
    const member = h.guild.roleByName('Member')!.position;
    expect(owner).toBeGreaterThan(member);
    expect(h.guild.botPosition).toBeGreaterThan(owner);
  });

  it('falls back to text/voice when Community cannot be enabled', async () => {
    const guild = new FakeGuild();
    guild.enableCommunity = async () => false;
    const h = harness(guild);
    const { result } = await h.build('elite');
    expect(result.status).toBe('succeeded');
    expect(result.warnings.join('\n')).toMatch(/didn't allow enabling Community/);
    expect(guild.channelByName('announcements')!.type).toBe('text');
    expect(guild.channelByName('Event Stage')!.type).toBe('voice');
  });

  it('calls module installers and stores their resolved config', async () => {
    const h = harness();
    const { result } = await h.build('starter', {
      installers: {
        autoRole: async (ctx) => ({ memberRoleId: ctx.ids.roles['member'] }),
      },
    });
    expect(result.status).toBe('succeeded');
    const mod = await h.db.modules.get(h.guild.guildId, 'autoRole');
    expect(mod).toMatchObject({
      enabled: true,
      config: { memberRoleId: h.guild.roleByName('Member')!.id },
    });
  });

  it('reports progress per phase', async () => {
    const h = harness();
    const p = await h.planFor('starter');
    const updates: string[] = [];
    const run = await h.db.runs.create({
      guildId: 'g1',
      licenseId: null,
      templateId: 'starter',
      tier: 'starter',
      kind: 'setup',
      mode: 'alongside',
      status: 'running',
      options: { serverName: 'x', brandColor: '#000000', mode: 'alongside' },
      userId: 'u',
    });
    await new BuildExecutor({
      gateway: h.guild,
      db: h.db,
      queue: instantQueue(),
      logger: silentLogger,
      installers: {},
    }).execute({
      run,
      plan: p,
      template: rendered('starter'),
      communityEnabled: false,
      reporter: { update: (u) => void updates.push(`${u.label} ${u.phaseDone}/${u.phaseTotal}`) },
    });
    expect(updates).toContain('Creating roles 1/6');
    expect(updates).toContain('Creating channels 7/8');
    expect(updates.at(-1)).toBe('Setting up modules 1/1');
  });

  it('stops on failure, records the error and can be rolled back', async () => {
    const guild = new FakeGuild();
    guild.addRole('Moderator'); // adopted → must survive rollback
    let channelsCreated = 0;
    guild.failOn = (method) => {
      if (method === 'createChannel' && ++channelsCreated === 6) {
        return Object.assign(new Error('Missing Permissions'), { code: 50013, status: 403 });
      }
      return undefined;
    };
    const h = harness(guild);
    const { result, runId } = await h.build('pro');
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/Failed to create .* missing a permission/);
    const run = await h.db.runs.get(runId);
    expect(run!.status).toBe('failed');
    expect(guild.everyonePermissions).not.toBe(0n);

    guild.failOn = undefined;
    const createdRoles = guild.roles.size;
    expect(createdRoles).toBeGreaterThan(2);
    const rb = await rollbackRun(runId, {
      db: h.db,
      gateway: guild,
      queue: instantQueue(),
      logger: silentLogger,
    });
    expect(rb.failed).toEqual([]);
    expect(rb.restored).toBe(1); // @everyone permissions
    expect(guild.channels.size).toBe(0);
    expect([...guild.roles.values()].map((r) => r.name).sort()).toEqual([
      'Moderator',
      'ServerForge',
    ]);
    expect((await h.db.runs.get(runId))!.status).toBe('rolled_back');
    // Only the adopted role remains tracked
    expect((await h.db.resources.list(guild.guildId)).map((r) => r.key)).toEqual([
      'role:moderator',
    ]);
    await expect(
      rollbackRun(runId, { db: h.db, gateway: guild, queue: instantQueue(), logger: silentLogger }),
    ).rejects.toThrow(/already rolled back/);
  });

  it('resumes an interrupted build without duplicating anything', async () => {
    const guild = new FakeGuild();
    let n = 0;
    guild.failOn = (method) =>
      method === 'createChannel' && ++n === 4 ? new Error('process crashed') : undefined;
    const h = harness(guild);
    expect((await h.build('starter')).result.status).toBe('failed');
    guild.failOn = undefined;
    const resumed = await h.build('starter', { kind: 'resync' });
    expect(resumed.result.status).toBe('succeeded');
    expect(resumed.plan.summary.create.roles).toBe(0);
    expect(guild.channels.size).toBe(3 + 7);
    const names = [...guild.channels.values()].map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('clean mode deletes old channels first and untracks them', async () => {
    const guild = new FakeGuild();
    const h = harness(guild);
    await h.build('starter');
    const oldIds = [...guild.channels.keys()];
    const { result } = await h.build('starter', { mode: 'clean' });
    expect(result.status).toBe('succeeded');
    expect([...guild.channels.keys()].some((id) => oldIds.includes(id))).toBe(false);
    expect(guild.channels.size).toBe(10);
    const tracked = await h.db.resources.list(guild.guildId);
    expect(
      tracked.every(
        (r) =>
          r.kind === 'message' ||
          r.kind === 'everyone' ||
          guild.channels.has(r.discordId) ||
          guild.roles.has(r.discordId),
      ),
    ).toBe(true);
  });
});

describe('discord error helpers', () => {
  it('explains common Discord errors', () => {
    expect(describeError(Object.assign(new Error('x'), { code: 50013 }))).toMatch(
      /missing a permission/,
    );
    expect(describeError(new RetryError('x', 5, new Error('boom')))).toMatch(/5 attempts/);
    expect(describeError(new Error('plain'))).toBe('plain');
    expect(isUnknownResource(Object.assign(new Error('x'), { code: 10003 }))).toBe(true);
    expect(
      isUnknownResource(new RetryError('x', 2, Object.assign(new Error('x'), { code: 10011 }))),
    ).toBe(true);
    expect(isUnknownResource(new Error('x'))).toBe(false);
  });
});
