import { describe, expect, it } from 'vitest';
import { customId, parseCustomId } from '../../src/bot/customId.js';
import { assertSeller } from '../../src/bot/router.js';
import { ModuleConfigStore } from '../../src/modules/configStore.js';
import { createMemoryDatabase } from '../../src/db/memory.js';
import type { BotConfig } from '../../src/config.js';

describe('custom ids', () => {
  it('round-trips area, action and args', () => {
    const id = customId('setup', 'mode', 'abc123', 'clean');
    expect(id).toBe('sf:setup:mode:abc123:clean');
    expect(parseCustomId(id)).toEqual({ area: 'setup', action: 'mode', args: ['abc123', 'clean'] });
  });

  it('rejects foreign or malformed ids', () => {
    expect(parseCustomId('other:thing:x')).toBeNull();
    expect(parseCustomId('sf:only')).toBeNull();
    expect(parseCustomId('sf:a:b c')).toBeNull();
    expect(() => customId('a', 'b:c')).toThrow();
    expect(() => customId('a', 'b', 'x'.repeat(100))).toThrow(/too long/);
  });
});

describe('assertSeller', () => {
  const config = { OWNER_USER_ID: '1', ADMIN_GUILD_ID: '2' } as BotConfig;
  it('only allows the owner inside the admin guild', () => {
    expect(() => assertSeller('2', '1', { config })).not.toThrow();
    expect(() => assertSeller('3', '1', { config })).toThrow(/only work in your admin server/);
    expect(() => assertSeller('2', '9', { config })).toThrow(
      /only available to the ServerForge seller/,
    );
    expect(() => assertSeller(null, '1', { config })).toThrow();
  });
});

describe('ModuleConfigStore', () => {
  it('caches enabled module config with a TTL and supports invalidation', async () => {
    const db = createMemoryDatabase();
    let now = 0;
    const store = new ModuleConfigStore(db, 1000, () => now);
    expect(await store.get('g', 'logging')).toBeNull();
    await db.modules.upsert({
      guildId: 'g',
      moduleId: 'logging',
      enabled: true,
      config: { modLogId: '1' },
    });
    expect(await store.get('g', 'logging')).toBeNull(); // cached miss
    now = 2000;
    expect(await store.get('g', 'logging')).toEqual({ modLogId: '1' });
    await db.modules.upsert({ guildId: 'g', moduleId: 'logging', enabled: false, config: {} });
    store.invalidate('g');
    expect(await store.get('g', 'logging')).toBeNull();
    store.invalidate();
  });
});
