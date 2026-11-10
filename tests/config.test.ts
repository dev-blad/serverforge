import { describe, expect, it } from 'vitest';
import { loadBaseConfig, loadBotConfig } from '../src/config.js';

describe('config', () => {
  it('applies defaults', () => {
    const cfg = loadBaseConfig({ LICENSE_PEPPER: 'x'.repeat(32) });
    expect(cfg.DATABASE_URL).toContain('serverforge.db');
    expect(cfg.KEY_ATTEMPTS_PER_USER).toBe(5);
    expect(cfg.LOG_PRETTY).toBe(false);
  });

  it('fails fast with a readable message', () => {
    expect(() => loadBotConfig({ LICENSE_PEPPER: 'short' })).toThrow(/LICENSE_PEPPER/);
    expect(() => loadBotConfig({ LICENSE_PEPPER: 'short' })).toThrow(/DISCORD_TOKEN/);
  });

  it('treats empty optional IDs as undefined', () => {
    const cfg = loadBotConfig({
      LICENSE_PEPPER: 'x'.repeat(32),
      DISCORD_TOKEN: 'abcdefghijklmnop',
      DISCORD_CLIENT_ID: '123456789012345678',
      OWNER_USER_ID: '123456789012345678',
      ADMIN_GUILD_ID: '123456789012345678',
      DEV_GUILD_ID: '',
    });
    expect(cfg.DEV_GUILD_ID).toBeUndefined();
  });
});
