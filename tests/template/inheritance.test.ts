import { describe, expect, it } from 'vitest';
import { mergeDeep, resolveInheritance, inheritanceChain, type RawTemplate } from '../../src/services/template/inheritance.js';
import { TemplateError } from '../../src/errors.js';

const map = (...raws: RawTemplate[]) => new Map(raws.map((r) => [r.id, r]));

describe('mergeDeep', () => {
  it('merges objects recursively with child winning', () => {
    expect(mergeDeep({ a: 1, b: { c: 1, d: 2 } }, { b: { d: 3 } })).toEqual({ a: 1, b: { c: 1, d: 3 } });
  });

  it('replaces non-keyed arrays wholesale', () => {
    expect(mergeDeep({ p: ['A', 'B'] }, { p: ['C'] })).toEqual({ p: ['C'] });
  });

  it('merges keyed arrays by key, preserving order and appending new entries', () => {
    const base = { roles: [{ key: 'a', name: 'A', color: '#000000' }, { key: 'b', name: 'B' }] };
    const child = { roles: [{ key: 'a', color: '#FFFFFF' }, { key: 'c', name: 'C' }] };
    expect(mergeDeep(base, child)).toEqual({
      roles: [
        { key: 'a', name: 'A', color: '#FFFFFF' },
        { key: 'b', name: 'B' },
        { key: 'c', name: 'C' },
      ],
    });
  });

  it('supports before / after / remove directives', () => {
    const base = { xs: [{ key: 'a' }, { key: 'b' }, { key: 'c' }] };
    const child = {
      xs: [
        { key: 'z', before: 'a' },
        { key: 'm', after: 'b' },
        { key: 'c', remove: true },
        { key: 'a', after: 'm' },
      ],
    };
    expect(mergeDeep(base, child)).toEqual({ xs: [{ key: 'z' }, { key: 'b' }, { key: 'm' }, { key: 'a' }] });
  });

  it('throws on unknown before/after anchors', () => {
    expect(() => mergeDeep({ xs: [{ key: 'a' }] }, { xs: [{ key: 'b', after: 'nope' }] }, 'xs')).toThrow(
      /unknown sibling "nope"/,
    );
  });

  it('merges nested keyed arrays (channels inside categories)', () => {
    const base = { categories: [{ key: 'c1', name: 'One', channels: [{ key: 'x', name: 'x' }] }] };
    const child = { categories: [{ key: 'c1', channels: [{ key: 'y', name: 'y', before: 'x' }] }] };
    expect(mergeDeep(base, child)).toEqual({
      categories: [{ key: 'c1', name: 'One', channels: [{ key: 'y', name: 'y' }, { key: 'x', name: 'x' }] }],
    });
  });

  it('allows null to override a value', () => {
    expect(mergeDeep({ m: { role: 'member' } }, { m: { role: null } })).toEqual({ m: { role: null } });
  });
});

describe('resolveInheritance', () => {
  const base: RawTemplate = { id: 'base', name: 'Base', tier: 'starter', abstract: true, roles: [{ key: 'a', name: 'A' }] };
  const mid: RawTemplate = { id: 'mid', extends: 'base', tier: 'pro', roles: [{ key: 'b', name: 'B' }] };
  const top: RawTemplate = { id: 'top', extends: 'mid', name: 'Top', roles: [{ key: 'a', name: 'A2' }] };

  it('resolves multi-level chains and does not inherit identity fields', () => {
    const resolved = resolveInheritance('top', map(base, mid, top));
    expect(resolved['id']).toBe('top');
    expect(resolved['name']).toBe('Top');
    expect(resolved['tier']).toBe('pro');
    expect(resolved['abstract']).toBeUndefined();
    expect(resolved['extends']).toBe('mid');
    expect(resolved['roles']).toEqual([{ key: 'a', name: 'A2' }, { key: 'b', name: 'B' }]);
  });

  it('reports the inheritance chain', () => {
    expect(inheritanceChain('top', map(base, mid, top))).toEqual(['base', 'mid', 'top']);
  });

  it('detects unknown parents', () => {
    expect(() => resolveInheritance('x', map({ id: 'x', extends: 'ghost' }))).toThrow(/extends unknown template "ghost"/);
  });

  it('detects cycles', () => {
    const err = (() => {
      try {
        resolveInheritance('a', map({ id: 'a', extends: 'b' }, { id: 'b', extends: 'a' }));
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(TemplateError);
    expect((err as Error).message).toMatch(/cycle: a → b → a/);
  });
});
