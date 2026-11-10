import type { Database, ResourceRecord } from '../../db/types.js';
import type { Logger } from '../../logger.js';
import { UserFacingError } from '../../errors.js';
import { isUnknownResource } from './discordErrors.js';
import type { GuildGateway } from './gateway.js';
import type { TaskQueue } from './queue.js';

export interface RollbackResult {
  deleted: number;
  restored: number;
  failed: string[];
}

/** Delete order: things that live inside other things go first. */
const DELETE_ORDER: Record<string, number> = {
  message: 0,
  automod: 1,
  channel: 2,
  category: 3,
  role: 4,
};

/**
 * Undo a build run: delete every resource the run *created* (never adopted ones), restore
 * anything it modified (@everyone permissions, Community), and mark the run rolled back.
 * Resources deleted by a clean build can't be restored — the preview warns about that.
 */
export async function rollbackRun(
  runId: string,
  deps: { db: Database; gateway: GuildGateway; queue: TaskQueue; logger: Logger },
): Promise<RollbackResult> {
  const { db, gateway, queue, logger } = deps;
  const run = await db.runs.get(runId);
  if (!run) throw new UserFacingError('That build no longer exists.');
  if (run.guildId !== gateway.guildId)
    throw new UserFacingError('That build belongs to another server.');
  if (run.status === 'rolled_back')
    throw new UserFacingError('That build was already rolled back.');
  if (run.status === 'running') throw new UserFacingError('That build is still running.');

  const records = await db.resources.listByRun(run.guildId, runId);
  const created = records
    .filter((r) => r.created)
    .sort((a, b) => (DELETE_ORDER[a.kind] ?? 9) - (DELETE_ORDER[b.kind] ?? 9));
  const modified = records.filter((r) => !r.created && r.previous);
  const result: RollbackResult = { deleted: 0, restored: 0, failed: [] };

  const attempt = async (record: ResourceRecord, label: string, fn: () => Promise<void>) => {
    try {
      await queue.run(label, fn);
      return true;
    } catch (error) {
      if (isUnknownResource(error)) return true;
      logger.warn({ err: error, key: record.key, runId }, 'rollback step failed');
      result.failed.push(record.key);
      return false;
    }
  };

  for (const record of created) {
    const ok = await attempt(record, `rollback ${record.key}`, async () => {
      switch (record.kind) {
        case 'message':
          if (record.channelId) await gateway.deleteMessage(record.channelId, record.discordId);
          return;
        case 'automod':
          await gateway.deleteAutomodRule(record.discordId);
          return;
        case 'channel':
        case 'category':
          await gateway.deleteChannel(record.discordId);
          return;
        case 'role':
          await gateway.deleteRole(record.discordId);
          return;
        default:
          return;
      }
    });
    if (ok) {
      await db.resources.delete(run.guildId, record.key);
      result.deleted += 1;
    }
  }

  for (const record of modified) {
    const previous = JSON.parse(record.previous ?? '{}') as {
      permissions?: string;
      community?: boolean;
    };
    const ok = await attempt(record, `restore ${record.key}`, async () => {
      if (record.kind === 'everyone' && previous.permissions !== undefined) {
        await gateway.setEveryonePermissions(BigInt(previous.permissions));
      } else if (record.kind === 'guild' && previous.community === false) {
        await gateway.disableCommunity();
      }
    });
    if (ok) {
      await db.resources.delete(run.guildId, record.key);
      result.restored += 1;
    }
  }

  // A rolled-back first build leaves nothing for modules to work with.
  if (run.kind === 'setup') {
    for (const module of await db.modules.list(run.guildId)) {
      await db.modules.upsert({ ...module, enabled: false });
    }
  }

  await db.runs.update(runId, { status: 'rolled_back', finishedAt: new Date() });
  return result;
}
