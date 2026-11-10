import { describe, expect, it, vi } from 'vitest';
import { computeRoleToggle } from '../../src/modules/buttonRoles/logic.js';
import {
  accountAge,
  banEmbed,
  memberJoinEmbed,
  memberLeaveEmbed,
  messageDeleteEmbed,
  messageEditEmbed,
  roleChangeEmbed,
  timeoutEmbed,
} from '../../src/modules/logging/logic.js';
import {
  canCloseTicket,
  renderTranscript,
  renderWelcome,
  ticketChannelName,
} from '../../src/modules/tickets/logic.js';
import { StatsThrottle, formatStatsName } from '../../src/modules/memberStats/logic.js';
import { automodPayload } from '../../src/modules/automod/logic.js';

describe('button roles', () => {
  const panel = { channelId: 'c', messageId: 'm', exclusive: false, buttons: { a: 'r1', b: 'r2' } };
  it('adds a missing role and removes a held role', () => {
    expect(computeRoleToggle(new Set(), panel, 'a')).toEqual({
      add: ['r1'],
      remove: [],
      added: true,
    });
    expect(computeRoleToggle(new Set(['r1']), panel, 'a')).toEqual({
      add: [],
      remove: ['r1'],
      added: false,
    });
  });
  it('swaps roles in exclusive panels', () => {
    expect(computeRoleToggle(new Set(['r2', 'other']), { ...panel, exclusive: true }, 'a')).toEqual(
      {
        add: ['r1'],
        remove: ['r2'],
        added: true,
      },
    );
  });
  it('rejects unknown buttons', () => {
    expect(computeRoleToggle(new Set(), panel, 'zzz')).toBeNull();
  });
});

describe('logging embeds', () => {
  const now = new Date('2026-06-01T00:00:00Z');
  it('describes account age', () => {
    expect(accountAge(new Date('2026-05-31T12:00:00Z'), now)).toBe('less than a day');
    expect(accountAge(new Date('2026-05-29T00:00:00Z'), now)).toBe('3 days');
    expect(accountAge(new Date('2026-01-01T00:00:00Z'), now)).toBe('5 months');
    expect(accountAge(new Date('2023-01-01T00:00:00Z'), now)).toBe('3 years');
  });
  it('flags brand-new accounts on join', () => {
    const e = memberJoinEmbed(
      { id: '1', tag: 'a#1', createdAt: new Date('2026-05-30T00:00:00Z'), memberCount: 42 },
      now,
    );
    expect(e.fields![0]!.value).toMatch(/new account/);
    expect(e.color).toBe(0xe67e22);
    const old = memberJoinEmbed(
      { id: '1', tag: 'a#1', createdAt: new Date('2020-01-01'), memberCount: 42 },
      now,
    );
    expect(old.fields![0]!.value).not.toMatch(/new account/);
  });
  it('builds leave, delete, edit, ban, timeout and role embeds', () => {
    expect(
      memberLeaveEmbed({ id: '1', tag: 't', joinedAt: null, roles: [] }, now).fields![1]!.value,
    ).toBe('none');
    const del = messageDeleteEmbed({
      authorId: null,
      authorTag: null,
      channelId: 'c',
      content: '',
      attachments: ['u'],
    });
    expect(del.description).toMatch(/Unknown author/);
    expect(del.fields).toHaveLength(2);
    expect(
      messageEditEmbed({
        authorId: '1',
        authorTag: 't',
        channelId: 'c',
        url: 'u',
        before: 'x',
        after: 'x',
      }),
    ).toBeNull();
    expect(
      messageEditEmbed({
        authorId: '1',
        authorTag: 't',
        channelId: 'c',
        url: 'u',
        before: null,
        after: 'y',
      })!.fields![0]!.value,
    ).toMatch(/not cached/);
    expect(banEmbed({ id: '1', tag: 't', reason: 'spam', banned: true }).title).toMatch(/banned/);
    expect(timeoutEmbed({ id: '1', tag: 't', until: new Date(0) }).description).toMatch(/<t:0:f>/);
    expect(roleChangeEmbed({ id: '1', tag: 't', added: [], removed: [] })).toBeNull();
    expect(
      roleChangeEmbed({ id: '1', tag: 't', added: ['r'], removed: [] })!.fields![0]!.value,
    ).toBe('<@&r>');
    const long = messageDeleteEmbed({
      authorId: '1',
      authorTag: 't',
      channelId: 'c',
      content: 'x'.repeat(5000),
      attachments: [],
    });
    expect(long.fields![0]!.value.length).toBe(1024);
  });
});

