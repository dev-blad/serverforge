import { PermissionFlagsBits, type GuildMember, type Interaction } from 'discord.js';
import type { AppContext } from '../bot/types.js';
import { UserFacingError } from '../errors.js';
import { hexToInt } from '../services/template/placeholders.js';

/**
 * Helpers shared by the shop modules (status, vouches, store, giveaways…).
 */

/** Staff = Manage Server, or one of the module's staff roles. */
export function isStaff(
  member: Pick<GuildMember, 'permissions' | 'roles'>,
  staffRoleIds: readonly string[],
): boolean {
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  return staffRoleIds.some((id) => member.roles.cache.has(id));
}

export function requireStaff(interaction: Interaction, staffRoleIds: readonly string[]): void {
  if (!interaction.inCachedGuild() || !isStaff(interaction.member, staffRoleIds)) {
    throw new UserFacingError('Only staff can do that.', { title: 'Staff only' });
  }
}

/** "`Label       :` value" — labels padded so the boxes line up (same style as TixBot). */
export function box(label: string, value: string, width = 12): string {
  return `\`${label.padEnd(width)}:\` ${value}`;
}

/** ⭐⭐⭐⭐☆ */
export function stars(rating: number): string {
  const r = Math.max(0, Math.min(5, Math.round(rating)));
  return '⭐'.repeat(r) + '☆'.repeat(5 - r);
}

/** "$1,234.50" (currency symbol first; whole numbers keep 2 decimals for prices). */
export function money(amount: number, currency: string): string {
  const formatted = amount.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency}${formatted}`;
}

/** Parse "10", "10.5", "$10", "£1,000.00" → 10 / 10.5 / 1000. Null if not a price. */
export function parsePrice(input: string): number | null {
  const cleaned = input.replace(/[^\d.,-]/g, '').replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Discord timestamp markup, e.g. "in 2 hours" (style R) or a full date (style f). */
export function discordTime(date: Date, style: 'R' | 'f' | 'F' | 'd' = 'R'): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
}

/** "#0012" */
export function padNumber(n: number): string {
  return `#${String(n).padStart(4, '0')}`;
}

/** The buyer's brand colour from their build, or Discord blurple. */
export async function brandColor(ctx: Pick<AppContext, 'db'>, guildId: string): Promise<number> {
  const guild = await ctx.db.guilds.get(guildId);
  try {
    return guild ? hexToInt(guild.options.brandColor) : 0x5865f2;
  } catch {
    return 0x5865f2;
  }
}

/** Parse durations like "30m", "2h", "1d 12h", "1w" into milliseconds (null if invalid). */
export function parseDuration(input: string): number | null {
  const units: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
  };
  const parts = input
    .toLowerCase()
    .replace(/\s+/g, '')
    .match(/\d+[smhdw]/g);
  if (!parts || parts.join('') !== input.toLowerCase().replace(/\s+/g, '')) return null;
  const total = parts.reduce((sum, p) => sum + Number(p.slice(0, -1)) * units[p.slice(-1)]!, 0);
  return total > 0 ? total : null;
}

/** "2 days 3 hours" style label for a duration. */
export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return `${days} day${days === 1 ? '' : 's'}${rest ? ` ${rest} hour${rest === 1 ? '' : 's'}` : ''}`;
}
