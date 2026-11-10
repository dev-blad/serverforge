import type { z } from 'zod';
import {
  COMMUNITY_ONLY,
  TEXT_LIKE,
  type ChannelKind,
  type ChannelSpec,
  type Template,
} from './schema.js';
import {
  CUSTOMER_PLACEHOLDERS,
  RUNTIME_PLACEHOLDERS,
  findPlaceholders,
} from './placeholders.js';

export const DISCORD_LIMITS = {
  roles: 250,
  channels: 500,
  channelsPerCategory: 50,
  automod: { keyword: 6, spam: 1, mentionSpam: 1, keywordPreset: 1 },
} as const;

/** Format a zod error with readable paths that use entry keys instead of array indexes. */
export function formatZodError(error: z.ZodError, data: unknown): string[] {
  return error.issues.map((issue) => `${readablePath(issue.path, data)}: ${issue.message}`);
}

export function readablePath(path: readonly PropertyKey[], data: unknown): string {
  let out = '';
  let cursor: unknown = data;
  for (const segment of path) {
    if (typeof segment === 'number') {
      const item: unknown = Array.isArray(cursor) ? cursor[segment] : undefined;
      const key =
        item && typeof item === 'object' && 'key' in item && typeof item.key === 'string'
          ? item.key
          : undefined;
      out += key ? `[${key}]` : `[${segment}]`;
      cursor = item;
    } else {
      out += out ? `.${String(segment)}` : String(segment);
      cursor =
        cursor && typeof cursor === 'object'
          ? (cursor as Record<PropertyKey, unknown>)[segment]
          : undefined;
    }
  }
  return out || '(root)';
}

export interface ChannelIndexEntry {
  kind: ChannelKind | 'category';
  spec?: ChannelSpec;
  categoryKey?: string;
}

/** Map every category / channel key to its kind. */
export function indexChannels(template: Template): Map<string, ChannelIndexEntry> {
  // First definition wins; duplicates are reported by validateSemantics.
  const index = new Map<string, ChannelIndexEntry>();
  const add = (key: string, entry: ChannelIndexEntry) => {
    if (!index.has(key)) index.set(key, entry);
  };
  for (const channel of template.channels) add(channel.key, { kind: channel.type, spec: channel });
  for (const category of template.categories) {
    add(category.key, { kind: 'category' });
    for (const channel of category.channels) {
      add(channel.key, { kind: channel.type, spec: channel, categoryKey: category.key });
    }
  }
  return index;
}

function collectStrings(value: unknown, path: string, out: { path: string; text: string }[]): void {
  if (typeof value === 'string') out.push({ path, text: value });
  else if (Array.isArray(value)) {
    value.forEach((v: unknown, i) => {
      const key =
        v && typeof v === 'object' && 'key' in v && typeof v.key === 'string' ? v.key : String(i);
      collectStrings(v, `${path}[${key}]`, out);
    });
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) collectStrings(v, path ? `${path}.${k}` : k, out);
  }
}

/**
 * Cross-reference checks zod can't express: unique keys, references to roles/channels that
 * exist and have the right type, Discord limits, community requirements and placeholders.
 * Returns a list of human-readable problems (empty = valid).
 */