describe('tickets', () => {
  it('names channels and renders welcome messages', () => {
    expect(ticketChannelName(7)).toBe('ticket-0007');
    expect(renderWelcome('Hi {{user}}!', '42')).toBe('Hi <@42>!');
  });
  it('renders transcripts oldest first', () => {
    const text = renderTranscript(
      {
        guildName: 'G',
        channelName: 'ticket-0001',
        ticketNumber: 1,
        openerTag: 'opener',
        openedAt: new Date('2026-01-01T00:00:00Z'),
        closedByTag: 'mod',
        closedAt: new Date('2026-01-02T00:00:00Z'),
      },
      [
        {
          authorTag: 'mod',
          authorId: '2',
          bot: false,
          createdAt: new Date('2026-01-01T00:02:00Z'),
          content: 'second',
          attachments: [],
          embeds: 1,
        },
        {
          authorTag: 'opener',
          authorId: '1',
          bot: false,
          createdAt: new Date('2026-01-01T00:01:00Z'),
          content: 'first',
          attachments: ['http://x/y.png'],
          embeds: 0,
        },
      ],
    );
    expect(text.indexOf('first')).toBeLessThan(text.indexOf('second'));
    expect(text).toContain('📎 http://x/y.png');
    expect(text).toContain('Closed by: mod');
    expect(text).toContain('(1 embed)');
  });
  it('lets opener, staff or channel managers close', () => {
    const base = {
      userId: 'u',
      openerId: 'o',
      memberRoleIds: new Set<string>(),
      staffRoleIds: ['staff'],
      canManageChannels: false,
    };
    expect(canCloseTicket(base)).toBe(false);
    expect(canCloseTicket({ ...base, userId: 'o' })).toBe(true);
    expect(canCloseTicket({ ...base, memberRoleIds: new Set(['staff']) })).toBe(true);
    expect(canCloseTicket({ ...base, canManageChannels: true })).toBe(true);
  });
});

describe('member stats', () => {
  it('formats the channel name', () => {
    expect(formatStatsName('👥 Members: {count}', 12345)).toBe('👥 Members: 12,345');
  });

  it('throttles renames and coalesces bursts', () => {
    let now = 0;
    const runs: number[] = [];
    const timers: { fn: () => void; ms: number }[] = [];
    const throttle = new StatsThrottle(
      async () => void runs.push(now),
      1000,
      () => now,
      (fn, ms) => {
        timers.push({ fn, ms });
        return 0 as unknown as ReturnType<typeof setTimeout>;
      },
    );
    expect(throttle.request('g')).toBe('now');
    now = 100;
    expect(throttle.request('g')).toBe('scheduled');
    expect(throttle.request('g')).toBe('pending');
    expect(timers).toHaveLength(1);
    expect(timers[0]!.ms).toBe(900);
    now = 1000;
    timers[0]!.fn();
    expect(runs).toEqual([0, 1000]);
    expect(throttle.request('other')).toBe('now');
    throttle.clear();
  });

  it('swallows update errors', async () => {
    const throttle = new StatsThrottle(() => Promise.reject(new Error('boom')), 10);
    expect(throttle.request('g')).toBe('now');
    await vi.waitFor(() => undefined);
  });
});

describe('automod payload', () => {
  it('resolves keys and drops unknown exempt roles', () => {
    const payload = automodPayload(
      {
        key: 'k',
        name: 'N',
        type: 'mentionSpam',
        keywords: [],
        regex: [],
        allowList: [],
        presets: [],
        mentionLimit: 4,
        blockMessage: true,
        alertChannel: 'mod-log',
        timeoutSeconds: 60,
        exemptRoles: ['mod', 'ghost'],
      },
      { roles: { mod: 'R' }, channels: { 'mod-log': 'C' } },
    );
    expect(payload).toMatchObject({
      alertChannelId: 'C',
      exemptRoleIds: ['R'],
      timeoutSeconds: 60,
      mentionLimit: 4,
    });
  });
});
