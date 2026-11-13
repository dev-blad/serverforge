import type { EmbedPayload } from '../../services/builder/gateway.js';
import { box, discordTime } from '../common.js';

export type StatusState = 'open' | 'busy' | 'closed';

export const STATUS_STATES: Record<
  StatusState,
  { emoji: string; label: string; headline: string; detail: string; color: number }
> = {
  open: {
    emoji: '🟢',
    label: 'Open',
    headline: 'We’re open',
    detail: 'Orders are being taken and processed as normal.',
    color: 0x57f287,
  },
  busy: {
    emoji: '🟡',
    label: 'Busy',
    headline: 'We’re busy',
    detail: 'Orders are still being taken, but replies and delivery may take longer than usual.',
    color: 0xfee75c,
  },
  closed: {
    emoji: '🔴',
    label: 'Closed',
    headline: 'We’re closed',
    detail:
      'New orders are paused for now. You can still open a ticket and we’ll reply when we’re back.',
    color: 0xed4245,
  },
};

const STATE_EMOJIS = Object.values(STATUS_STATES).map((s) => s.emoji);

/** The channel name without any status emoji in front. */
export function baseChannelName(name: string): string {
  let out = name;
  for (const emoji of STATE_EMOJIS) if (out.startsWith(emoji)) out = out.slice(emoji.length);
  return out;
}

export function statusChannelName(baseName: string, state: StatusState): string {
  return `${STATUS_STATES[state].emoji}${baseChannelName(baseName)}`.slice(0, 100);
}

export function statusEmbed(options: {
  state: StatusState;
  note?: string | null;
  updatedBy?: string | null;
  at: Date;
  serverName: string;
}): EmbedPayload {
  const s = STATUS_STATES[options.state];
  return {
    author: options.serverName,
    title: `${s.emoji} ${s.headline}`,
    color: s.color,
    description: [
      s.detail,
      '',
      box('Status', `${s.emoji} **${s.label}**`),
      box('Updated', discordTime(options.at)),
      ...(options.updatedBy ? [box('By', options.updatedBy)] : []),
      ...(options.note ? ['', `> ${options.note.replace(/\n/g, '\n> ')}`] : []),
    ].join('\n'),
    footer: 'Check here before opening a ticket',
  };
}
