import { describe, expect, it } from 'vitest';
import { commands, componentHandlers } from '../../src/commands/index.js';
import { moduleRuntimes } from '../../src/modules/index.js';

describe('command definitions', () => {
  it('registers the expected commands with the right scopes', () => {
    expect(commands.map((c) => `${c.data.name}:${c.scope}`).sort()).toEqual([
      'forge:global',
      'help:global',
      'keys:admin',
      'setup:global',
    ]);
    const setup = commands.find((c) => c.data.name === 'setup')!;
    expect(setup.data.options?.map((o) => o.name)).toEqual(['key', 'dry-run']);
    const forge = commands.find((c) => c.data.name === 'forge')!;
    expect(forge.data.options?.map((o) => o.name)).toEqual(['status', 'resync', 'capture']);
  });

  it('has unique component areas across commands and modules', () => {
    const areas = [
      ...componentHandlers.map((h) => h.area),
      ...moduleRuntimes.flatMap((r) => r.components?.map((h) => h.area) ?? []),
    ];
    expect(new Set(areas).size).toBe(areas.length);
    expect(areas.sort()).toEqual(['br', 'setup', 'ticket', 'verify']);
  });
});
