import { PermissionFlagsBits } from 'discord.js';
import type { OverwriteSpec, PermissionName, Template } from '../template/schema.js';

export function permissionsToBits(names: readonly PermissionName[]): bigint {
  let bits = 0n;
  for (const name of names) bits |= PermissionFlagsBits[name];
  return bits;
}

export function bitsToPermissions(bits: bigint | string): PermissionName[] {
  const value = typeof bits === 'string' ? BigInt(bits) : bits;
  return (Object.keys(PermissionFlagsBits) as PermissionName[]).filter(
    (name) => (value & PermissionFlagsBits[name]) === PermissionFlagsBits[name],
  );
}

/**
 * Effective overwrites for a channel: the category's overwrites, with the channel's own
 * overwrites replacing entries for the same role. If the channel declares no overwrites it
 * simply syncs with its category.
 */
export function effectiveOverwrites(
  categoryOverwrites: readonly OverwriteSpec[],
  channelOverwrites: readonly OverwriteSpec[] | undefined,
): OverwriteSpec[] {
  if (!channelOverwrites) return [...categoryOverwrites];
  const byRole = new Map<string, OverwriteSpec>();
  for (const o of categoryOverwrites) byRole.set(o.role, o);
  for (const o of channelOverwrites) byRole.set(o.role, o);
  return [...byRole.values()];
}

/** The permissions the bot needs if it does not have Administrator. */
export const BASE_REQUIRED_PERMISSIONS: PermissionName[] = [
  'ManageRoles',
  'ManageChannels',
  'ManageGuild',
  'ViewChannel',
  'SendMessages',
  'EmbedLinks',
  'AttachFiles',
  'ReadMessageHistory',
  'ManageMessages',
  'ViewAuditLog',
];

/**
 * Every permission a template grants anywhere. Discord only lets a bot grant permissions
 * (in roles or overwrites) that it has itself, so without Administrator it needs all of these.
 */
export function permissionsUsedBy(template: Template): PermissionName[] {
  const used = new Set<PermissionName>(BASE_REQUIRED_PERMISSIONS);
  const add = (list: readonly PermissionName[]) => list.forEach((p) => used.add(p));
  template.roles.forEach((r) => add(r.permissions));
  if (template.everyone) add(template.everyone.permissions);
  const addOverwrites = (list: readonly OverwriteSpec[] | undefined) =>
    list?.forEach((o) => {
      add(o.allow);
      add(o.deny);
    });
  for (const category of template.categories) {
    addOverwrites(category.overwrites);
    category.channels.forEach((c) => addOverwrites(c.overwrites));
  }
  template.channels.forEach((c) => addOverwrites(c.overwrites));
  if (template.modules.automod?.enabled) used.add('ManageGuild');
  if (template.modules.tickets?.enabled) used.add('ManageChannels');
  if (template.modules.memberStats?.enabled) used.add('ManageChannels');
  return [...used];
}
