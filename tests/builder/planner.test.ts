import { describe, expect, it } from 'vitest';
import { PermissionFlagsBits } from 'discord.js';
import { overwritesDiffer, normalizeChannelName } from '../../src/services/builder/planner.js';
import {
  effectiveOverwrites,
  permissionsToBits,
  bitsToPermissions,
  permissionsUsedBy,
} from '../../src/services/builder/permissions.js';
import { FakeGuild } from '../fakes/fakeGuild.js';
import { harness, rendered } from './setup.js';

const types = (p: { actions: { type: string }[] }) => p.actions.map((a) => a.type);
const count = (p: { actions: { type: string }[] }, type: string) =>
  p.actions.filter((a) => a.type === type).length;

describe('planner — fresh guild', () => {
  it('plans every Starter resource in build order', async () => {
    const h = harness();
    const p = await h.planFor('starter');
    const t = rendered('starter');
    expect(p.summary.create.roles).toBe(t.roles.length);
    expect(p.summary.create.categories).toBe(t.categories.length);
    expect(p.summary.create.channels).toBe(7);
    expect(p.summary.create.messages).toBe(2);
    expect(p.summary.modules).toEqual(['autoRole']);
    expect(p.summary.remove).toEqual({ roles: 0, channels: 0 });

    // roles → categories → channels → messages → modules
    const phases = p.actions.map((a) => a.phase);
    const order = ['roles', 'categories', 'channels', 'messages', 'modules'];
    const firstIndex = order.map((ph) => phases.indexOf(ph as never));
    expect([...firstIndex].sort((a, b) => a - b)).toEqual(firstIndex);
    expect(types(p)).toContain('orderRoles');
    expect(types(p)).toContain('orderChannels');
  });

  it('puts community-only channels after enabling Community for Elite', async () => {
    const p = await harness().planFor('elite');
    const community = p.actions.findIndex((a) => a.type === 'enableCommunity');
    const stage = p.actions.findIndex((a) => a.type === 'createChannel' && a.spec.type === 'stage');
    const announcement = p.actions.findIndex(
      (a) => a.type === 'createChannel' && a.spec.type === 'announcement',
    );
    const rules = p.actions.findIndex((a) => a.type === 'createChannel' && a.key === 'rules');
    expect(community).toBeGreaterThan(rules);
    expect(stage).toBeGreaterThan(community);
    expect(announcement).toBeGreaterThan(community);
    expect(p.summary.enableCommunity).toBe(true);
    expect(p.summary.channelsByType).toMatchObject({ stage: 1, announcement: 1, forum: 1 });
  });

  it('merges category overwrites into channel overwrites', async () => {
    const p = await harness().planFor('elite');
    const logs = p.actions.find((a) => a.type === 'createChannel' && a.key === 'ticket-logs');
    expect(
      logs && logs.type === 'createChannel'
        ? logs.overwrites.find((o) => o.role === 'moderator')?.deny
        : null,
    ).toEqual(['SendMessages']);
    const chat = p.actions.find((a) => a.type === 'createChannel' && a.key === 'staff-chat');
    expect(chat && chat.type === 'createChannel' ? chat.overwrites.map((o) => o.role) : []).toEqual(
      ['everyone', 'member', 'moderator', 'support'],
    );
  });
});

