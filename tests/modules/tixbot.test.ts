import { describe, expect, it } from 'vitest';
import { moduleInstallers } from '../../src/modules/index.js';
import {
  PANEL_NAME,
  runTixbotSetup,
  tixbotGuildSettings,
  tixbotInviteUrl,
  toTixbotEmbed,
  type TixbotRuntimeConfig,
} from '../../src/modules/tixbot/logic.js';
import { TixbotApi, TixbotApiError } from '../../src/services/tixbot/api.js';
import { compileTemplates } from '../../src/services/template/loader.js';
import { FakeGuild } from '../fakes/fakeGuild.js';
import { harness } from '../builder/setup.js';
import { miniTemplate, rawFile } from '../helpers.js';

const GUILD = '111111111111111111';

function config(overrides: Partial<TixbotRuntimeConfig> = {}): TixbotRuntimeConfig {
  return {
    setupChannelId: 'c-staff',
    setupMessageId: 'm-setup',
    panelChannelId: 'c-panel',
    staffRoleId: 'r-staff',
    escalationRoleId: 'r-team',
    ticketCategoryId: 'cat-basic',
    escalationCategoryId: 'cat-esc',
    closedCategoryId: 'cat-closed',
    transcriptChannelId: 'c-transcripts',
    notificationsChannelId: null,
    placeholder: 'Choose Ticket',
    panelEmbed: { title: 'Shop Support', description: 'Pick one', color: 0xd4843d, author: 'Shop' },
    ticketTypes: [
      { name: 'Sales Enquiries', emoji: '🛒', description: 'Buy things', categoryId: 'cat-sales' },
      { name: 'Support Tickets', emoji: '🛠️', description: null, categoryId: null },
    ],
    completedAt: null,
    panelId: null,
    ...overrides,
  };
}

/** In-memory stand-in for the TixBot API that records every call. */
function fakeTixbot(
  seed: { types?: { id: number; name: string }[]; panels?: { id: number; name: string }[] } = {},
) {
  const calls: { method: string; path: string; body?: unknown; guild: string | null }[] = [];
  const types = [...(seed.types ?? [])];
  const panels = [...(seed.panels ?? [])];
  const options: Record<number, number[]> = {};
  let nextId = 100;
  let deployFailures = 0;

  const fetchImpl = (url: string, init: RequestInit) => {
    const path = url.replace('https://tixbot.test', '');
    const method = init.method ?? 'GET';
    const headers = init.headers as Record<string, string>;
    const body = init.body
      ? (JSON.parse(init.body as string) as Record<string, unknown>)
      : undefined;
    calls.push({ method, path, body, guild: headers['x-tixbot-guild'] ?? null });
    const json = (data: unknown, status = 200) =>
      Promise.resolve(new Response(JSON.stringify(data), { status }));

    if (headers['x-tixbot-api-key'] !== 'secret') return json({ error: 'Unauthorized' }, 401);
    if (method === 'GET' && path === `/api/config/${GUILD}`)
      return json({ config: {}, ticketTypes: types });
    if (method === 'POST' && path === `/api/config/${GUILD}`) return json({ success: true });
    if (method === 'POST' && path === `/api/ticket-types/${GUILD}`) {
      const id = nextId++;
      types.push({ id, name: String(body?.['name']) });
      return json({ success: true, typeId: id });
    }
    if (method === 'PATCH' && path.startsWith('/api/ticket-types/')) return json({ success: true });
    if (method === 'GET' && path === `/api/dropdown-panels/${GUILD}`) return json(panels);
    if (method === 'POST' && path === `/api/dropdown-panels/${GUILD}`) {
      const id = nextId++;
      panels.push({ id, name: String(body?.['name']) });
      return json({ success: true, panelId: id });
    }
    const optionsMatch = /^\/api\/dropdown-panels\/(\d+)\/options$/.exec(path);
    if (optionsMatch) {
      const panelId = Number(optionsMatch[1]);
      if (method === 'GET') {
        return json((options[panelId] ?? []).map((t, i) => ({ id: i, ticket_selection_id: t })));
      }
      (options[panelId] ??= []).push(Number(body?.['ticket_selection_id']));
      return json({ success: true });
    }
    if (method === 'PATCH' && path.startsWith('/api/dropdown-panels/'))
      return json({ success: true });
    if (method === 'POST' && path === `/api/deploy-dropdown-panel/${GUILD}`) {
      if (deployFailures > 0) {
        deployFailures -= 1;
        return json({ error: 'Guild not found' }, 404);
      }
      return json({ success: true });
    }
    return json({ error: `unexpected ${method} ${path}` }, 500);
  };

  return {
    api: new TixbotApi('https://tixbot.test', 'secret', fetchImpl),
    calls,
    types,
    panels,
    options,
    failDeploys(n: number) {
      deployFailures = n;
    },
  };
}

