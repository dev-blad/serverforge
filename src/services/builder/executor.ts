import type { BuildRunRecord, Database, ResourceKind } from '../../db/types.js';
import type { Logger } from '../../logger.js';
import type { IdMap, ModuleInstallContext, ModuleInstallers } from '../../modules/types.js';
import type { Template } from '../template/schema.js';
import { describeError, isUnknownResource } from './discordErrors.js';
import type { GuildGateway } from './gateway.js';
import { messagePayload, overwritePayloads, rolePayload } from './payload.js';
import { permissionsToBits } from './permissions.js';
import { channelKey, countByPhase, messageKey, roleKey } from './planner.js';
import type { TaskQueue } from './queue.js';
import { PHASE_LABELS, type BuildPlan, type PlanAction, type ProgressReporter } from './types.js';

export interface ExecutorDeps {
  gateway: GuildGateway;
  db: Database;
  queue: TaskQueue;
  logger: Logger;
  installers: ModuleInstallers;
}

export interface ExecuteInput {
  run: BuildRunRecord;
  plan: BuildPlan;
  /** The rendered template. */
  template: Template;
  /** Whether the guild already has the Community feature. */
  communityEnabled: boolean;
  reporter: ProgressReporter;
}

export interface ExecuteResult {
  status: 'succeeded' | 'failed';
  completed: number;
  total: number;
  ids: IdMap;
  warnings: string[];
  error?: string;
  failedAction?: PlanAction;
}

export function describeAction(action: PlanAction): string {
  switch (action.type) {
    case 'deleteChannel':
      return `delete channel "${action.name}"`;
    case 'deleteRole':
      return `delete role "${action.name}"`;
    case 'createRole':
      return `create role "${action.spec.name}"`;
    case 'updateEveryone':
      return 'update @everyone permissions';
    case 'orderRoles':
      return 'order roles';
    case 'createCategory':
      return `create category "${action.name}"`;
    case 'createChannel':
      return `create ${action.spec.type} channel "${action.spec.name}"`;
    case 'orderChannels':
      return 'order channels';
    case 'convertToAnnouncement':
      return `convert #${action.key} to an announcement channel`;
    case 'enableCommunity':
      return 'enable Community';
    case 'syncOverwrites':
      return `repair permissions on "${action.key}"`;
    case 'postMessage':
      return `post "${action.key}" message`;
    case 'applyModule':
      return `set up ${action.moduleId}`;
  }
}

/**
 * Executes a BuildPlan against a guild. Every created resource is recorded in the database
 * immediately with the run id, so a crashed build can be resumed (re-planning skips what
 * exists) or rolled back (delete what this run created).
 */
export class BuildExecutor {
  constructor(private readonly deps: ExecutorDeps) {}

  async execute(input: ExecuteInput): Promise<ExecuteResult> {
    const { run, plan, template, reporter } = input;
    const { db, logger } = this.deps;
    const guildId = run.guildId;
    const ids: IdMap = {
      roles: { ...plan.resolved.roles },
      channels: { ...plan.resolved.channels },
    };
    const warnings: string[] = [];
    const state = { communityEnabled: input.communityEnabled };
    const total = plan.actions.length;
    const phaseTotals = countByPhase(plan.actions);
    const phaseDone: Record<string, number> = {};

    // Start tracking adopted resources (not created by us → never deleted on rollback).
    for (const adoption of plan.adoptions) {
      await db.resources.upsert({
        guildId,
        key: adoption.key,
        kind: adoption.kind,
        discordId: adoption.discordId,
        channelId: null,
        runId: null,
        created: false,
        previous: null,
      });
    }

    await db.runs.update(run.id, { total, completed: 0, status: 'running' });
    const existingRecords = await db.resources.list(guildId);
    const keyByDiscordId = new Map(existingRecords.map((r) => [r.discordId, r.key]));

    const track = async (record: {
      key: string;
      kind: ResourceKind;
      discordId: string;
      channelId?: string | null;
      previous?: string | null;
      created?: boolean;
    }) => {
      await db.resources.upsert({
        guildId,
        key: record.key,
        kind: record.kind,
        discordId: record.discordId,
        channelId: record.channelId ?? null,
        runId: run.id,
        created: record.created ?? true,
        previous: record.previous ?? null,
      });
    };

    let completed = 0;
    for (const action of plan.actions) {
      phaseDone[action.phase] = (phaseDone[action.phase] ?? 0) + 1;
      try {
        await reporter.update({
          phase: action.phase,
          label: PHASE_LABELS[action.phase],
          done: completed,
          total,
          phaseDone: phaseDone[action.phase] ?? 0,
          phaseTotal: phaseTotals[action.phase] ?? 0,
        });
      } catch (error) {
        logger.debug({ err: error }, 'progress update failed');
      }

      try {
        await this.perform(action, { run, template, ids, track, keyByDiscordId, warnings, state });
      } catch (error) {
        const message = describeError(error);
        logger.error(
          { err: error, guildId, runId: run.id, action: describeAction(action) },
          'build step failed',
        );
        await db.runs.update(run.id, {
          status: 'failed',
          completed,
          error: `Failed to ${describeAction(action)}: ${message}`,
          finishedAt: new Date(),
        });
        return {
          status: 'failed',
          completed,
          total,
          ids,
          warnings,
          error: `Failed to ${describeAction(action)}: ${message}`,
          failedAction: action,
        };
      }
      completed += 1;
      if (completed % 5 === 0 || completed === total) await db.runs.update(run.id, { completed });
    }

    await db.runs.update(run.id, { status: 'succeeded', completed, finishedAt: new Date() });
    return { status: 'succeeded', completed, total, ids, warnings };
  }

