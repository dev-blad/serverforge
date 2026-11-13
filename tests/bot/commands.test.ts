import { describe, expect, it } from 'vitest';
import { commands, componentHandlers } from '../../src/commands/index.js';
import { moduleRuntimes } from '../../src/modules/index.js';
import { keyCopyView } from '../../src/commands/keys.js';
import { parseCustomId } from '../../src/bot/customId.js';
import { generateKey } from '../../src/services/license/keygen.js';

describe('command definitions', () => {
  it('registers the expected commands with the right scopes', () => {
    expect(commands.map((c) => `${c.data.name}:${c.scope}`).sort()).toEqual([
      'announce:global',
      'backup:global',
      'forge:global',
      'giveaway:global',
      'help:global',
      'keys:admin',
      'order:global',
      'product:global',
      'setup:global',
      'status:global',
      'vouch:global',
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
    expect(areas.sort()).toEqual([
      'announce',
      'apply',
      'backup',
      'br',
      'give',
      'keys',
      'setup',
      'store',
      'ticket',
      'tixbot',
      'verify',
      'vouch',
    ]);
  });
});

describe('/keys copy view', () => {
  it('shows keys as plain text with one copy button per key', () => {
    const keys = [generateKey(), generateKey(), generateKey()];
    const view = keyCopyView(keys);
    expect(view.content).toBe(keys.join('\n'));
    expect(view.attachAll).toBe(false);
    const ids = view.buttons.flatMap((row) =>
      row.components.map((b) => (b.toJSON() as { custom_id: string }).custom_id),
    );
    expect(ids.map((id) => parseCustomId(id)?.args[0])).toEqual(keys);
  });

  it('caps buttons at 25 and attaches a file for large batches', () => {
    const keys = Array.from({ length: 100 }, generateKey);
    const view = keyCopyView(keys);
    expect(view.buttons).toHaveLength(5);
    expect(view.attachAll).toBe(true);
    expect(view.content).toMatch(/attached file/);
  });
});
