import { randomInt } from 'node:crypto';
import type { EmbedPayload } from '../../services/builder/gateway.js';
import { box, discordTime, padNumber } from '../common.js';

export interface GiveawayData {
  prize: string;
  winners: number;
  endsAt: string;
  entrants: string[];
  channelId: string;
  messageId: string | null;
  hostId: string;
  winnerIds: string[];
}

/** Pick up to `count` different winners fairly (crypto randomness by default). */
export function pickWinners(
  entrants: readonly string[],
  count: number,
  random: (max: number) => number = (max) => randomInt(max),
  exclude: readonly string[] = [],
): string[] {
  const pool = [...new Set(entrants)].filter((e) => !exclude.includes(e));
  const winners: string[] = [];
  while (winners.length < count && pool.length) {
    winners.push(pool.splice(random(pool.length), 1)[0]!);
  }
  return winners;
}

/** Add or remove an entrant. Returns the new list and whether they're now entered. */
export function toggleEntry(
  entrants: readonly string[],
  userId: string,
): { entrants: string[]; entered: boolean } {
  return entrants.includes(userId)
    ? { entrants: entrants.filter((e) => e !== userId), entered: false }
    : { entrants: [...entrants, userId], entered: true };
}

export function giveawayEmbed(options: {
  number: number;
  data: GiveawayData;
  ended: boolean;
  color: number;
}): EmbedPayload {
  const { data } = options;
  const endsAt = new Date(data.endsAt);
  return {
    title: `🎉 ${data.prize}`,
    color: options.ended ? 0x99aab5 : options.color,
    description: [
      options.ended ? 'This giveaway has ended.' : 'Click **Enter** below for a chance to win!',
      '',
      box('Winners', String(data.winners)),
      box('Entries', String(data.entrants.length)),
      box(options.ended ? 'Ended' : 'Ends', discordTime(endsAt)),
      box('Hosted by', `<@${data.hostId}>`),
      ...(options.ended
        ? [
            '',
            data.winnerIds.length
              ? `🏆 **Winner${data.winnerIds.length > 1 ? 's' : ''}:** ${data.winnerIds.map((w) => `<@${w}>`).join(', ')}`
              : 'No valid entries — no winner this time.',
          ]
        : []),
    ].join('\n'),
    footer: `Giveaway ${padNumber(options.number)}`,
  };
}
