import type { Template } from '../template/schema.js';
import { DISCORD_LIMITS } from '../template/validate.js';
import { permissionsUsedBy } from './permissions.js';
import type { BuildPlan, GuildSnapshot } from './types.js';

export interface PreflightResult {
  ok: boolean;
  /** Blocking problems — nothing will be built until they're fixed. */
  errors: string[];
  /** Things the customer should know but that don't block the build. */
  warnings: string[];
}

/**
 * Checks run before anything is changed: bot permissions, role hierarchy, Discord limits and
 * side effects worth warning about. Pure function over the snapshot and the plan.
 */
export function preflight(
  snapshot: GuildSnapshot,
  template: Template,
  buildPlan: BuildPlan,
): PreflightResult {
  const errors: string[] = [];
  const warnings: string[] = [...buildPlan.warnings];

  // ── Permissions ──
  if (!snapshot.bot.isAdmin) {
    const have = new Set(snapshot.bot.permissions);
    const missing = permissionsUsedBy(template).filter((p) => !have.has(p));
    if (missing.length > 0) {
      errors.push(
        `ServerForge is missing permissions: **${missing.join(', ')}**. The easiest fix is to give the ServerForge role **Administrator** (Server Settings → Roles → ServerForge), or re-invite the bot with the invite link.`,
      );
    } else {
      warnings.push(
        'ServerForge does not have Administrator. The build should work, but Administrator is recommended so private channels and modules always work.',
      );
    }
  }

  // ── Hierarchy ──
  const botPosition = snapshot.bot.highestRolePosition;
  if (botPosition <= 0) {
    errors.push(
      'ServerForge has no role in this server. Please re-invite it with the invite link so it gets its own role.',
    );
  }
  const higherCustomRoles = snapshot.roles.filter(
    (r) => r.id !== snapshot.id && !r.managed && r.position > botPosition,
  );
  if (higherCustomRoles.length > 0) {
    warnings.push(
      `ServerForge's role is below ${higherCustomRoles.length} role(s) (${higherCustomRoles
        .slice(0, 5)
        .map((r) => `"${r.name}"`)
        .join(
          ', ',
        )}). For best results drag the **ServerForge** role to the top in Server Settings → Roles.`,
    );
  }

  // Roles a module must *assign* have to be below the bot.
  const assignedRoleKeys = new Set<string>();
  const m = template.modules;
  if (m.verification?.enabled) assignedRoleKeys.add(m.verification.verifiedRole);
  if (m.autoRole?.enabled) {
    if (m.autoRole.memberRole) assignedRoleKeys.add(m.autoRole.memberRole);
    if (m.autoRole.botRole) assignedRoleKeys.add(m.autoRole.botRole);
  }
  if (m.buttonRoles?.enabled)
    m.buttonRoles.panels.forEach((p) => p.buttons.forEach((b) => assignedRoleKeys.add(b.role)));
  for (const key of assignedRoleKeys) {
    const id = buildPlan.resolved.roles[key];
    const role = id ? snapshot.roles.find((r) => r.id === id) : undefined;
    if (role && !role.editable) {
      errors.push(
        `The existing role **${role.name}** is above ServerForge's role, but ServerForge needs to assign it. Drag the **ServerForge** role above it in Server Settings → Roles, then try again.`,
      );
    }
  }

  // ── Limits ──
  const s = buildPlan.summary;
  const projectedRoles = snapshot.roles.length - s.remove.roles + s.create.roles;
  if (projectedRoles > DISCORD_LIMITS.roles) {
    errors.push(
      `This build would bring the server to ${projectedRoles} roles; Discord allows ${DISCORD_LIMITS.roles}. Delete some roles or use **Clean build**.`,
    );
  }
  const projectedChannels =
    snapshot.channels.length - s.remove.channels + s.create.channels + s.create.categories;
  if (projectedChannels > DISCORD_LIMITS.channels) {
    errors.push(
      `This build would bring the server to ${projectedChannels} channels; Discord allows ${DISCORD_LIMITS.channels}. Delete some channels or use **Clean build**.`,
    );
  }
  for (const category of template.categories) {
    const id = buildPlan.resolved.channels[category.key];
    if (!id) continue;
    const existingChildren = snapshot.channels.filter((c) => c.parentId === id).length;
    const newChildren = buildPlan.actions.filter(
      (a) => a.type === 'createChannel' && a.parentKey === category.key,
    ).length;
    if (existingChildren + newChildren > DISCORD_LIMITS.channelsPerCategory) {
      errors.push(
        `Category "${category.name}" would have ${existingChildren + newChildren} channels; Discord allows ${DISCORD_LIMITS.channelsPerCategory} per category.`,
      );
    }
  }

  // ── Side effects worth knowing ──
  if (s.enableCommunity) {
    warnings.push(
      'Discord **Community** will be enabled (needed for announcement & stage channels). This sets verification level to *Low* and scans media from all members.',
    );
  }
  if (s.updateEveryone && template.modules.verification?.enabled) {
    warnings.push(
      'New members will only see the verification channel until they click **Verify**. Existing members are verified automatically.',
    );
  }
  if (buildPlan.mode === 'clean' && (s.remove.channels > 0 || s.remove.roles > 0)) {
    warnings.push(
      `**Clean build deletes ${s.remove.channels} channel(s) and ${s.remove.roles} role(s). This cannot be undone — rollback only removes what ServerForge creates.**`,
    );
  }

  return { ok: errors.length === 0, errors, warnings };
}
