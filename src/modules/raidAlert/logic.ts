import type { EmbedPayload } from '../../services/builder/gateway.js';
import { discordTime } from '../common.js';

export interface JoinEvent {
  userId: string;
  tag: string;
  accountCreatedAt: Date;
  at: number;
}

/**
 * Sliding-window join counter per server. Raises one alert when `joins` members arrive within
 * `seconds`, then stays quiet for a cooldown so a raid doesn't produce dozens of alerts.
 */
export class RaidDetector {
  private readonly joins = new Map<string, JoinEvent[]>();
  private readonly lastAlert = new Map<string, number>();

  constructor(private readonly cooldownMs = 10 * 60_000) {}

  record(
    guildId: string,
    event: JoinEvent,
    threshold: { joins: number; seconds: number },
  ): JoinEvent[] | null {
    const windowStart = event.at - threshold.seconds * 1000;
    const recent = [...(this.joins.get(guildId) ?? []), event].filter((e) => e.at >= windowStart);
    this.joins.set(guildId, recent.slice(-100));
    if (recent.length < threshold.joins) return null;
    const last = this.lastAlert.get(guildId);
    if (last !== undefined && event.at - last < this.cooldownMs) return null;
    this.lastAlert.set(guildId, event.at);
    return recent;
  }
}

export function raidAlertEmbed(
  joins: readonly JoinEvent[],
  seconds: number,
  now: number,
): EmbedPayload {
  const newAccounts = joins.filter(
    (j) => now - j.accountCreatedAt.getTime() < 7 * 86_400_000,
  ).length;
  return {
    title: '🚨 Possible raid',
    color: 0xed4245,
    description: [
      `**${joins.length} accounts joined in under ${seconds} seconds.**`,
      newAccounts ? `${newAccounts} of them are less than a week old.` : '',
      '',
      '**Most recent joins**',
      ...joins
        .slice(-10)
        .reverse()
        .map(
          (j) => `<@${j.userId}> \`${j.tag}\` — account created ${discordTime(j.accountCreatedAt)}`,
        ),
      '',
      '**What you can do:** Server Settings → Safety Setup → turn on raid protection, pause invites, or raise the verification level until it calms down.',
    ]
      .filter((l, i, all) => !(l === '' && all[i - 1] === ''))
      .join('\n'),
    timestamp: true,
  };
}
