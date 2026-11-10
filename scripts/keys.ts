/**
 * Seller CLI for license keys.
 *
 *   npm run keys -- generate --tier pro --count 5 --note "fiverr order 123" [--template gaming]
 *   npm run keys -- list [--status unused|active|revoked] [--tier pro] [--limit 50]
 *   npm run keys -- inspect <key-or-id>
 *   npm run keys -- revoke <key-or-id>
 *
 * Raw keys are printed ONCE by `generate` — only a hash is stored. Copy them somewhere safe.
 */
import { parseArgs } from 'node:util';
import { loadBaseConfig } from '../src/config.js';
import { createPrismaClient, createPrismaDatabase } from '../src/db/prisma.js';
import { UserFacingError } from '../src/errors.js';
import { LicenseService } from '../src/services/license/licenseService.js';
import { loadTemplates } from '../src/services/template/loader.js';
import { TemplateRegistry } from '../src/services/template/registry.js';
import { TIERS, type Tier } from '../src/services/template/schema.js';
import type { LicenseRecord, LicenseStatus } from '../src/db/types.js';

const USAGE = `Usage:
  npm run keys -- generate --tier <starter|pro|elite> [--count N] [--note "text"] [--template id]
  npm run keys -- list [--status unused|active|revoked] [--tier T] [--limit N]
  npm run keys -- inspect <key-or-id>
  npm run keys -- revoke <key-or-id>`;

function fail(message: string): never {
  console.error(`✖ ${message}\n\n${USAGE}`);
  process.exit(1);
}

function row(l: LicenseRecord): string {
  return [
    l.id.padEnd(25),
    LicenseService.mask(l).padEnd(22),
    l.tier.padEnd(8),
    (l.templateId ?? '-').padEnd(12),
    l.status.padEnd(8),
    (l.guildId ?? '-').padEnd(20),
    l.createdAt.toISOString().slice(0, 10),
    l.note ?? '',
  ].join(' ');
}

function details(l: LicenseRecord): string {
  return [
    `ID:          ${l.id}`,
    `Key:         ${LicenseService.mask(l)}`,
    `Tier:        ${l.tier}`,
    `Template:    ${l.templateId ?? `${l.tier} (default)`}`,
    `Status:      ${l.status}`,
    `Note:        ${l.note ?? '-'}`,
    `Created:     ${l.createdAt.toISOString()}`,
    `Guild:       ${l.guildId ?? '-'}`,
    `Activated:   ${l.activatedAt?.toISOString() ?? '-'}${l.activatedBy ? ` by ${l.activatedBy}` : ''}`,
    `Revoked:     ${l.revokedAt?.toISOString() ?? '-'}`,
  ].join('\n');
}

const [command, ...rest] = process.argv.slice(2);
const { values, positionals } = parseArgs({
  args: rest,
  allowPositionals: true,
  options: {
    tier: { type: 'string' },
    count: { type: 'string', default: '1' },
    note: { type: 'string' },
    template: { type: 'string' },
    status: { type: 'string' },
    limit: { type: 'string', default: '50' },
  },
});

const config = loadBaseConfig();
const client = createPrismaClient(config.DATABASE_URL);
const db = createPrismaDatabase(client);

try {
  switch (command) {
    case 'generate': {
      const tier = values.tier as Tier | undefined;
      if (!tier || !TIERS.includes(tier)) fail('--tier must be one of starter, pro, elite');
      const count = Number(values.count);
      const registry = new TemplateRegistry(await loadTemplates(config.TEMPLATES_DIR));
      const service = new LicenseService(db.licenses, db.guilds, config.LICENSE_PEPPER, registry);
      const keys = await service.generate({
        tier,
        count,
        note: values.note ?? null,
        templateId: values.template ?? null,
      });
      console.log(
        `Generated ${keys.length} ${tier}${values.template ? ` (${values.template})` : ''} key(s):\n`,
      );
      for (const { key } of keys) console.log(key);
      console.log('\n⚠ These keys are shown only once. Only a hash is stored.');
      break;
    }
    case 'list': {
      const service = new LicenseService(db.licenses, db.guilds, config.LICENSE_PEPPER);
      const list = await service.list({
        ...(values.status ? { status: values.status as LicenseStatus } : {}),
        ...(values.tier ? { tier: values.tier as Tier } : {}),
        limit: Number(values.limit),
      });
      console.log(
        [
          'ID'.padEnd(25),
          'Key'.padEnd(22),
          'Tier'.padEnd(8),
          'Template'.padEnd(12),
          'Status'.padEnd(8),
          'Guild'.padEnd(20),
          'Created',
          'Note',
        ].join(' '),
      );
      for (const l of list) console.log(row(l));
      console.log(`\n${list.length} license(s)`);
      break;
    }
    case 'inspect': {
      const target = positionals[0] ?? fail('inspect needs a key or license id');
      const service = new LicenseService(db.licenses, db.guilds, config.LICENSE_PEPPER);
      const license = await service.find(target);
      if (!license) fail(`No license found for "${target}"`);
      console.log(details(license));
      break;
    }
    case 'revoke': {
      const target = positionals[0] ?? fail('revoke needs a key or license id');
      const service = new LicenseService(db.licenses, db.guilds, config.LICENSE_PEPPER);
      const license = await service.revoke(target);
      console.log(`✔ Revoked ${LicenseService.mask(license)} (${license.id})`);
      break;
    }
    default:
      fail(command ? `Unknown command "${command}"` : 'Missing command');
  }
} catch (error) {
  if (error instanceof UserFacingError) fail(error.message);
  throw error;
} finally {
  await db.close();
}
