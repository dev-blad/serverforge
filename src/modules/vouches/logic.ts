import type { EmbedPayload } from '../../services/builder/gateway.js';
import { box, padNumber, stars } from '../common.js';

export interface VouchData {
  rating: number;
  review: string;
  staffId: string | null;
  orderNumber: number | null;
  channelId: string | null;
  messageId: string | null;
}

export interface VouchStats {
  total: number;
  average: number;
  /** Count per star rating, index 0 = 1★ … index 4 = 5★. */
  distribution: [number, number, number, number, number];
}

export function vouchStats(ratings: readonly number[]): VouchStats {
  const distribution: VouchStats['distribution'] = [0, 0, 0, 0, 0];
  for (const r of ratings) distribution[Math.min(5, Math.max(1, Math.round(r))) - 1]! += 1;
  const total = ratings.length;
  const average = total ? ratings.reduce((a, b) => a + b, 0) / total : 0;
  return { total, average: Math.round(average * 10) / 10, distribution };
}

/** Validate a rating typed into a form ("5", "4/5", "⭐⭐⭐"). */
export function parseRating(input: string): number | null {
  const trimmed = input.trim();
  const starCount = [...trimmed].filter((c) => c === '⭐').length;
  if (starCount >= 1 && starCount <= 5) return starCount;
  const match = /^([1-5])(\s*\/\s*5)?$/.exec(trimmed);
  return match ? Number(match[1]) : null;
}

export function statsLine(stats: VouchStats): string {
  if (!stats.total) return 'No vouches yet';
  return `★ ${stats.average.toFixed(1)} average • ${stats.total} vouch${stats.total === 1 ? '' : 'es'}`;
}

export function vouchEmbed(options: {
  number: number;
  data: Pick<VouchData, 'rating' | 'review' | 'staffId' | 'orderNumber'>;
  customerId: string;
  customerName: string;
  avatarUrl?: string | null;
  stats: VouchStats;
}): EmbedPayload {
  const { data } = options;
  return {
    author: options.customerName,
    title: `${stars(data.rating)}  Vouch ${padNumber(options.number)}`,
    color: 0xf1c40f,
    description: [
      `> ${data.review.trim().replace(/\n/g, '\n> ')}`,
      '',
      box('Customer', `<@${options.customerId}>`),
      box('Rating', `**${data.rating}/5**`),
      ...(data.staffId ? [box('Helped by', `<@${data.staffId}>`)] : []),
      ...(data.orderNumber ? [box('Order', padNumber(data.orderNumber))] : []),
    ].join('\n'),
    ...(options.avatarUrl ? { thumbnail: options.avatarUrl } : {}),
    footer: statsLine(options.stats),
    timestamp: true,
  };
}

export function statsEmbed(options: {
  serverName: string;
  stats: VouchStats;
  recent: { number: number; rating: number; customerId: string }[];
}): EmbedPayload {
  const { stats } = options;
  const bars = [5, 4, 3, 2, 1].map((star) => {
    const count = stats.distribution[star - 1]!;
    const pct = stats.total ? count / stats.total : 0;
    const filled = Math.round(pct * 10);
    return `\`${star}★ ${'█'.repeat(filled)}${'░'.repeat(10 - filled)}\` ${count}`;
  });
  return {
    author: options.serverName,
    title: '⭐ Vouches',
    color: 0xf1c40f,
    description: stats.total
      ? [
          box('Average', `**${stats.average.toFixed(1)} / 5** ${stars(stats.average)}`),
          box('Total', `**${stats.total}**`),
          '',
          ...bars,
          ...(options.recent.length
            ? [
                '',
                '**Latest**',
                ...options.recent.map(
                  (v) => `${padNumber(v.number)} ${stars(v.rating)} <@${v.customerId}>`,
                ),
              ]
            : []),
        ].join('\n')
      : 'No vouches yet — be the first with `/vouch submit`.',
  };
}
