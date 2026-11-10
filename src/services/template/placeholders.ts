/**
 * Placeholder rendering.
 *
 * Two phases:
 *  1. Customer placeholders ({{serverName}}, {{brandColor}}, …) are rendered across the whole
 *     template as soon as the customer options are known (before planning).
 *  2. Reference placeholders ({{channel:rules}}, {{role:moderator}}) are rendered when a message
 *     is posted, because they need the Discord IDs of resources created during the build.
 */

export interface CustomerOptions {
  /** Display name used in embeds. Defaults to the guild name. */
  serverName: string;
  /** "#RRGGBB" */
  brandColor: string;
  ownerId: string;
  ownerName: string;
}

export const CUSTOMER_PLACEHOLDERS = [
  'serverName',
  'brandColor',
  'brandColorLight',
  'brandColorDark',
  'ownerMention',
  'ownerName',
  'tierName',
  'year',
] as const;
export type CustomerPlaceholder = (typeof CUSTOMER_PLACEHOLDERS)[number];

export const REFERENCE_PLACEHOLDERS = ['channel', 'role'] as const;

/** Runtime placeholders filled by modules (e.g. {{user}} in ticket messages). Left untouched. */
export const RUNTIME_PLACEHOLDERS = ['user', 'count'] as const;

const PLACEHOLDER = /\{\{\s*([a-zA-Z]+)(?::([a-z0-9_-]+))?\s*\}\}/g;

export interface PlaceholderUse {
  name: string;
  arg?: string;
  raw: string;
}

/** List every placeholder in a string. */
export function findPlaceholders(text: string): PlaceholderUse[] {
  const uses: PlaceholderUse[] = [];
  for (const match of text.matchAll(PLACEHOLDER)) {
    uses.push({ name: match[1] ?? '', raw: match[0], ...(match[2] ? { arg: match[2] } : {}) });
  }
  return uses;
}

export function normalizeHex(input: string): string | null {
  const trimmed = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed
      .split('')
      .map((c) => c + c)
      .join('')
      .toUpperCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed.toUpperCase()}`;
  return null;
}

export function hexToInt(hex: string): number {
  const normalized = normalizeHex(hex);
  if (!normalized) throw new Error(`Invalid hex colour "${hex}"`);
  return parseInt(normalized.slice(1), 16);
}

/** Mix a colour towards white (amount > 0) or black (amount < 0). amount in [-1, 1]. */
export function shade(hex: string, amount: number): string {
  const value = hexToInt(hex);
  const channels = [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  const mixed = channels.map((c) => Math.round(c + (target - c) * t));
  return `#${mixed
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

export function customerValues(
  options: CustomerOptions,
  tierName: string,
  now: Date = new Date(),
): Record<CustomerPlaceholder, string> {
  const brand = normalizeHex(options.brandColor) ?? '#5865F2';
  return {
    serverName: options.serverName,
    brandColor: brand,
    brandColorLight: shade(brand, 0.35),
    brandColorDark: shade(brand, -0.35),
    ownerMention: `<@${options.ownerId}>`,
    ownerName: options.ownerName,
    tierName,
    year: String(now.getUTCFullYear()),
  };
}

/** Replace customer placeholders in a string; unknown/reference/runtime ones are left as-is. */
export function renderString(text: string, values: Readonly<Record<string, string>>): string {
  return text.replace(PLACEHOLDER, (raw, name: string, arg: string | undefined) => {
    if (arg !== undefined) return raw;
    return Object.hasOwn(values, name) ? (values[name] ?? raw) : raw;
  });
}

/** Deep-render every string in a structure. Returns a new object. */
export function renderDeep<T>(value: T, values: Readonly<Record<string, string>>): T {
  if (typeof value === 'string') return renderString(value, values) as T;
  if (Array.isArray(value)) return value.map((v: unknown) => renderDeep(v, values)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = renderDeep(v, values);
    }
    return out as T;
  }
  return value;
}

export interface ReferenceIds {
  channels: Readonly<Record<string, string>>;
  roles: Readonly<Record<string, string>>;
}

/**
 * Render {{channel:key}} → <#id> and {{role:key}} → <@&id>. Unknown references render as
 * "#key" / "@key" so a message never shows raw braces to customers.
 */
export function renderReferences(text: string, ids: ReferenceIds): string {
  return text.replace(PLACEHOLDER, (raw, name: string, arg: string | undefined) => {
    if (arg === undefined) return raw;
    if (name === 'channel') return ids.channels[arg] ? `<#${ids.channels[arg]}>` : `#${arg}`;
    if (name === 'role') return ids.roles[arg] ? `<@&${ids.roles[arg]}>` : `@${arg}`;
    return raw;
  });
}

export function renderReferencesDeep<T>(value: T, ids: ReferenceIds): T {
  if (typeof value === 'string') return renderReferences(value, ids) as T;
  if (Array.isArray(value)) return value.map((v: unknown) => renderReferencesDeep(v, ids)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = renderReferencesDeep(v, ids);
    }
    return out as T;
  }
  return value;
}
