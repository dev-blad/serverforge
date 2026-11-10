import { describe, expect, it } from 'vitest';
import path from 'node:path';
import {
  compileTemplates,
  loadTemplates,
  parseTemplateText,
} from '../../src/services/template/loader.js';
import {
  TemplateRegistry,
  renderTemplate,
  summarizeTemplate,
} from '../../src/services/template/registry.js';
import { miniTemplate, rawFile } from '../helpers.js';

const compile = (...files: ReturnType<typeof rawFile>[]) =>
  compileTemplates(files, { requireBaseTiers: false });

describe('template schema validation', () => {
  it('accepts a minimal template and applies defaults', () => {
    const t = compile(rawFile(miniTemplate())).get('mini')!;
    expect(t.roles[0]!.hoist).toBe(false);
    expect(t.categories[0]!.channels[0]!.type).toBe('text');
    expect(t.modules).toEqual({});
    expect(t.defaults.brandColor).toBe('#5865F2');
  });

  it('fails fast with readable, key-based paths', () => {
    const bad = miniTemplate({
      categories: [
        { key: 'info', name: 'Info', channels: [{ key: 'welcome', name: 'w', type: 'txt' }] },
      ],
    });
    expect(() => compile(rawFile(bad))).toThrow(
      /mini\.yaml \(mini\): categories\[info\]\.channels\[welcome\]\.type/,
    );
  });

  it('rejects unknown permissions and unknown fields', () => {
    const bad = miniTemplate({
      roles: [{ key: 'x', name: 'X', permissions: ['FlyPlanes'], colour: '#fff' }],
    });
    let message = '';
    try {
      compile(rawFile(bad));
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/unknown permission "FlyPlanes"/);
    expect(message).toMatch(/colour/);
  });

  it('reports semantic problems: unknown references, community and placeholders', () => {
    const bad = miniTemplate({
      categories: [
        {
          key: 'info',
          name: 'Info',
          overwrites: [{ role: 'ghost', allow: ['ViewChannel'] }],
          channels: [
            { key: 'news', name: 'news', type: 'announcement', topic: '{{serverNmae}}' },
            { key: 'news', name: 'dupe' },
          ],
        },
      ],
      messages: [{ key: 'm', channel: 'nowhere', content: 'see {{channel:missing}}' }],
      modules: { memberStats: { channel: 'news' } },
    });
    let message = '';
    try {
      compile(rawFile(bad));
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/unknown role "ghost"/);
    expect(message).toMatch(/duplicate channel\/category key "news"/);
    expect(message).toMatch(/need the Community feature/);
    expect(message).toMatch(/unknown placeholder \{\{serverNmae\}\}/);
    expect(message).toMatch(/messages\[m\]\.channel: unknown channel "nowhere"/);
    expect(message).toMatch(/\{\{channel:missing\}\} references unknown channel/);
    expect(message).toMatch(
      /memberStats\.channel: channel "news" is a announcement, expected voice/,
    );
  });

  it('enforces Discord AutoMod rule limits', () => {
    const rules = Array.from({ length: 2 }, (_, i) => ({
      key: `s${i}`,
      name: `S${i}`,
      type: 'spam',
    }));
    expect(() => compile(rawFile(miniTemplate({ modules: { automod: { rules } } })))).toThrow(
      /at most 1 "spam"/,
    );
  });

  it('detects duplicate template ids and missing base tiers', () => {
    expect(() =>
      compile(rawFile(miniTemplate(), 'a.yaml'), rawFile(miniTemplate(), 'b.yaml')),
    ).toThrow(/duplicate template id "mini"/);
    expect(() => compileTemplates([rawFile(miniTemplate())])).toThrow(
      /Missing base template "starter"/,
    );
  });

  it('parses YAML errors with line numbers', () => {
    expect(() => parseTemplateText('id: x\nroles: [\n', 'bad.yaml')).toThrow(
      /bad\.yaml:\d+:\d+: YAML syntax error/,
    );
    expect(() => parseTemplateText('- a\n- b', 'list.yaml')).toThrow(/object at the top level/);
    expect(() => parseTemplateText('name: x', 'noid.yaml')).toThrow(
      /missing required string field "id"/,
    );
    expect(parseTemplateText('{"id":"j"}', 'j.json')).toEqual({ id: 'j' });
  });

  it('resolves inheritance and validates the merged result', () => {
    const child = {
      id: 'child',
      extends: 'mini',
      name: 'Child',
      tier: 'pro',
      roles: [{ key: 'vip', name: 'VIP', after: 'admin' }],
      categories: [{ key: 'chat', channels: [{ key: 'memes', name: 'memes' }] }],
    };
    const t = compile(rawFile(miniTemplate()), rawFile(child)).get('child')!;
    expect(t.roles.map((r) => r.key)).toEqual(['admin', 'vip', 'member']);
    expect(t.categories[1]!.channels.map((c) => c.key)).toEqual(['general', 'memes']);
    expect(t.categories[1]!.name).toBe('Chat');
    expect(t.tier).toBe('pro');
  });
});