describe('planner — idempotency & resync', () => {
  it('re-planning after a successful build creates nothing', async () => {
    const h = harness();
    const { result } = await h.build('pro');
    expect(result.status).toBe('succeeded');
    const again = await h.planFor('pro', { kind: 'resync' });
    expect(again.summary.create).toEqual({ roles: 0, categories: 0, channels: 0, messages: 0 });
    expect(count(again, 'syncOverwrites')).toBe(0);
    expect(count(again, 'updateEveryone')).toBe(0);
    expect(count(again, 'orderRoles')).toBe(0);
    expect(types(again).every((t) => t === 'applyModule')).toBe(true);
  });

  it('repairs only deleted resources and leaves custom additions alone', async () => {
    const h = harness();
    await h.build('starter');
    const general = h.guild.channelByName('general')!;
    const modRole = h.guild.roleByName('Moderator')!;
    h.guild.channels.delete(general.id);
    h.guild.roles.delete(modRole.id);
    const custom = h.guild.addChannel('my-custom-channel', 'text', general.parentId);
    const welcomeMsg = [...h.guild.messages.entries()].find(([, m]) =>
      m.payload.embeds?.[0]?.title?.startsWith('Welcome'),
    )!;
    h.guild.messages.delete(welcomeMsg[0]);

    const p = await h.planFor('starter', { kind: 'resync' });
    expect(
      p.actions
        .filter((a) => a.type === 'createChannel')
        .map((a) => (a.type === 'createChannel' ? a.key : '')),
    ).toEqual(['general']);
    expect(
      p.actions
        .filter((a) => a.type === 'createRole')
        .map((a) => (a.type === 'createRole' ? a.key : '')),
    ).toEqual(['moderator']);
    expect(
      p.actions
        .filter((a) => a.type === 'postMessage')
        .map((a) => (a.type === 'postMessage' ? a.key : '')),
    ).toEqual(['welcome']);
    // the info category grants moderator SendMessages; the role is gone so its overwrite must be repaired
    expect(p.actions.some((a) => a.type === 'syncOverwrites' && a.key === 'info')).toBe(true);
    expect(JSON.stringify(p.actions)).not.toContain(custom.id);
  });

  it('adopts existing same-name roles and channels instead of duplicating (alongside mode)', async () => {
    const guild = new FakeGuild();
    guild.addRole('moderator');
    const cat = guild.addChannel('💬 Community', 'category');
    guild.addChannel('general', 'text', cat.id);
    guild.addChannel('general', 'text', null); // wrong parent → not adopted
    const p = await harness(guild).planFor('starter');
    expect(p.adoptions.map((a) => a.key).sort()).toEqual([
      'channel:community',
      'channel:general',
      'role:moderator',
    ]);
    expect(p.summary.create.roles).toBe(4);
    expect(p.resolved.channels['general']).toBe(
      guild.channelByName('general') &&
        [...guild.channels.values()].find((c) => c.parentId === cat.id)!.id,
    );
  });

  it('upgrades Starter → Pro by adding only the difference', async () => {
    const h = harness();
    await h.build('starter');
    const before = h.guild.channels.size;
    const p = await h.planFor('pro', { kind: 'upgrade' });
    expect(p.summary.create.roles).toBe(12); // pronoun, region & ping roles
    expect(p.summary.create.channels).toBe(5); // verify, get-roles, suggestions, mod-log, join-leave
    expect(p.summary.create.categories).toBe(2); // start, moderation
    expect(p.summary.keep.channels).toBe(7);
    expect(p.summary.updateEveryone).toBe(true);
    expect(count(p, 'deleteChannel') + count(p, 'deleteRole')).toBe(0);
    const { result } = await h.build('pro', { kind: 'upgrade' });
    expect(result.status).toBe('succeeded');
    expect(h.guild.channels.size).toBe(before + 7);
  });

  it('upgrades Pro → Elite converting announcements to a followable channel', async () => {
    const h = harness();
    await h.build('pro');
    const p = await h.planFor('elite', { kind: 'upgrade' });
    expect(types(p)).toContain('convertToAnnouncement');
    expect(p.summary.conversions).toBe(1);
    const { result } = await h.build('elite', { kind: 'upgrade' });
    expect(result.status).toBe('succeeded');
    expect(h.guild.channelByName('announcements')!.type).toBe('announcement');
    expect(h.guild.features.has('COMMUNITY')).toBe(true);
  });
});

