import { stringify } from 'yaml';
import { bitsToPermissions } from '../builder/permissions.js';
import type { SnapshotChannelType } from '../builder/types.js';
import { compileTemplates, type RawTemplateFile } from './loader.js';
import type { RawTemplate } from './inheritance.js';
import type { Tier } from './schema.js';

/**
 * /forge capture — turn a hand-designed Discord server into a template file, so the seller can
 * design templates visually and export them. Pure: works on plain data captured from a guild.
 */

export interface CaptureRole {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  mentionable: boolean;
  permissions: string;
  position: number;
  managed: boolean;
}

export interface CaptureChannel {
  id: string;
  name: string;
  type: SnapshotChannelType;
  parentId: string | null;
  position: number;
  topic: string | null;
  slowmode: number;
  nsfw: boolean;
  userLimit: number | null;
  bitrate: number | null;
  tags: { name: string; emoji: string | null; moderated: boolean }[];
  overwrites: { id: string; type: 'role' | 'member'; allow: string; deny: string }[];
}

export interface CaptureSource {
  guildId: string;
  guildName: string;
  everyonePermissions: string;
  features: string[];
  rulesChannelId: string | null;
  publicUpdatesChannelId: string | null;
  roles: CaptureRole[];
  channels: CaptureChannel[];
}

export interface CaptureOptions {
  id: string;
  name: string;
  tier: Tier;
  description?: string;
}

export interface CaptureResult {
  template: RawTemplate;
  yaml: string;
  warnings: string[];
}

export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'item';
}

function uniqueKey(base: string, used: Set<string>): string {
  let key = base;
  let n = 2;
  while (used.has(key) || key === 'everyone') key = `${base}-${n++}`;
  used.add(key);
  return key;
}

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0').toUpperCase()}`;
}

