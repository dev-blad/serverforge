import { describe, expect, it } from 'vitest';
import { planCommandRegistration } from '../../src/bot/registerCommands.js';
import { commands } from '../../src/commands/index.js';

const names = (list: { name: string }[]) => list.map((c) => c.name).sort();

describe('planCommandRegistration', () => {
  it('registers customer commands globally and seller commands in the admin guild', () => {
    const plan = planCommandRegistration(commands, { adminGuildId: 'A' });
    expect(names(plan.global)).toEqual([
      'announce',
      'backup',
      'forge',
      'giveaway',
      'help',
      'order',
      'product',
      'setup',
      'status',
      'vouch',
    ]);
    expect(Object.keys(plan.guilds)).toEqual(['A']);
    expect(names(plan.guilds['A']!)).toEqual(['keys']);
  });

  it('puts everything in the dev guild (instant) and nothing global in test mode', () => {
    const same = planCommandRegistration(commands, { adminGuildId: 'D', devGuildId: 'D' });
    expect(same.global).toEqual([]);
    expect(names(same.guilds['D']!)).toEqual([
      'announce',
      'backup',
      'forge',
      'giveaway',
      'help',
      'keys',
      'order',
      'product',
      'setup',
      'status',
      'vouch',
    ]);
    const different = planCommandRegistration(commands, { adminGuildId: 'A', devGuildId: 'D' });
    expect(names(different.guilds['A']!)).toEqual(['keys']);
  });
});
