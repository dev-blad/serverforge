import type { EmbedPayload } from '../../services/builder/gateway.js';
import { box, money, stars } from '../common.js';

export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Is it time to post this week's report? (right day + hour, and none in the last 6 days) */
export function reportDue(
  now: Date,
  day: Weekday,
  hour: number,
  lastReportAt: Date | null,
): boolean {
  if (WEEKDAYS[now.getUTCDay()] !== day || now.getUTCHours() !== hour) return false;
  return !lastReportAt || now.getTime() - lastReportAt.getTime() > 6 * 86_400_000;
}

export interface WeeklyNumbers {
  members: number;
  previousMembers: number | null;
  ordersPlaced: number;
  ordersCompleted: number;
  revenue: number;
  openOrders: number;
  vouches: number[];
  giveaways: number;
  applications: number;
}

const delta = (now: number, before: number | null) =>
  before === null
    ? ''
    : now === before
      ? ' (no change)'
      : ` (${now > before ? '+' : ''}${now - before})`;

export function weeklyReportEmbed(options: {
  serverName: string;
  numbers: WeeklyNumbers;
  currency: string | null;
  color: number;
  from: Date;
  to: Date;
}): EmbedPayload {
  const n = options.numbers;
  const avg = n.vouches.length ? n.vouches.reduce((a, b) => a + b, 0) / n.vouches.length : 0;
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return {
    author: options.serverName,
    title: '📈 Weekly report',
    color: options.color,
    description: [
      `Your week from **${fmt(options.from)}** to **${fmt(options.to)}**.`,
      '',
      '**Community**',
      box(
        'Members',
        `**${n.members.toLocaleString('en-GB')}**${delta(n.members, n.previousMembers)}`,
      ),
      ...(n.giveaways ? [box('Giveaways', String(n.giveaways))] : []),
      ...(n.applications ? [box('Applications', String(n.applications))] : []),
      '',
      '**Sales**',
      box('Orders placed', String(n.ordersPlaced)),
      box('Completed', String(n.ordersCompleted)),
      ...(options.currency ? [box('Revenue', `**${money(n.revenue, options.currency)}**`)] : []),
      box('Still open', String(n.openOrders)),
      '',
      '**Reputation**',
      box('New vouches', String(n.vouches.length)),
      ...(n.vouches.length ? [box('Avg rating', `${avg.toFixed(1)} ${stars(avg)}`)] : []),
    ].join('\n'),
    footer: 'Sent every week by ServerForge',
  };
}
