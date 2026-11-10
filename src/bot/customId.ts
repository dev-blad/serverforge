/**
 * Persistent custom IDs: `sf:<area>:<action>[:<arg>…]`.
 *
 * All interaction state lives in the database and is referenced from the custom ID, so
 * buttons and modals keep working after a restart (no in-memory collectors).
 */
export const CUSTOM_ID_PREFIX = 'sf';
const MAX_LENGTH = 100;
const SEGMENT = /^[A-Za-z0-9_-]+$/;

export interface ParsedCustomId {
  area: string;
  action: string;
  args: string[];
}

export function customId(area: string, action: string, ...args: string[]): string {
  for (const part of [area, action, ...args]) {
    if (!SEGMENT.test(part)) throw new Error(`Invalid custom id segment "${part}"`);
  }
  const id = [CUSTOM_ID_PREFIX, area, action, ...args].join(':');
  if (id.length > MAX_LENGTH) throw new Error(`Custom id too long (${id.length} > ${MAX_LENGTH})`);
  return id;
}

export function parseCustomId(id: string): ParsedCustomId | null {
  const parts = id.split(':');
  if (parts.length < 3 || parts[0] !== CUSTOM_ID_PREFIX) return null;
  const [, area, action, ...args] = parts;
  if (!area || !action || ![area, action, ...args].every((p) => SEGMENT.test(p))) return null;
  return { area, action, args };
}