describe('shipped templates', () => {
  it('all load and inherit correctly', async () => {
    const templates = await loadTemplates(path.resolve('templates'));
    const registry = new TemplateRegistry(templates);
    const starter = registry.get('starter');
    const pro = registry.get('pro');
    const elite = registry.get('elite');

    // Pro contains every Starter role and channel
    for (const role of starter.roles) expect(pro.roles.some((r) => r.key === role.key)).toBe(true);
    expect(summarizeTemplate(pro).channels).toBeGreaterThan(summarizeTemplate(starter).channels);
    expect(summarizeTemplate(elite).channels).toBeGreaterThan(summarizeTemplate(pro).channels);

    // Pro disables auto member role in favour of verification
    expect(pro.modules.autoRole?.memberRole).toBeNull();
    expect(pro.modules.verification?.enabled).toBe(true);

    // Elite upgrades announcements to a followable announcement channel and brands roles
    const announcements = elite.categories
      .find((c) => c.key === 'info')!
      .channels.find((c) => c.key === 'announcements')!;
    expect(announcements.type).toBe('announcement');
    expect(elite.roles.find((r) => r.key === 'owner')!.color).toBe('{{brandColor}}');
    expect(starter.roles.find((r) => r.key === 'owner')!.color).toBe('#F1C40F');

    // Themes
    expect(registry.forLicense('elite', 'gaming').id).toBe('gaming');
    expect(() => registry.forLicense('pro', 'gaming')).toThrow(/does not match its tier/);
    expect(registry.forLicense('starter').id).toBe('starter');
  });

  it('renders customer placeholders across the whole template', async () => {
    const templates = await loadTemplates(path.resolve('templates'));
    const elite = templates.get('elite')!;
    const rendered = renderTemplate(elite, {
      serverName: 'Acme',
      brandColor: '#123456',
      ownerId: '1',
      ownerName: 'o',
    });
    expect(rendered.roles.find((r) => r.key === 'owner')!.color).toBe('#123456');
    const welcome = rendered.messages.find((m) => m.key === 'welcome')!;
    expect(welcome.embeds[0]!.title).toBe('Welcome to Acme! 👋');
    expect(welcome.embeds[0]!.description).toContain('{{channel:rules}}');
    expect(JSON.stringify(rendered)).not.toMatch(/\{\{(serverName|brandColor)/);
  });
});

describe('error reporting', () => {
  it('reports a broken parent once and skips its descendants', () => {
    const bad = miniTemplate({ roles: [{ key: 'x', name: 'X', permissions: ['Nope'] }] });
    const child = { id: 'child', extends: 'mini', name: 'Child', tier: 'pro' };
    let message = '';
    try {
      compileTemplates([rawFile(child), rawFile(bad)], { requireBaseTiers: false });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/2 problem/);
    expect(message).toMatch(/child\.yaml \(child\): skipped — extends invalid template "mini"/);
  });
});
