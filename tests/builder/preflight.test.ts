import { describe, expect, it } from 'vitest';
import { PermissionFlagsBits } from 'discord.js';
import { preflight } from '../../src/services/builder/preflight.js';
import { FakeGuild } from '../fakes/fakeGuild.js';
import { harness, rendered } from './setup.js';

async function check(
  guild: FakeGuild,
  templateId: string,
  mode: 'alongside' | 'clean' = 'alongside',
) {
  const h = harness(guild);
  const p = await h.planFor(templateId, { mode });
  return preflight(guild.snapshot(), rendered(templateId), p);
}

describe('preflight', () => {
  it('passes for an admin bot on an empty server', async () => {
    const result = await check(new FakeGuild(), 'starter');
    expect(result).toMatchObject({ ok: true, errors: [] });
  });

  it('lists missing permissions when the bot is not an administrator', async () => {
    const guild = new FakeGuild();
    guild.isAdmin = false;
    guild.botPermissions = PermissionFlagsBits.ManageRoles | PermissionFlagsBits.ManageChannels;
    const result = await check(guild, 'starter');
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/missing permissions: \*\*.*ManageGuild.*\*\*/);
  });

  it('warns but passes without Administrator when every permission is present', async () => {
    const guild = new FakeGuild();
    guild.isAdmin = false;
    guild.botPermissions = Object.values(PermissionFlagsBits).reduce((a, b) => a | b, 0n);
    const result = await check(guild, 'starter');
    expect(result.ok).toBe(true);
    expect(result.warnings.join()).toMatch(/does not have Administrator/);
  });

  it('blocks when a role the bot must assign is above it', async () => {
    const guild = new FakeGuild();
    guild.addRole('Member', { position: 99 });
    const result = await check(guild, 'starter');
    expect(result.ok).toBe(false);
    expect(result.errors.join()).toMatch(/\*\*Member\*\* is above ServerForge's role/);
    expect(result.warnings.join()).toMatch(/below 1 role/);
  });

  it('enforces Discord limits', async () => {
    const guild = new FakeGuild();
    for (let i = 0; i < 248; i += 1) guild.addRole(`r${i}`, { position: 0 });
    const result = await check(guild, 'starter');
    expect(result.errors.join()).toMatch(/250/);
  });

  it('warns about Community, verification gating and clean-build deletions', async () => {
    const guild = new FakeGuild();
    guild.addChannel('old', 'text');
    const elite = await check(guild, 'elite');
    expect(elite.warnings.join('\n')).toMatch(/Community\*\* will be enabled/);
    expect(elite.warnings.join('\n')).toMatch(/only see the verification channel/);
    const clean = await check(guild, 'starter', 'clean');
    expect(clean.warnings.join('\n')).toMatch(/Clean build deletes 1 channel/);
  });
});