describe('TixBot setup', () => {
  it('maps the built server onto TixBot settings', () => {
    expect(tixbotGuildSettings(config())).toEqual({
      panel_channel_id: 'c-panel',
      l1_role_id: 'r-staff',
      l1_category_id: 'cat-basic',
      l2_role_id: 'r-team',
      escalation_role_id: 'r-team',
      l2_category_id: 'cat-esc',
      escalation_category_id: 'cat-esc',
      closed_category_id: 'cat-closed',
      archive_category_id: 'cat-closed',
      transcript_channel_id: 'c-transcripts',
      auto_transcript: true,
    });
    expect(
      toTixbotEmbed({
        title: 'T',
        author: 'A',
        footer: 'F',
        color: 1,
        fields: [{ name: 'n', value: 'v' }],
      }),
    ).toEqual({
      title: 'T',
      author: { name: 'A' },
      footer: { text: 'F' },
      color: 1,
      fields: [{ name: 'n', value: 'v', inline: false }],
    });
  });

  it('creates ticket types and a dropdown panel, then posts it', async () => {
    const tb = fakeTixbot();
    const result = await runTixbotSetup(tb.api, GUILD, config());

    expect(result.createdTypes).toBe(2);
    expect(tb.types.map((t) => t.name)).toEqual(['Sales Enquiries', 'Support Tickets']);
    expect(tb.panels).toEqual([{ id: result.panelId, name: PANEL_NAME }]);
    expect(tb.options[result.panelId]).toEqual(result.ticketTypeIds);
    // Every call is scoped to the guild so TixBot enforces ownership.
    expect(tb.calls.every((c) => c.guild === GUILD)).toBe(true);

    const typeUpdate = tb.calls.find(
      (c) => c.method === 'PATCH' && c.path === `/api/ticket-types/${result.ticketTypeIds[0]}`,
    );
    expect(typeUpdate?.body).toMatchObject({ target_category_id: 'cat-sales', enabled: true });
    const fallback = tb.calls.find(
      (c) => c.method === 'PATCH' && c.path === `/api/ticket-types/${result.ticketTypeIds[1]}`,
    );
    expect(fallback?.body).toMatchObject({ target_category_id: 'cat-basic' });

    const panelUpdate = tb.calls.find(
      (c) => c.method === 'PATCH' && c.path === `/api/dropdown-panels/${result.panelId}`,
    );
    expect(panelUpdate?.body).toMatchObject({
      placeholder_text: 'Choose Ticket',
      panel_message: { embeds: [{ title: 'Shop Support', author: { name: 'Shop' } }] },
    });
    const deploy = tb.calls.find((c) => c.path === `/api/deploy-dropdown-panel/${GUILD}`);
    expect(deploy?.body).toEqual({ panelId: result.panelId, channelId: 'c-panel' });
  });

  it('reuses existing ticket types and its own panel when re-run', async () => {
    const tb = fakeTixbot({
      types: [{ id: 7, name: 'sales enquiries' }],
      panels: [
        { id: 9, name: PANEL_NAME },
        { id: 3, name: 'Something else' },
      ],
    });
    tb.options[9] = [7];
    const result = await runTixbotSetup(tb.api, GUILD, config());
    expect(result.createdTypes).toBe(1);
    expect(result.panelId).toBe(9);
    expect(result.ticketTypeIds[0]).toBe(7);
    expect(tb.panels).toHaveLength(2);
    expect(tb.options[9]).toEqual([7, result.ticketTypeIds[1]]);
  });

  it('retries the panel post while TixBot is still loading the server', async () => {
    const tb = fakeTixbot();
    tb.failDeploys(2);
    await runTixbotSetup(tb.api, GUILD, config(), { retryDelayMs: 1 });
    expect(tb.calls.filter((c) => c.path.startsWith('/api/deploy-dropdown-panel')).length).toBe(3);

    const tb2 = fakeTixbot();
    tb2.failDeploys(5);
    await expect(
      runTixbotSetup(tb2.api, GUILD, config(), { retryDelayMs: 1, deployRetries: 1 }),
    ).rejects.toBeInstanceOf(TixbotApiError);
  });

  it('reports a bad API key clearly', async () => {
    const tb = fakeTixbot();
    const api = new TixbotApi('https://tixbot.test', 'wrong', (url, init) =>
      // reuse the fake's routing with the wrong key
      (
        tb.api as unknown as { fetchImpl: (u: string, i: RequestInit) => Promise<Response> }
      ).fetchImpl(url, init),
    );
    await expect(api.saveConfig(GUILD, {})).rejects.toMatchObject({ status: 401 });
  });

  it('builds an invite with the server pre-selected', () => {
    const url = new URL(tixbotInviteUrl('123', GUILD));
    expect(url.searchParams.get('guild_id')).toBe(GUILD);
    expect(url.searchParams.get('disable_guild_select')).toBe('true');
    expect(url.searchParams.get('scope')).toBe('bot applications.commands');
  });
});

