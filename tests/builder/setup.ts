import path from 'node:path';
import { createMemoryDatabase } from '../../src/db/memory.js';
import type { BuildKind, BuildMode, Database } from '../../src/db/types.js';
import { silentLogger } from '../../src/logger.js';
import type { ModuleInstallers } from '../../src/modules/types.js';
import { BuildExecutor } from '../../src/services/builder/executor.js';
import { plan } from '../../src/services/builder/planner.js';
import { TaskQueue } from '../../src/services/builder/queue.js';
import { nullReporter } from '../../src/services/builder/types.js';
import { loadTemplates } from '../../src/services/template/loader.js';
import { renderTemplate } from '../../src/services/template/registry.js';
import type { Template } from '../../src/services/template/schema.js';
import { FakeGuild } from '../fakes/fakeGuild.js';

export const templates = await loadTemplates(path.resolve('templates'));

export function rendered(id: string, brandColor = '#FF8800', guildId = 'g1'): Template {
  return renderTemplate(templates.get(id)!, {
    serverName: 'Test Server',
    brandColor,
    ownerId: 'owner',
    ownerName: 'Owner',
    guildId,
  });
}

export const instantQueue = () =>
  new TaskQueue({ minIntervalMs: 0, baseDelayMs: 1, sleep: () => Promise.resolve() });

export interface Harness {
  guild: FakeGuild;
  db: Database;
  build(
    templateId: string,
    opts?: {
      mode?: BuildMode;
      kind?: BuildKind;
      installers?: ModuleInstallers;
      preserveChannelId?: string;
    },
  ): Promise<{
    plan: ReturnType<typeof plan>;
    result: Awaited<ReturnType<BuildExecutor['execute']>>;
    runId: string;
  }>;
  planFor(
    templateId: string,
    opts?: { mode?: BuildMode; kind?: BuildKind; preserveChannelId?: string },
  ): Promise<ReturnType<typeof plan>>;
}

export function harness(guild = new FakeGuild(), db: Database = createMemoryDatabase()): Harness {
  const planFor: Harness['planFor'] = async (templateId, opts = {}) => {
    const tracked = await db.resources.list(guild.guildId);
    return plan({
      template: rendered(templateId, undefined, guild.guildId),
      snapshot: guild.snapshot(tracked),
      tracked,
      mode: opts.mode ?? 'alongside',
      kind: opts.kind ?? 'setup',
      preserveChannelId: opts.preserveChannelId ?? null,
    });
  };
  return {
    guild,
    db,
    planFor,
    async build(templateId, opts = {}) {
      const p = await planFor(templateId, opts);
      const template = rendered(templateId, undefined, guild.guildId);
      const run = await db.runs.create({
        guildId: guild.guildId,
        licenseId: null,
        templateId,
        tier: template.tier,
        kind: opts.kind ?? 'setup',
        mode: opts.mode ?? 'alongside',
        status: 'running',
        options: {
          serverName: 'Test Server',
          brandColor: '#FF8800',
          mode: opts.mode ?? 'alongside',
        },
        userId: 'owner',
      });
      const executor = new BuildExecutor({
        gateway: guild,
        db,
        queue: instantQueue(),
        logger: silentLogger,
        installers: opts.installers ?? {},
      });
      const result = await executor.execute({
        run,
        plan: p,
        template,
        communityEnabled: guild.features.has('COMMUNITY'),
        reporter: nullReporter,
      });
      return { plan: p, result, runId: run.id };
    },
  };
}
