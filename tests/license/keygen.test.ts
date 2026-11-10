import { describe, expect, it } from 'vitest';
import {
  KEY_ALPHABET,
  generateKey,
  hashKey,
  hashesEqual,
  isWellFormedKey,
  maskKey,
  normalizeKey,
} from '../../src/services/license/keygen.js';

describe('keygen', () => {
  it('generates FORGE-XXXX-XXXX-XXXX keys from the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i += 1) {
      const key = generateKey();
      expect(key).toMatch(/^FORGE-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
      expect(isWellFormedKey(key)).toBe(true);
    }
    expect(KEY_ALPHABET).not.toMatch(/[01IO]/);
  });

  it('produces unique keys', () => {
    const keys = new Set(Array.from({ length: 2000 }, generateKey));
    expect(keys.size).toBe(2000);
  });

  it('normalizes case, whitespace and missing dashes', () => {
    expect(normalizeKey('  forge-abcd-efgh-jkmn ')).toBe('FORGE-ABCD-EFGH-JKMN');
    expect(normalizeKey('FORGEABCDEFGHJKMN')).toBe('FORGE-ABCD-EFGH-JKMN');
    expect(normalizeKey('forge abcd efgh jkmn')).toBe('FORGE-ABCD-EFGH-JKMN');
  });

  it('rejects malformed keys', () => {
    expect(normalizeKey('FORGE-ABCD-EFGH')).toBeNull();
    expect(normalizeKey('FORGE-ABCD-EFGH-JKM0')).toBeNull(); // 0 not in alphabet
    expect(normalizeKey('KEY-ABCD-EFGH-JKMN')).toBeNull();
    expect(normalizeKey('')).toBeNull();
  });

  it('hashes with a pepper (HMAC) deterministically', () => {
    const a = hashKey('FORGE-ABCD-EFGH-JKMN', 'pepper-one-1234567');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(hashKey('FORGE-ABCD-EFGH-JKMN', 'pepper-one-1234567')).toBe(a);
    expect(hashKey('FORGE-ABCD-EFGH-JKMN', 'pepper-two-1234567')).not.toBe(a);
    expect(hashesEqual(a, a)).toBe(true);
    expect(hashesEqual(a, hashKey('FORGE-ABCD-EFGH-JKMP', 'pepper-one-1234567'))).toBe(false);
  });

  it('masks keys', () => {
    expect(maskKey('WXYZ')).toBe('FORGE-****-****-WXYZ');
  });
});
