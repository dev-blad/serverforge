import type { BuildKind, BuildMode, ResourceRecord } from '../../db/types.js';
import { enabledModules } from '../template/registry.js';
import {
  COMMUNITY_ONLY,
  type ChannelKind,
  type ChannelSpec,
  type OverwriteSpec,
  type Template,
} from '../template/schema.js';
import { effectiveOverwrites, permissionsToBits } from './permissions.js';
import type {
  Adoption,
  BuildPlan,
  ChannelLayout,
  GuildSnapshot,
  PlanAction,
  SnapshotChannel,
  SnapshotChannelType,
  SnapshotRole,
} from './types.js';

/**
 * The build planner: a pure diff between the desired state (a rendered template) and the
 * current state of a guild (snapshot + resources ServerForge already tracks).
 *
 * The same planner powers first-time setup, upgrades, re-syncs and dry-runs:
 *  • tracked resources that still exist are kept (never modified, except template-owned
 *    permission overwrites which are repaired),
 *  • missing resources are matched by name to existing ones ("adopted") or created,
 *  • anything not in the template (custom additions) is never touched — except in
 *    "clean" mode, which deletes everything the bot is able to delete first.
 */

export interface PlanInput {
  template: Template;
  snapshot: GuildSnapshot;
  tracked: readonly ResourceRecord[];
  mode: BuildMode;
  kind: BuildKind;
  /** Channel the command was run from — never deleted in clean mode. */
  preserveChannelId?: string | null;
}

export const roleKey = (key: string) => `role:${key}`;
export const channelKey = (key: string) => `channel:${key}`;
export const messageKey = (key: string) => `message:${key}`;

/** Normalise a channel name the way Discord does for text-like channels. */
export function normalizeChannelName(name: string, type: SnapshotChannelType): string {
  const lower = name.trim().toLowerCase();
  if (type === 'text' || type === 'announcement' || type === 'forum') {
    return lower.replace(/\s+/g, '-');
  }
  return lower;
}

/** Channel types that can stand in for one another when adopting (e.g. a text #news for announcement). */
function compatibleType(existing: SnapshotChannelType, wanted: ChannelKind | 'category'): boolean {
  if (existing === wanted) return true;
  return (
    (wanted === 'announcement' && existing === 'text') ||
    (wanted === 'text' && existing === 'announcement')
  );
}

interface DesiredChannel {
  key: string;
  spec: ChannelSpec;
  parentKey: string | null;
  overwrites: OverwriteSpec[];
}

function desiredChannels(template: Template): DesiredChannel[] {
  const out: DesiredChannel[] = template.channels.map((spec) => ({
    key: spec.key,
    spec,
    parentKey: null,
    overwrites: effectiveOverwrites([], spec.overwrites),
  }));
  for (const category of template.categories) {
    for (const spec of category.channels) {
      out.push({
        key: spec.key,
        spec,
        parentKey: category.key,
        overwrites: effectiveOverwrites(category.overwrites, spec.overwrites),
      });
    }
  }
  return out;
}