  private async perform(
    action: PlanAction,
    ctx: {
      run: BuildRunRecord;
      template: Template;
      ids: IdMap;
      track: (
        r: Parameters<ModuleInstallContext['track']>[0] & {
          previous?: string | null;
          created?: boolean;
        },
      ) => Promise<void>;
      keyByDiscordId: Map<string, string>;
      warnings: string[];
      state: { communityEnabled: boolean };
    },
  ): Promise<void> {
    const { gateway, queue, db } = this.deps;
    const { ids, track, run } = ctx;
    const guildId = run.guildId;
    const q = <T>(fn: () => Promise<T>) => queue.run(describeAction(action), fn);
    const overwriteIds = { everyoneId: guildId, roles: ids.roles };

    switch (action.type) {
      case 'deleteChannel':
      case 'deleteRole': {
        try {
          await q(() =>
            action.type === 'deleteChannel'
              ? gateway.deleteChannel(action.id)
              : gateway.deleteRole(action.id),
          );
        } catch (error) {
          if (!isUnknownResource(error)) throw error;
        }
        const key = ctx.keyByDiscordId.get(action.id);
        if (key) await db.resources.delete(guildId, key);
        return;
      }

      case 'createRole': {
        const id = await q(() => gateway.createRole(rolePayload(action.spec)));
        ids.roles[action.key] = id;
        await track({ key: roleKey(action.key), kind: 'role', discordId: id });
        return;
      }

      case 'updateEveryone': {
        const previous = await q(() =>
          gateway.setEveryonePermissions(permissionsToBits(action.permissions)),
        );
        const existing = await db.resources.get(guildId, 'everyone');
        await track({
          key: 'everyone',
          kind: 'everyone',
          discordId: guildId,
          created: false,
          // Keep the oldest known state so rollback returns to the pre-ServerForge permissions.
          previous: existing?.previous ?? JSON.stringify({ permissions: previous.toString() }),
        });
        return;
      }

      case 'orderRoles': {
        const ordered = action.keys.map((k) => ids.roles[k]).filter((id): id is string => !!id);
        // Cosmetic: never fail a build because Discord refused to reorder.
        try {
          await q(() => gateway.orderRoles(ordered));
        } catch (error) {
          this.deps.logger.warn({ err: error, guildId }, 'could not order roles');
          ctx.warnings.push(
            "Roles were created but couldn't be put in order — drag them into place in Server Settings → Roles if you like.",
          );
        }
        return;
      }

      case 'createCategory': {
        const id = await q(() =>
          gateway.createChannel({
            name: action.name,
            kind: 'category',
            overwrites: overwritePayloads(action.overwrites, overwriteIds),
          }),
        );
        ids.channels[action.key] = id;
        await track({ key: channelKey(action.key), kind: 'category', discordId: id });
        return;
      }

      case 'createChannel': {
        const spec = action.spec;
        let kind = spec.type;
        if (!ctx.state.communityEnabled && (kind === 'announcement' || kind === 'stage')) {
          const fallback = kind === 'announcement' ? 'text' : 'voice';
          ctx.warnings.push(
            `Community isn't enabled, so "${spec.name}" was created as a ${fallback} channel instead of ${kind}.`,
          );
          kind = fallback;
        }
        const parentId = action.parentKey ? (ids.channels[action.parentKey] ?? null) : null;
        const id = await q(() =>
          gateway.createChannel({
            name: spec.name,
            kind,
            parentId,
            slowmode: spec.slowmode,
            nsfw: spec.nsfw,
            overwrites: overwritePayloads(action.overwrites, overwriteIds),
            ...(spec.topic !== undefined ? { topic: spec.topic } : {}),
            ...(spec.userLimit !== undefined ? { userLimit: spec.userLimit } : {}),
            ...(spec.bitrate !== undefined ? { bitrate: spec.bitrate } : {}),
            ...(spec.tags !== undefined ? { tags: spec.tags } : {}),
          }),
        );
        ids.channels[action.key] = id;
        await track({ key: channelKey(action.key), kind: 'channel', discordId: id });
        return;
      }

      case 'orderChannels': {
        const categoryIds = action.layout.categories
          .map((k) => ids.channels[k])
          .filter((id): id is string => !!id);
        const byParent: Record<string, string[]> = {};
        for (const [parentKey, keys] of Object.entries(action.layout.channels)) {
          const parentId = parentKey === '' ? '' : ids.channels[parentKey];
          if (parentId === undefined) continue;
          byParent[parentId] = keys.map((k) => ids.channels[k]).filter((id): id is string => !!id);
        }
        try {
          await q(() => gateway.orderChannels(categoryIds, byParent));
        } catch (error) {
          this.deps.logger.warn({ err: error, guildId }, 'could not order channels');
          ctx.warnings.push("Channels were created but couldn't be put in order.");
        }
        return;
      }

      case 'convertToAnnouncement': {
        const id = ids.channels[action.key];
        if (!id || !ctx.state.communityEnabled) return;
        await q(() => gateway.convertToAnnouncement(id));
        return;
      }

      case 'enableCommunity': {
        const rules = ids.channels[action.rulesKey];
        const updates = ids.channels[action.updatesKey];
        if (!rules || !updates) {
          ctx.warnings.push('Community could not be enabled: rules/updates channels are missing.');
          return;
        }
        const ok = await q(() => gateway.enableCommunity(rules, updates));
        if (ok) {
          ctx.state.communityEnabled = true;
          await track({
            key: 'guild:community',
            kind: 'guild',
            discordId: guildId,
            created: false,
            previous: JSON.stringify({ community: false }),
          });
        } else {
          ctx.warnings.push(
            "Discord didn't allow enabling Community (the server owner may need to enable it in Server Settings → Enable Community). Announcement/stage channels were created as text/voice instead.",
          );
        }
        return;
      }

      case 'syncOverwrites': {
        const channelId = ids.channels[action.key];
        if (!channelId) return;
        await q(() =>
          gateway.setOverwrites(channelId, overwritePayloads(action.overwrites, overwriteIds)),
        );
        return;
      }

      case 'postMessage': {
        const channelId = ids.channels[action.spec.channel];
        if (!channelId) {
          ctx.warnings.push(
            `Skipped message "${action.key}": channel "${action.spec.channel}" is missing.`,
          );
          return;
        }
        const payload = messagePayload(action.spec, ids);
        const messageId = await q(() =>
          gateway.sendMessage(channelId, payload, { pin: action.spec.pin }),
        );
        await track({
          key: messageKey(action.key),
          kind: 'message',
          discordId: messageId,
          channelId,
        });
        return;
      }

      case 'applyModule': {
        const installer = this.deps.installers[action.moduleId];
        if (!installer) {
          ctx.warnings.push(`Module "${action.moduleId}" has no installer and was skipped.`);
          return;
        }
        // Installers call ctx.queue themselves (one queue slot per Discord call).
        const config = await installer({
          guildId,
          template: ctx.template,
          ids,
          gateway,
          queue,
          db,
          runId: run.id,
          logger: this.deps.logger.child({ module: action.moduleId, guildId }),
          track: (r) => track(r),
          tracked: (key) => db.resources.get(guildId, key),
          warn: (message) => ctx.warnings.push(message),
        });
        await db.modules.upsert({ guildId, moduleId: action.moduleId, enabled: true, config });
        return;
      }
    }
  }
}
