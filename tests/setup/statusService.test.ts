import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { createMemoryDatabase } from '../../src/db/memory.js';
import { StatusService } from '../../src/services/setup/statusService.js';
import { LicenseService } from '../../src/services/license/licenseService.js';
import { loadTemplates } from '../../src/services/template/loader.js';
import { TemplateRegistry } from '../../src/services/template/registry.js';

const registry = new TemplateRegistry(await loadTemplates(path.resolve('templates')));

describe('StatusService', () => {
  it('reports not-set-up guilds and upgrade paths', async () => {
    const db = createMemoryDatabase();
    const status = new StatusService(db, registry);
    const s = await status.get('g');
    expect(s.setUp).toBe(false);
    expect(status.upgradesFrom(null).map((u) => u.tier)).toEqual(['starter', 'pro', 'elite']);
    expect(status.upgradesFrom('pro')).toEqual([
      expect.objectContaining({ tier: 'elite', adds: ['tickets', 'memberStats'] }),
    ]);
    expect(status.upgradesFrom('elite')).toEqual([]);
  });

  it('shows tier, masked key, modules and last run', async () => {
    const db = createMemoryDatabase();
    const licenses = new LicenseService(db.licenses, db.guilds, 'pepper-for-tests-123', registry);
    const key = (await licenses.generate({ tier: 'pro' }))[0]!.key;
    const check = await licenses.checkActivation(key, { guildId: 'g', userId: 'u' });
    await licenses.commitActivation(check, {
      guildId: 'g',
      userId: 'u',
      ownerId: 'o',
      options: { serverName: 's', brandColor: '#000000', mode: 'alongside' },
    });
    await db.modules.upsert({ guildId: 'g', moduleId: 'logging', enabled: true, config: {} });
    await db.modules.upsert({ guildId: 'g', moduleId: 'tickets', enabled: false, config: {} });
    await db.runs.create({
      guildId: 'g',
      licenseId: null,
      templateId: 'pro',
      tier: 'pro',
      kind: 'setup',
      mode: 'alongside',
      status: 'succeeded',
      options: { serverName: 's', brandColor: '#000000', mode: 'alongside' },
      userId: 'u',
    });
    const s = await new StatusService(db, registry).get('g');
    expect(s).toMatchObject({
      setUp: true,
      tier: 'pro',
      tierLabel: 'Pro',
      templateName: 'Pro',
      keyStatus: 'active',
      modules: ['logging'],
    });
    expect(s.maskedKey).toBe(`FORGE-****-****-${key.slice(-4)}`);
    expect(s.lastRun?.status).toBe('succeeded');
  });
});
