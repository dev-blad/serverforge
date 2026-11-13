import { describe, expect, it } from 'vitest';
import type { AppContext } from '../../src/bot/types.js';
import { createMemoryDatabase } from '../../src/db/memory.js';
import { silentLogger } from '../../src/logger.js';
import { cleanImageUrl } from '../../src/modules/announcements/logic.js';
import {
  box,
  formatDuration,
  isStaff,
  money,
  parseDuration,
  parsePrice,
  stars,
} from '../../src/modules/common.js';
import { baseChannelName, statusChannelName, statusEmbed } from '../../src/modules/status/logic.js';
import {
  parseRating,
  statsEmbed,
  vouchEmbed,
  vouchStats,
} from '../../src/modules/vouches/logic.js';
import { submitVouch } from '../../src/modules/vouches/service.js';

describe('shared helpers', () => {
  it('formats boxes, stars, prices and durations', () => {
    expect(box('Price', '$10.00')).toBe('`Price       :` $10.00');
    expect(stars(4)).toBe('⭐⭐⭐⭐☆');
    expect(stars(9)).toBe('⭐⭐⭐⭐⭐');
    expect(money(1234.5, '£')).toBe('£1,234.50');
    expect(parsePrice('$1,000.50')).toBe(1000.5);
    expect(parsePrice('ten')).toBeNull();
    expect(parsePrice('1.234')).toBeNull();
    expect(parseDuration('1d 12h')).toBe(36 * 3_600_000);
    expect(parseDuration('30m')).toBe(1_800_000);
    expect(parseDuration('soon')).toBeNull();
    expect(parseDuration('2h banana')).toBeNull();
    expect(formatDuration(90 * 60_000)).toBe('1 hour');
    expect(formatDuration(27 * 3_600_000)).toBe('1 day 3 hours');
  });

  it('treats Manage Server or a staff role as staff', () => {
    const member = (perm: boolean, roles: string[]) =>
      ({
        permissions: { has: () => perm },
        roles: { cache: new Map(roles.map((r) => [r, {}])) },
      }) as never;
    expect(isStaff(member(true, []), ['staff'])).toBe(true);
    expect(isStaff(member(false, ['staff']), ['staff'])).toBe(true);
    expect(isStaff(member(false, ['member']), ['staff'])).toBe(false);
  });
});

describe('status board', () => {
  it('prefixes the channel name with the state emoji, replacing an old one', () => {
    expect(statusChannelName('﹒sᴛᴀᴛᴜs', 'busy')).toBe('🟡﹒sᴛᴀᴛᴜs');
    expect(statusChannelName('🟢﹒sᴛᴀᴛᴜs', 'closed')).toBe('🔴﹒sᴛᴀᴛᴜs');
    expect(baseChannelName('🔴status')).toBe('status');
  });

  it('builds a boxed status embed with an optional note', () => {
    const embed = statusEmbed({
      state: 'closed',
      note: 'Back Monday',
      updatedBy: '<@1>',
      at: new Date(0),
      serverName: 'Shop',
    });
    expect(embed.title).toBe('🔴 We’re closed');
    expect(embed.description).toContain('`Status      :` 🔴 **Closed**');
    expect(embed.description).toContain('> Back Monday');
  });
});

describe('vouches', () => {
  it('works out averages and the star distribution', () => {
    const stats = vouchStats([5, 5, 4, 3]);
    expect(stats).toEqual({ total: 4, average: 4.3, distribution: [0, 0, 1, 1, 2] });
    expect(vouchStats([]).average).toBe(0);
  });

  it('reads ratings typed into the form', () => {
    expect(parseRating('5')).toBe(5);
    expect(parseRating('4/5')).toBe(4);
    expect(parseRating('⭐⭐⭐')).toBe(3);
    expect(parseRating('10')).toBeNull();
    expect(parseRating('great')).toBeNull();
  });

  it('renders vouch and stats embeds', () => {
    const stats = vouchStats([5, 4]);
    const embed = vouchEmbed({
      number: 12,
      data: { rating: 5, review: 'Fast\nand friendly', staffId: '9', orderNumber: 3 },
      customerId: '1',
      customerName: 'Blad',
      stats,
    });
    expect(embed.title).toBe('⭐⭐⭐⭐⭐  Vouch #0012');
    expect(embed.description).toContain('> Fast\n> and friendly');
    expect(embed.description).toContain('`Helped by   :` <@9>');
    expect(embed.description).toContain('`Order       :` #0003');
    expect(embed.footer).toBe('★ 4.5 average • 2 vouches');
    expect(statsEmbed({ serverName: 'Shop', stats, recent: [] }).description).toContain(
      '`5★ █████░░░░░` 1',
    );
  });

  it('posts vouches, enforces the cooldown and allows one vouch per order', async () => {
    const db = createMemoryDatabase();
    const sent: unknown[] = [];
    const channel = {
      isSendable: () => true,
      send: (m: unknown) => (sent.push(m), Promise.resolve({ id: `m${sent.length}` })),
    };
    const guild = {
      id: 'g1',
      members: { fetch: () => Promise.resolve({ displayName: 'Blad' }) },
      channels: { fetch: () => Promise.resolve(channel) },
    } as never;
    const user = {
      id: 'u1',
      username: 'blad',
      displayAvatarURL: () => 'https://cdn/avatar.png',
    } as never;
    const ctx = { db, logger: silentLogger } as unknown as AppContext;
    const config = { channelId: 'c1', staffRoleIds: [], cooldownHours: 24 };

    const first = await submitVouch(ctx, guild, user, config, {
      rating: 5,
      review: 'Great service',
    });
    expect(first.number).toBe(1);
    expect(sent).toHaveLength(1);
    const stored = await db.records.findByNumber<{ messageId: string }>('g1', 'vouch', 1);
    expect(stored?.data.messageId).toBe('m1');

    await expect(
      submitVouch(ctx, guild, user, config, { rating: 4, review: 'Again!' }),
    ).rejects.toThrow(/one vouch every 1 day/);
    // Vouches for a completed order aren't limited by the cooldown, but only one per order.
    await submitVouch(ctx, guild, user, config, {
      rating: 5,
      review: 'Order done',
      orderNumber: 7,
    });
    await expect(
      submitVouch(ctx, guild, user, config, { rating: 5, review: 'Order done', orderNumber: 7 }),
    ).rejects.toThrow(/already left a vouch for this order/);
  });
});

describe('announcements', () => {
  it('only accepts http(s) image links', () => {
    expect(cleanImageUrl(' https://x.com/a.png ')).toBe('https://x.com/a.png');
    expect(cleanImageUrl('javascript:alert(1)')).toBeNull();
    expect(cleanImageUrl('')).toBeNull();
  });
});
