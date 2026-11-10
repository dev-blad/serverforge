import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * License key format: FORGE-XXXX-XXXX-XXXX
 *
 * 12 random characters from a 32-symbol alphabet that omits look-alikes (0/O, 1/I) → 60 bits
 * of entropy from a CSPRNG. Only an HMAC-SHA256 (keyed with LICENSE_PEPPER) is stored, so a
 * leaked database can't be used to recover or brute-force keys offline.
 */
export const KEY_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const KEY_PREFIX = 'FORGE';
const GROUPS = 3;
const GROUP_LENGTH = 4;
const KEY_PATTERN = new RegExp(`^${KEY_PREFIX}(-[${KEY_ALPHABET}]{${GROUP_LENGTH}}){${GROUPS}}$`);

export function generateKey(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g += 1) {
    let group = '';
    for (let i = 0; i < GROUP_LENGTH; i += 1) group += KEY_ALPHABET[randomInt(KEY_ALPHABET.length)];
    groups.push(group);
  }
  return `${KEY_PREFIX}-${groups.join('-')}`;
}

/**
 * Normalise user input: trims, uppercases, removes spaces and accepts keys typed without
 * dashes. Returns null if the result is not a well-formed key.
 */
export function normalizeKey(input: string): string | null {
  const compact = input.toUpperCase().replace(/[\s-]/g, '');
  if (!compact.startsWith(KEY_PREFIX)) return null;
  const body = compact.slice(KEY_PREFIX.length);
  if (body.length !== GROUPS * GROUP_LENGTH) return null;
  const parts: string[] = [];
  for (let i = 0; i < body.length; i += GROUP_LENGTH) parts.push(body.slice(i, i + GROUP_LENGTH));
  const key = `${KEY_PREFIX}-${parts.join('-')}`;
  return KEY_PATTERN.test(key) ? key : null;
}

export function isWellFormedKey(input: string): boolean {
  return normalizeKey(input) !== null;
}

export function hashKey(key: string, pepper: string): string {
  return createHmac('sha256', pepper).update(key).digest('hex');
}

export function hashesEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function lastFour(key: string): string {
  return key.slice(-4);
}

export function maskKey(last4: string): string {
  return `${KEY_PREFIX}-****-****-${last4}`;
}