export function validateSemantics(template: Template): string[] {
  const errors: string[] = [];
  const roleKeys = new Set<string>();
  for (const role of template.roles) {
    if (role.key === 'everyone') errors.push(`roles[everyone]: "everyone" is a reserved key`);
    if (roleKeys.has(role.key)) errors.push(`roles[${role.key}]: duplicate role key`);
    roleKeys.add(role.key);
  }

  const seenChannelKeys = new Set<string>();
  const allChannelEntries: { key: string; where: string }[] = [
    ...template.channels.map((c) => ({ key: c.key, where: `channels[${c.key}]` })),
    ...template.categories.flatMap((cat) => [
      { key: cat.key, where: `categories[${cat.key}]` },
      ...cat.channels.map((c) => ({
        key: c.key,
        where: `categories[${cat.key}].channels[${c.key}]`,
      })),
    ]),
  ];
  for (const entry of allChannelEntries) {
    if (seenChannelKeys.has(entry.key)) {
      errors.push(`${entry.where}: duplicate channel/category key "${entry.key}"`);
    }
    seenChannelKeys.add(entry.key);
  }

  const channels = indexChannels(template);

  const checkRole = (key: string, where: string) => {
    if (key !== 'everyone' && !roleKeys.has(key)) {
      errors.push(`${where}: unknown role "${key}"`);
    }
  };
  const checkChannel = (
    key: string | undefined,
    where: string,
    allowed: readonly (ChannelKind | 'category')[],
  ) => {
    if (key === undefined) return;
    const entry = channels.get(key);
    if (!entry) errors.push(`${where}: unknown channel "${key}"`);
    else if (!allowed.includes(entry.kind)) {
      errors.push(`${where}: channel "${key}" is a ${entry.kind}, expected ${allowed.join(' or ')}`);
    }
  };

  // Overwrites
  for (const category of template.categories) {
    category.overwrites.forEach((o) => checkRole(o.role, `categories[${category.key}].overwrites`));
    for (const channel of category.channels) {
      channel.overwrites?.forEach((o) =>
        checkRole(o.role, `categories[${category.key}].channels[${channel.key}].overwrites`),
      );
    }
  }
  for (const channel of template.channels) {
    channel.overwrites?.forEach((o) => checkRole(o.role, `channels[${channel.key}].overwrites`));
  }

  // Channel-type specific options
  for (const [key, entry] of channels) {
    const spec = entry.spec;
    if (!spec) continue;
    const where = entry.categoryKey
      ? `categories[${entry.categoryKey}].channels[${key}]`
      : `channels[${key}]`;
    if (spec.tags && spec.type !== 'forum') errors.push(`${where}: tags are only valid on forums`);
    if ((spec.userLimit !== undefined || spec.bitrate !== undefined) && !['voice', 'stage'].includes(spec.type)) {
      errors.push(`${where}: userLimit/bitrate are only valid on voice/stage channels`);
    }
  }

  // Limits
  if (template.roles.length > DISCORD_LIMITS.roles) {
    errors.push(`roles: ${template.roles.length} roles exceeds Discord's limit of ${DISCORD_LIMITS.roles}`);
  }
  if (channels.size > DISCORD_LIMITS.channels) {
    errors.push(`channels: ${channels.size} channels exceeds Discord's limit of ${DISCORD_LIMITS.channels}`);
  }

  // Community
  const communityChannels = [...channels.entries()].filter(([, e]) =>
    (COMMUNITY_ONLY as readonly string[]).includes(e.kind),
  );
  if (communityChannels.length > 0 && !template.community.enabled) {
    errors.push(
      `community: channels ${communityChannels.map(([k]) => `"${k}"`).join(', ')} need the Community feature; set community.enabled: true`,
    );
  }
  if (template.community.enabled) {
    if (!template.community.rulesChannel || !template.community.updatesChannel) {
      errors.push('community: rulesChannel and updatesChannel are required when enabled');
    }
    checkChannel(template.community.rulesChannel, 'community.rulesChannel', ['text']);
    checkChannel(template.community.updatesChannel, 'community.updatesChannel', ['text']);
  }

  // Messages
  const messageKeys = new Set<string>();
  for (const message of template.messages) {
    if (messageKeys.has(message.key)) errors.push(`messages[${message.key}]: duplicate message key`);
    messageKeys.add(message.key);
    checkChannel(message.channel, `messages[${message.key}].channel`, TEXT_LIKE);
    if (!message.content && message.embeds.length === 0) {
      errors.push(`messages[${message.key}]: needs content or at least one embed`);
    }
  }
  checkChannel(template.summaryChannel, 'summaryChannel', TEXT_LIKE);

  // Modules
  const m = template.modules;
  if (m.autoRole) {
    if (m.autoRole.memberRole) checkRole(m.autoRole.memberRole, 'modules.autoRole.memberRole');
    if (m.autoRole.botRole) checkRole(m.autoRole.botRole, 'modules.autoRole.botRole');
  }
  if (m.verification) {
    checkChannel(m.verification.channel, 'modules.verification.channel', TEXT_LIKE);
    checkRole(m.verification.verifiedRole, 'modules.verification.verifiedRole');
  }
  if (m.buttonRoles) {
    const panelKeys = new Set<string>();
    for (const panel of m.buttonRoles.panels) {
      if (panelKeys.has(panel.key)) errors.push(`modules.buttonRoles.panels[${panel.key}]: duplicate key`);
      panelKeys.add(panel.key);
      checkChannel(panel.channel, `modules.buttonRoles.panels[${panel.key}].channel`, TEXT_LIKE);
      for (const button of panel.buttons) {
        checkRole(button.role, `modules.buttonRoles.panels[${panel.key}].buttons[${button.key}].role`);
      }
    }
  }
  if (m.logging) {
    checkChannel(m.logging.modLog, 'modules.logging.modLog', TEXT_LIKE);
    checkChannel(m.logging.joinLeaveLog, 'modules.logging.joinLeaveLog', TEXT_LIKE);
  }
  if (m.automod) {
    const counts: Record<string, number> = {};
    for (const rule of m.automod.rules) {
      const where = `modules.automod.rules[${rule.key}]`;
      counts[rule.type] = (counts[rule.type] ?? 0) + 1;
      checkChannel(rule.alertChannel, `${where}.alertChannel`, TEXT_LIKE);
      rule.exemptRoles.forEach((r) => checkRole(r, `${where}.exemptRoles`));
      if (rule.type === 'keyword' && rule.keywords.length === 0 && rule.regex.length === 0) {
        errors.push(`${where}: keyword rules need keywords or regex`);
      }
      if (rule.type === 'keywordPreset' && rule.presets.length === 0) {
        errors.push(`${where}: keywordPreset rules need at least one preset`);
      }
      if (rule.timeoutSeconds !== undefined && !['keyword', 'mentionSpam'].includes(rule.type)) {
        errors.push(`${where}: timeoutSeconds is only supported for keyword and mentionSpam rules`);
      }
    }
    for (const [type, limit] of Object.entries(DISCORD_LIMITS.automod)) {
      if ((counts[type] ?? 0) > limit) {
        errors.push(`modules.automod: at most ${limit} "${type}" rule(s) allowed by Discord`);
      }
    }
  }
  if (m.tickets) {
    checkChannel(m.tickets.panelChannel, 'modules.tickets.panelChannel', TEXT_LIKE);
    checkChannel(m.tickets.category, 'modules.tickets.category', ['category']);
    checkChannel(m.tickets.logChannel, 'modules.tickets.logChannel', TEXT_LIKE);
    m.tickets.staffRoles.forEach((r) => checkRole(r, 'modules.tickets.staffRoles'));
  }
  if (m.memberStats) {
    checkChannel(m.memberStats.channel, 'modules.memberStats.channel', ['voice']);
  }

  // Placeholders
  const strings: { path: string; text: string }[] = [];
  collectStrings(template, '', strings);
  const known = new Set<string>([...CUSTOMER_PLACEHOLDERS, ...RUNTIME_PLACEHOLDERS]);
  for (const { path, text } of strings) {
    for (const use of findPlaceholders(text)) {
      if (use.arg !== undefined) {
        if (use.name === 'channel') {
          if (!channels.has(use.arg)) errors.push(`${path}: ${use.raw} references unknown channel`);
        } else if (use.name === 'role') {
          if (!roleKeys.has(use.arg)) errors.push(`${path}: ${use.raw} references unknown role`);
        } else {
          errors.push(`${path}: unknown placeholder ${use.raw}`);
        }
      } else if (!known.has(use.name)) {
        errors.push(
          `${path}: unknown placeholder ${use.raw} (known: ${[...known].map((k) => `{{${k}}}`).join(', ')}, {{channel:key}}, {{role:key}})`,
        );
      }
    }
  }

  return errors;
}