describe('tixbot module install', () => {
  it('posts the staff setup embed and stores resolved ids', async () => {
    const guild = new FakeGuild();
    const h = harness(guild);
    const { result } = await h.build('shop', { installers: moduleInstallers });
    expect(result.status).toBe('succeeded');

    const record = await h.db.modules.get(guild.guildId, 'tixbot');
    const cfg = record!.config as unknown as TixbotRuntimeConfig;
    expect(cfg.panelChannelId).toBe(guild.channelByName('﹒sᴜᴘᴘᴏʀᴛ-ɪɴꜰᴏ')!.id);
    expect(cfg.ticketCategoryId).toBe(guild.channelByName('Support Tickets (Basic)')!.id);
    expect(cfg.staffRoleId).toBe(guild.roleByName('Support Agent')!.id);
    expect(cfg.ticketTypes.map((t) => t.name)).toEqual([
      'Sales Enquiries',
      'Support Tickets',
      'Edit as Required',
    ]);
    expect(cfg.ticketTypes[0]!.categoryId).toBe(guild.channelByName('Sales Enquiries')!.id);
    expect(cfg.panelEmbed.title).toBe('Test Server Support');
    expect(cfg.completedAt).toBeNull();

    const setup = [...guild.messages.values()].find(
      (m) => m.payload.buttons?.[0]?.customId === 'sf:tixbot:setup',
    );
    expect(setup?.channelId).toBe(guild.channelByName('﹒sᴛᴀꜰꜰ-ᴄʜᴀᴛ')!.id);
    expect(setup?.payload.links?.[0]?.url).toContain(`guild_id=${guild.guildId}`);
  });

  it('rejects ticket types pointing at a channel that is not a category', () => {
    const bad = miniTemplate({
      modules: {
        tixbot: {
          setupChannel: 'welcome',
          panelChannel: 'welcome',
          staffRole: 'mod',
          ticketCategory: 'welcome',
          panelEmbed: { title: 'x' },
          ticketTypes: [{ key: 'a', name: 'A', category: 'nope' }],
        },
      },
    });
    expect(() => compileTemplates([rawFile(bad)], { requireBaseTiers: false })).toThrow(
      /modules\.tixbot\.ticketCategory: channel "welcome" is a text, expected category[\s\S]*ticketTypes\[a\]\.category: unknown channel "nope"/,
    );
  });
});
