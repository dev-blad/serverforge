import { describe, expect, it } from 'vitest';
import { computeRolePositions } from '../../src/services/builder/discordGateway.js';
import { FakeGuild } from '../fakes/fakeGuild.js';
import { harness } from './setup.js';

describe('computeRolePositions', () => {
  const ctx = { everyoneId: 'E', botPosition: 5 };
  const roles = [
    { id: 'E', position: 0 },
    { id: 'bot', position: 5 },
    { id: 'above', position: 6 },
    { id: 'a', position: 1 }, // created last → bottom
    { id: 'b', position: 2 },
    { id: 'c', position: 3 },
    { id: 'custom', position: 4 },
  ];

  it('puts template roles right below the bot in order, then everything else', () => {
    const updates = computeRolePositions(roles, ctx, ['a', 'b', 'c']);
    const final = new Map(roles.map((r) => [r.id, r.position]));
    for (const u of updates) final.set(u.role, u.position);
    expect(final.get('a')).toBe(4);
    expect(final.get('b')).toBe(3);
    expect(final.get('c')).toBe(2);
    expect(final.get('custom')).toBe(1);
  });

  it('never touches the bot, roles above it or @everyone, and never reaches the bot position', () => {
    const updates = computeRolePositions(roles, ctx, ['above', 'bot', 'a']);
    expect(updates.map((u) => u.role)).not.toContain('above');
    expect(updates.map((u) => u.role)).not.toContain('bot');
    expect(updates.map((u) => u.role)).not.toContain('E');
    expect(Math.max(...updates.map((u) => u.position))).toBeLessThan(5);
  });

  it('returns nothing when already in order', () => {
    expect(computeRolePositions(roles, ctx, ['custom', 'c', 'b', 'a'])).toEqual([]);
  });
});

describe('ordering failures are not fatal', () => {
  it('finishes the build with a warning when Discord refuses to reorder', async () => {
    const guild = new FakeGuild();
    guild.failOn = (m) =>
      m === 'orderRoles' || m === 'orderChannels'
        ? Object.assign(new Error('Missing Permissions'), { code: 50013, status: 403 })
        : undefined;
    const { result } = await harness(guild).build('starter');
    expect(result.status).toBe('succeeded');
    expect(result.warnings.join()).toMatch(/couldn't be put in order/);
  });
});