export function plan(input: PlanInput): BuildPlan {
  const { template, snapshot, tracked, mode, kind } = input;
  const actions: PlanAction[] = [];
  const adoptions: Adoption[] = [];
  const warnings: string[] = [];
  const resolvedRoles: Record<string, string> = {};
  const resolvedChannels: Record<string, string> = {};
  const trackedByKey = new Map(tracked.map((r) => [r.key, r]));

  // ── Cleanup (clean mode) ────────────────────────────────────────────────
  const deletedChannelIds = new Set<string>();
  const deletedRoleIds = new Set<string>();
  if (mode === 'clean') {
    const protectedIds = new Set<string>();
    if (input.preserveChannelId) protectedIds.add(input.preserveChannelId);
    if (snapshot.features.includes('COMMUNITY')) {
      if (snapshot.rulesChannelId) protectedIds.add(snapshot.rulesChannelId);
      if (snapshot.publicUpdatesChannelId) protectedIds.add(snapshot.publicUpdatesChannelId);
    }
    const keptNames: string[] = [];
    // Delete children before categories.
    const ordered = [...snapshot.channels].sort(
      (a, b) => Number(a.type === 'category') - Number(b.type === 'category'),
    );
    for (const channel of ordered) {
      if (!channel.deletable || protectedIds.has(channel.id)) {
        keptNames.push(channel.type === 'category' ? channel.name : `#${channel.name}`);
        continue;
      }
      // Keep a category if it still contains a protected/undeletable channel.
      if (
        channel.type === 'category' &&
        snapshot.channels.some(
          (c) => c.parentId === channel.id && (!c.deletable || protectedIds.has(c.id)),
        )
      ) {
        keptNames.push(channel.name);
        continue;
      }
      actions.push({ phase: 'cleanup', type: 'deleteChannel', id: channel.id, name: channel.name });
      deletedChannelIds.add(channel.id);
    }
    const keptRoles: string[] = [];
    for (const role of snapshot.roles) {
      if (role.id === snapshot.id) continue; // @everyone
      if (role.managed) continue; // bot/integration roles are never touched
      if (!role.editable) {
        keptRoles.push(role.name);
        continue;
      }
      actions.push({ phase: 'cleanup', type: 'deleteRole', id: role.id, name: role.name });
      deletedRoleIds.add(role.id);
    }
    if (keptNames.length) {
      warnings.push(
        `Clean build will keep ${keptNames.length} channel(s) it can't or shouldn't delete: ${keptNames.slice(0, 10).join(', ')}${keptNames.length > 10 ? '…' : ''}`,
      );
    }
    if (keptRoles.length) {
      warnings.push(
        `Clean build can't delete ${keptRoles.length} role(s) above ServerForge's role: ${keptRoles.slice(0, 10).join(', ')}`,
      );
    }
  }

  const liveRoles = snapshot.roles.filter((r) => !deletedRoleIds.has(r.id) && r.id !== snapshot.id);
  const liveChannels = snapshot.channels.filter((c) => !deletedChannelIds.has(c.id));
  const roleById = new Map(liveRoles.map((r) => [r.id, r]));
  const channelById = new Map(liveChannels.map((c) => [c.id, c]));
  const claimedRoles = new Set<string>();
  const claimedChannels = new Set<string>();

  // Pre-claim every tracked id that still exists so name-adoption never steals them.
  for (const record of tracked) {
    if (record.kind === 'role' && roleById.has(record.discordId))
      claimedRoles.add(record.discordId);
    if (
      (record.kind === 'channel' || record.kind === 'category') &&
      channelById.has(record.discordId)
    ) {
      claimedChannels.add(record.discordId);
    }
  }

  const findRole = (key: string, name: string): SnapshotRole | null => {
    const record = trackedByKey.get(roleKey(key));
    if (record) {
      const existing = roleById.get(record.discordId);
      if (existing) return existing;
    }
    if (mode === 'clean') return null;
    const match = liveRoles.find(
      (r) => !r.managed && !claimedRoles.has(r.id) && r.name.toLowerCase() === name.toLowerCase(),
    );
    if (match) {
      claimedRoles.add(match.id);
      adoptions.push({ key: roleKey(key), kind: 'role', discordId: match.id, name: match.name });
      if (!match.editable) {
        warnings.push(
          `Existing role "${match.name}" is above ServerForge's role — it will be used, but ServerForge can't assign or reorder it. Drag the ServerForge role higher in Server Settings → Roles.`,
        );
      }
    }
    return match ?? null;
  };

  const findChannel = (
    key: string,
    name: string,
    type: ChannelKind | 'category',
    parentId: string | null | undefined,
  ): SnapshotChannel | null => {
    const record = trackedByKey.get(channelKey(key));
    if (record) {
      const existing = channelById.get(record.discordId);
      if (existing) return existing;
    }
    if (mode === 'clean') return null;
    const wanted = normalizeChannelName(name, type);
    const match = liveChannels.find(
      (c) =>
        !claimedChannels.has(c.id) &&
        compatibleType(c.type, type) &&
        normalizeChannelName(c.name, c.type) === wanted &&
        // Channels must be in the expected category (undefined = parent will be created → no match).
        (type === 'category' || (parentId !== undefined && c.parentId === parentId)),
    );
    if (match) {
      claimedChannels.add(match.id);
      adoptions.push({
        key: channelKey(key),
        kind: type === 'category' ? 'category' : 'channel',
        discordId: match.id,
        name: match.name,
      });
    }
    return match ?? null;
  };

  // ── Roles ───────────────────────────────────────────────────────────────
  let rolesCreated = 0;
  let rolesKept = 0;
  for (const role of template.roles) {
    const existing = findRole(role.key, role.name);
    if (existing) {
      resolvedRoles[role.key] = existing.id;
      rolesKept += 1;
    } else {
      actions.push({ phase: 'roles', type: 'createRole', key: role.key, spec: role });
      rolesCreated += 1;
    }
  }

  let updateEveryone = false;
  if (template.everyone) {
    const desired = permissionsToBits(template.everyone.permissions);
    if (BigInt(snapshot.everyonePermissions) !== desired) {
      actions.push({
        phase: 'roles',
        type: 'updateEveryone',
        permissions: template.everyone.permissions,
      });
      updateEveryone = true;
    }
  }

  // Keep template roles in template order (below the bot's role).
  const rolesOutOfOrder = (() => {
    const positions = template.roles
      .map((r) => resolvedRoles[r.key])
      .map((id) => (id ? roleById.get(id) : undefined))
      .filter((r): r is SnapshotRole => r !== undefined && r.editable)
      .map((r) => r.position);
    return positions.some((p, i) => i > 0 && p >= (positions[i - 1] ?? Infinity));
  })();
  if (template.roles.length > 1 && (rolesCreated > 0 || rolesOutOfOrder)) {
    actions.push({ phase: 'roles', type: 'orderRoles', keys: template.roles.map((r) => r.key) });
  }

  // ── Categories ──────────────────────────────────────────────────────────
  let categoriesCreated = 0;
  const categoryIdByKey = new Map<string, string | undefined>();
  const existingOverwriteTargets: {
    key: string;
    channel: SnapshotChannel;
    overwrites: OverwriteSpec[];
  }[] = [];
  for (const category of template.categories) {
    const existing = findChannel(category.key, category.name, 'category', null);
    if (existing) {
      resolvedChannels[category.key] = existing.id;
      categoryIdByKey.set(category.key, existing.id);
      existingOverwriteTargets.push({
        key: category.key,
        channel: existing,
        overwrites: category.overwrites,
      });
    } else {
      categoryIdByKey.set(category.key, undefined);
      actions.push({
        phase: 'categories',
        type: 'createCategory',
        key: category.key,
        name: category.name,
        overwrites: category.overwrites,
      });
      categoriesCreated += 1;
    }
  }

  // ── Channels ────────────────────────────────────────────────────────────
  const channelsByType: Record<string, number> = {};
  let channelsCreated = 0;
  let channelsKept = 0;
  const communityChannelActions: PlanAction[] = [];
  let conversions = 0;
  for (const desired of desiredChannels(template)) {
    const parentId = desired.parentKey === null ? null : categoryIdByKey.get(desired.parentKey);
    const existing = findChannel(desired.key, desired.spec.name, desired.spec.type, parentId);
    if (existing) {
      resolvedChannels[desired.key] = existing.id;
      channelsKept += 1;
      existingOverwriteTargets.push({
        key: desired.key,
        channel: existing,
        overwrites: desired.overwrites,
      });
      // e.g. upgrading Pro → Elite turns #announcements into a followable announcement channel
      if (desired.spec.type === 'announcement' && existing.type === 'text') {
        communityChannelActions.push({
          phase: 'channels',
          type: 'convertToAnnouncement',
          key: desired.key,
        });
        conversions += 1;
      }
      continue;
    }
    const action: PlanAction = {
      phase: 'channels',
      type: 'createChannel',
      key: desired.key,
      spec: desired.spec,
      parentKey: desired.parentKey,
      overwrites: desired.overwrites,
    };
    if ((COMMUNITY_ONLY as readonly string[]).includes(desired.spec.type))
      communityChannelActions.push(action);
    else actions.push(action);
    channelsCreated += 1;
    channelsByType[desired.spec.type] = (channelsByType[desired.spec.type] ?? 0) + 1;
  }

  // ── Community ───────────────────────────────────────────────────────────
  let enableCommunity = false;
  if (
    template.community.enabled &&
    !snapshot.features.includes('COMMUNITY') &&
    template.community.rulesChannel &&
    template.community.updatesChannel
  ) {
    actions.push({
      phase: 'community',
      type: 'enableCommunity',
      rulesKey: template.community.rulesChannel,
      updatesKey: template.community.updatesChannel,
    });
    enableCommunity = true;
  }
  actions.push(...communityChannelActions);

  if (categoriesCreated + channelsCreated > 0) {
    const layout: ChannelLayout = {
      categories: template.categories.map((c) => c.key),
      channels: { '': template.channels.map((c) => c.key) },
    };
    for (const category of template.categories)
      layout.channels[category.key] = category.channels.map((c) => c.key);
    actions.push({ phase: 'channels', type: 'orderChannels', layout });
  }

  // ── Overwrite repair on existing channels ───────────────────────────────
  let overwriteSyncs = 0;
  for (const { key, channel, overwrites } of existingOverwriteTargets) {
    if (overwritesDiffer(channel, overwrites, resolvedRoles, snapshot.id)) {
      actions.push({ phase: 'overwrites', type: 'syncOverwrites', key, overwrites });
      overwriteSyncs += 1;
    }
  }

  // ── Messages ────────────────────────────────────────────────────────────
  let messagesCreated = 0;
  const existingMessages = new Set(snapshot.existingMessages);
  for (const message of template.messages) {
    const record = trackedByKey.get(messageKey(message.key));
    const channelStillExists = record?.channelId ? channelById.has(record.channelId) : false;
    if (record && channelStillExists && existingMessages.has(messageKey(message.key))) continue;
    actions.push({ phase: 'messages', type: 'postMessage', key: message.key, spec: message });
    messagesCreated += 1;
  }

  // ── Modules ─────────────────────────────────────────────────────────────
  const modules = enabledModules(template);
  for (const moduleId of modules) actions.push({ phase: 'modules', type: 'applyModule', moduleId });

  return {
    kind,
    mode,
    templateId: template.id,
    actions,
    adoptions,
    resolved: { roles: resolvedRoles, channels: resolvedChannels },
    warnings,
    summary: {
      create: {
        roles: rolesCreated,
        categories: categoriesCreated,
        channels: channelsCreated,
        messages: messagesCreated,
      },
      channelsByType,
      remove: { roles: deletedRoleIds.size, channels: deletedChannelIds.size },
      keep: { roles: rolesKept, channels: channelsKept },
      adopted: adoptions.length,
      overwriteSyncs,
      conversions,
      modules,
      enableCommunity,
      updateEveryone,
    },
  };
}

/**
 * Does an existing channel's overwrite for any *template* role differ from the template?
 * Overwrites for roles/members outside the template are customer additions and ignored.
 * Overwrites for roles that don't exist yet always count as a difference.
 */
export function overwritesDiffer(
  channel: SnapshotChannel,
  desired: readonly OverwriteSpec[],
  resolvedRoles: Readonly<Record<string, string>>,
  everyoneId: string,
): boolean {
  for (const o of desired) {
    const targetId = o.role === 'everyone' ? everyoneId : resolvedRoles[o.role];
    if (!targetId) return true;
    const current = channel.overwrites.find((x) => x.type === 'role' && x.id === targetId);
    const allow = permissionsToBits(o.allow);
    const deny = permissionsToBits(o.deny);
    if (!current) {
      if (allow !== 0n || deny !== 0n) return true;
      continue;
    }
    if (BigInt(current.allow) !== allow || BigInt(current.deny) !== deny) return true;
  }
  return false;
}

/** Number of actions per phase (for progress reporting). */
export function countByPhase(actions: readonly PlanAction[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const a of actions) counts[a.phase] = (counts[a.phase] ?? 0) + 1;
  return counts;
}
