import { describe, expect, it } from 'vitest';
import { moduleInstallers } from '../../src/modules/index.js';
import { rollbackRun } from '../../src/services/builder/rollback.js';
import { silentLogger } from '../../src/logger.js';
import { FakeGuild } from '../fakes/fakeGuild.js';
import { harness, instantQueue } from '../builder/setup.js';

describe('module installers (via the executor)', () => {
  it('installs every Elite module and stores resolved config', async () => {
    const guild = new FakeGuild();
    const humans = [guild.addMember(), guild.addMember()];
    guild.addMember(true);
    const h = harness(guild);
    const { result } = await h.build('elite', { installers: moduleInstallers });
    expect(result.status).toBe('succeeded');
    expect(result.warnings).toEqual([]);

    const modules = await h.db.modules.list(guild.guildId);
    expect(modules.map((m) => m.moduleId).sort()).toEqual(
      [
        'autoRole',
        'automod',
        'buttonRoles',
        'logging',
        'memberStats',
        'tickets',
        'verification',
      ].sort(),
    );

    // Verification: panel with a persistent button, existing humans verified once
    const member = guild.roleByName('Member')!;
    const verification = modules.find((m) => m.moduleId === 'verification')!.config;
    expect(verification['roleId']).toBe(member.id);
    expect(verification['seededAt']).toBeTruthy();
    expect(humans.every((m) => m.roles.has(member.id))).toBe(true);
    const verifyPanel = [...guild.messages.values()].find(
      (m) => m.payload.buttons?.[0]?.customId === 'sf:verify:go',
    );
    expect(verifyPanel?.channelId).toBe(guild.channelByName('verify')!.id);

    // Button roles: 3 panels, exclusive regions
    const br = modules.find((m) => m.moduleId === 'buttonRoles')!.config as {
      panels: Record<string, { exclusive: boolean; buttons: Record<string, string> }>;
    };
    expect(Object.keys(br.panels)).toEqual(['pronouns', 'regions', 'notifications']);
    expect(br.panels['regions']!.exclusive).toBe(true);
    expect(br.panels['pronouns']!.buttons['he']).toBe(guild.roleByName('he/him')!.id);
    expect(
      [...guild.messages.values()].some((m) =>
        m.payload.buttons?.some((b) => b.customId === 'sf:br:t:regions:eu'),
      ),
    ).toBe(true);

    // AutoMod: 4 native rules, alerts to mod-log, moderators exempt
    expect(guild.automod.size).toBe(4);
    const modLog = guild.channelByName('mod-log')!.id;
    expect([...guild.automod.values()].every((r) => r.alertChannelId === modLog)).toBe(true);

    // Tickets: panel + resolved ids
    const tickets = modules.find((m) => m.moduleId === 'tickets')!.config;
    expect(tickets['categoryId']).toBe(guild.channelByName('🎫 Tickets')!.id);
    expect(tickets['staffRoleIds']).toEqual([
      guild.roleByName('Moderator')!.id,
      guild.roleByName('Support Team')!.id,
    ]);

    // Member stats channel renamed with the human count
    expect(guild.channelByName('👥 Members: 2')).toBeDefined();
  });

  it('is idempotent: re-running does not duplicate panels, rules or member seeding', async () => {
    const guild = new FakeGuild();
    const h = harness(guild);
    await h.build('elite', { installers: moduleInstallers });
    const messages = guild.messages.size;
    const rules = guild.automod.size;
    guild.calls.length = 0;
    const again = await h.build('elite', { kind: 'resync', installers: moduleInstallers });
    expect(again.result.status).toBe('succeeded');
    expect(guild.messages.size).toBe(messages);
    expect(guild.automod.size).toBe(rules);
    expect(guild.calls.filter((c) => c === 'addRoleToAllHumans')).toHaveLength(0);
    expect(guild.calls.filter((c) => c === 'sendMessage')).toHaveLength(0);
  });

  it('re-posts a deleted panel and recreates a deleted AutoMod rule on resync', async () => {
    const guild = new FakeGuild();
    const h = harness(guild);
    await h.build('pro', { installers: moduleInstallers });
    const verifyMsg = [...guild.messages.entries()].find(
      ([, m]) => m.payload.buttons?.[0]?.customId === 'sf:verify:go',
    )!;
    guild.messages.delete(verifyMsg[0]);
    guild.automod.delete([...guild.automod.keys()][0]!);
    await h.build('pro', { kind: 'resync', installers: moduleInstallers });
    expect(
      [...guild.messages.values()].filter(
        (m) => m.payload.buttons?.[0]?.customId === 'sf:verify:go',
      ),
    ).toHaveLength(1);
    expect(guild.automod.size).toBe(4);
  });

  it('skips AutoMod rules Discord refuses with a warning instead of failing', async () => {
    const guild = new FakeGuild();
    guild.failOn = (method, arg) =>
      method === 'createAutomodRule' && (arg as { type: string }).type === 'spam'
        ? Object.assign(new Error('Maximum number of rules reached'), { code: 30032, status: 400 })
        : undefined;
    const h = harness(guild);
    const { result } = await h.build('pro', { installers: moduleInstallers });
    expect(result.status).toBe('succeeded');
    expect(result.warnings.join()).toMatch(/AutoMod rule "ServerForge: Spam" was skipped/);
    expect(guild.automod.size).toBe(3);
  });

  it('rollback removes module panels and AutoMod rules too', async () => {
    const guild = new FakeGuild();
    const h = harness(guild);
    const { runId } = await h.build('elite', { installers: moduleInstallers });
    // pretend it failed so it can be rolled back
    await h.db.runs.update(runId, { status: 'failed' });
    const rb = await rollbackRun(runId, {
      db: h.db,
      gateway: guild,
      queue: instantQueue(),
      logger: silentLogger,
    });
    expect(rb.failed).toEqual([]);
    expect(guild.automod.size).toBe(0);
    expect(guild.messages.size).toBe(0);
    expect(guild.channels.size).toBe(0);
    expect(guild.features.has('COMMUNITY')).toBe(false);
    expect((await h.db.modules.list(guild.guildId)).every((m) => !m.enabled)).toBe(true);
  });
});
