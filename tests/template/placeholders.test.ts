import { describe, expect, it } from 'vitest';
import {
  customerValues,
  findPlaceholders,
  hexToInt,
  normalizeHex,
  renderDeep,
  renderReferences,
  renderString,
  shade,
} from '../../src/services/template/placeholders.js';

const options = {
  serverName: 'Pixel Pals',
  brandColor: '#ff0000',
  ownerId: '42',
  ownerName: 'dana',
};

describe('placeholders', () => {
  it('finds placeholders with and without args', () => {
    expect(findPlaceholders('Hi {{serverName}} see {{ channel:rules }}')).toEqual([
      { name: 'serverName', raw: '{{serverName}}' },
      { name: 'channel', arg: 'rules', raw: '{{ channel:rules }}' },
    ]);
  });

  it('renders customer values and leaves references / unknowns intact', () => {
    const values = customerValues(options, 'Pro', new Date('2026-01-01'));
    expect(
      renderString('{{serverName}} by {{ownerMention}} ({{tierName}}, {{year}})', values),
    ).toBe('Pixel Pals by <@42> (Pro, 2026)');
    expect(renderString('{{channel:rules}} {{user}}', values)).toBe('{{channel:rules}} {{user}}');
  });

  it('derives brand colour shades', () => {
    const values = customerValues(options, 'Elite');
    expect(values.brandColor).toBe('#FF0000');
    expect(values.brandColorLight).toBe('#FF5959');
    expect(values.brandColorDark).toBe('#A60000');
  });

  it('normalizes hex colours', () => {
    expect(normalizeHex('abc')).toBe('#AABBCC');
    expect(normalizeHex('#12ab34')).toBe('#12AB34');
    expect(normalizeHex('red')).toBeNull();
    expect(hexToInt('#010203')).toBe(0x010203);
    expect(() => hexToInt('nope')).toThrow();
    expect(shade('#000000', 1)).toBe('#FFFFFF');
    expect(shade('#FFFFFF', -1)).toBe('#000000');
  });

  it('renders deeply without mutating input', () => {
    const input = { a: ['{{serverName}}', { b: '{{brandColor}}' }], n: 3, t: true };
    const out = renderDeep(input, customerValues(options, 'Pro'));
    expect(out).toEqual({ a: ['Pixel Pals', { b: '#FF0000' }], n: 3, t: true });
    expect(input.a[0]).toBe('{{serverName}}');
  });

  it('renders channel and role references, falling back gracefully', () => {
    const ids = { channels: { rules: '111' }, roles: { mod: '222' } };
    expect(renderReferences('See {{channel:rules}}, ask {{role:mod}}', ids)).toBe(
      'See <#111>, ask <@&222>',
    );
    expect(renderReferences('{{channel:gone}} {{role:gone}}', ids)).toBe('#gone @gone');
  });
});