/** Build a template object from a captured guild. */
export function captureTemplate(source: CaptureSource, options: CaptureOptions): CaptureResult {
  const warnings: string[] = [];
  const roleKeys = new Map<string, string>();
  const usedRoleKeys = new Set<string>();

  const roles = source.roles
    .filter((r) => r.id !== source.guildId && !r.managed)
    .sort((a, b) => b.position - a.position)
    .map((r) => {
      const key = uniqueKey(slugify(r.name), usedRoleKeys);
      roleKeys.set(r.id, key);
      const permissions = bitsToPermissions(r.permissions);
      return {
        key,
        name: r.name,
        ...(r.color ? { color: hex(r.color) } : {}),
        ...(r.hoist ? { hoist: true } : {}),
        ...(r.mentionable ? { mentionable: true } : {}),
        ...(permissions.length ? { permissions } : {}),
      };
    });
  const skippedManaged = source.roles.filter((r) => r.managed).length;
  if (skippedManaged) warnings.push(`Skipped ${skippedManaged} bot/integration-managed role(s).`);

  let memberOverwrites = 0;
  const overwrites = (list: CaptureChannel['overwrites']) =>
    list
      .filter((o) => {
        if (o.type === 'member') memberOverwrites += 1;
        return o.type === 'role' && (o.id === source.guildId || roleKeys.has(o.id));
      })
      .map((o) => {
        const allow = bitsToPermissions(o.allow);
        const deny = bitsToPermissions(o.deny);
        return {
          role: o.id === source.guildId ? 'everyone' : (roleKeys.get(o.id) ?? 'everyone'),
          ...(allow.length ? { allow } : {}),
          ...(deny.length ? { deny } : {}),
        };
      })
      .filter((o) => 'allow' in o || 'deny' in o);

  const usedChannelKeys = new Set<string>();
  const channelKeys = new Map<string, string>();
  const byPosition = (a: CaptureChannel, b: CaptureChannel) => a.position - b.position;
  const supported = source.channels.filter((c) => c.type !== 'other');
  const skippedChannels = source.channels.length - supported.length;
  if (skippedChannels)
    warnings.push(
      `Skipped ${skippedChannels} channel(s) of unsupported types (e.g. media/directory).`,
    );

  const channelEntry = (
    c: CaptureChannel,
    categoryOverwrites: ReturnType<typeof overwrites> | null,
  ) => {
    const key = uniqueKey(slugify(c.name), usedChannelKeys);
    channelKeys.set(c.id, key);
    const own = overwrites(c.overwrites);
    const synced =
      categoryOverwrites !== null && JSON.stringify(own) === JSON.stringify(categoryOverwrites);
    const type = c.type as Exclude<SnapshotChannelType, 'other' | 'category'>;
    return {
      key,
      name: c.name,
      ...(type !== 'text' ? { type } : {}),
      ...(c.topic ? { topic: c.topic.slice(0, 1024) } : {}),
      ...(c.slowmode ? { slowmode: c.slowmode } : {}),
      ...(c.nsfw ? { nsfw: true } : {}),
      ...((type === 'voice' || type === 'stage') && c.userLimit ? { userLimit: c.userLimit } : {}),
      ...(type === 'forum' && c.tags.length
        ? {
            tags: c.tags.slice(0, 20).map((t) => ({
              name: t.name.slice(0, 20),
              ...(t.emoji ? { emoji: t.emoji } : {}),
              ...(t.moderated ? { moderated: true } : {}),
            })),
          }
        : {}),
      // Channels whose permissions match their category stay synced (overwrites omitted).
      ...(!synced && (own.length || categoryOverwrites?.length) ? { overwrites: own } : {}),
    };
  };

  const categories = supported
    .filter((c) => c.type === 'category')
    .sort(byPosition)
    .map((cat) => {
      const key = uniqueKey(slugify(cat.name), usedChannelKeys);
      channelKeys.set(cat.id, key);
      const catOverwrites = overwrites(cat.overwrites);
      return {
        key,
        name: cat.name,
        ...(catOverwrites.length ? { overwrites: catOverwrites } : {}),
        channels: supported
          .filter((c) => c.parentId === cat.id && c.type !== 'category')
          .sort(byPosition)
          .map((c) => channelEntry(c, catOverwrites)),
      };
    });
  const topLevel = supported
    .filter((c) => c.parentId === null && c.type !== 'category')
    .sort(byPosition)
    .map((c) => channelEntry(c, null));

  if (memberOverwrites) {
    warnings.push(
      `Dropped ${memberOverwrites} per-user permission overwrite(s) — templates can only reference roles.`,
    );
  }

  const template: RawTemplate = {
    id: options.id,
    name: options.name,
    tier: options.tier,
    version: 1,
    description:
      options.description ??
      `Captured from "${source.guildName}" on ${new Date().toISOString().slice(0, 10)}`,
    everyone: { permissions: bitsToPermissions(source.everyonePermissions) },
    roles,
    categories,
    ...(topLevel.length ? { channels: topLevel } : {}),
  };

  const rulesKey = source.rulesChannelId ? channelKeys.get(source.rulesChannelId) : undefined;
  const updatesKey = source.publicUpdatesChannelId
    ? channelKeys.get(source.publicUpdatesChannelId)
    : undefined;
  const needsCommunity = supported.some((c) => c.type === 'stage' || c.type === 'announcement');
  if (source.features.includes('COMMUNITY') && rulesKey && updatesKey) {
    template['community'] = { enabled: true, rulesChannel: rulesKey, updatesChannel: updatesKey };
  } else if (needsCommunity) {
    warnings.push(
      'The server has announcement/stage channels but Community settings could not be captured — set community.rulesChannel/updatesChannel by hand.',
    );
  }

  const yaml = [
    `# Captured by ServerForge from "${source.guildName}".`,
    '# Review it, add messages/modules (see TEMPLATES.md), then move it next to the other templates.',
    stringify(template, { lineWidth: 120 }),
  ].join('\n');

  return { template, yaml, warnings };
}

/** Validate a captured template against the schema (and existing templates for id clashes). */
export function validateCaptured(result: CaptureResult, existing: RawTemplateFile[]): string[] {
  try {
    compileTemplates(
      [...existing, { file: `captured/${String(result.template.id)}.yaml`, raw: result.template }],
      {
        requireBaseTiers: false,
      },
    );
    return [];
  } catch (error) {
    return (error as Error).message
      .split('\n')
      .slice(1)
      .map((l) => l.replace(/^\s*•\s*/, ''))
      .filter(
        (l) => l.includes(`(${String(result.template.id)})`) || l.includes('duplicate template id'),
      );
  }
}