describe('planner — clean mode', () => {
  it('deletes what the bot can, keeps protected things and never adopts', async () => {
    const guild = new FakeGuild();
    const oldCat = guild.addChannel('Old', 'category');
    const keep = guild.addChannel('setup-here', 'text', oldCat.id);
    guild.addChannel('general', 'text', null);
    guild.addChannel('locked', 'text', null, { deletable: false });
    guild.addRole('Moderator');
    guild.addRole('Above Bot', { position: 50 });
    guild.addRole('Some Integration', { managed: true });

    const p = await harness(guild).planFor('starter', {
      mode: 'clean',
      preserveChannelId: keep.id,
    });
    const deletedChannels = p.actions
      .filter((a) => a.type === 'deleteChannel')
      .map((a) => (a.type === 'deleteChannel' ? a.name : ''));
    expect(deletedChannels).toEqual(['general']);
    const deletedRoles = p.actions
      .filter((a) => a.type === 'deleteRole')
      .map((a) => (a.type === 'deleteRole' ? a.name : ''));
    expect(deletedRoles).toEqual(['Moderator']);
    expect(p.adoptions).toEqual([]);
    expect(p.summary.create.roles).toBe(5);
    expect(p.warnings.join('\n')).toMatch(/keep 3 channel/);
    expect(p.warnings.join('\n')).toMatch(/Above Bot/);
    // cleanup happens first
    expect(p.actions[0]!.phase).toBe('cleanup');
  });
});

describe('overwrites & permissions helpers', () => {
  it('detects overwrite differences only for template targets', () => {
    const channel = {
      id: 'c',
      name: 'x',
      type: 'text' as const,
      parentId: null,
      position: 0,
      deletable: true,
      overwrites: [
        {
          id: 'g1',
          type: 'role' as const,
          allow: '0',
          deny: PermissionFlagsBits.SendMessages.toString(),
        },
        { id: 'custom', type: 'role' as const, allow: '8', deny: '0' },
      ],
    };
    expect(
      overwritesDiffer(
        channel,
        [{ role: 'everyone', allow: [], deny: ['SendMessages'] }],
        {},
        'g1',
      ),
    ).toBe(false);
    expect(
      overwritesDiffer(channel, [{ role: 'everyone', allow: [], deny: ['ViewChannel'] }], {}, 'g1'),
    ).toBe(true);
    expect(
      overwritesDiffer(channel, [{ role: 'mod', allow: ['ViewChannel'], deny: [] }], {}, 'g1'),
    ).toBe(true);
    expect(
      overwritesDiffer(channel, [{ role: 'mod', allow: [], deny: [] }], { mod: 'm' }, 'g1'),
    ).toBe(false);
  });

  it('converts permissions both ways and merges overwrites', () => {
    const bits = permissionsToBits(['ViewChannel', 'SendMessages']);
    expect(bitsToPermissions(bits).sort()).toEqual(['SendMessages', 'ViewChannel']);
    expect(
      effectiveOverwrites([{ role: 'a', allow: ['ViewChannel'], deny: [] }], undefined),
    ).toHaveLength(1);
    expect(
      effectiveOverwrites(
        [{ role: 'a', allow: ['ViewChannel'], deny: [] }],
        [
          { role: 'a', allow: [], deny: ['ViewChannel'] },
          { role: 'b', allow: [], deny: [] },
        ],
      ),
    ).toEqual([
      { role: 'a', allow: [], deny: ['ViewChannel'] },
      { role: 'b', allow: [], deny: [] },
    ]);
    expect(permissionsUsedBy(rendered('elite'))).toEqual(
      expect.arrayContaining(['ManageEvents', 'Administrator', 'ManageGuild']),
    );
  });

  it('normalizes channel names like Discord', () => {
    expect(normalizeChannelName('Off Topic', 'text')).toBe('off-topic');
    expect(normalizeChannelName('Lounge', 'voice')).toBe('lounge');
  });
});
