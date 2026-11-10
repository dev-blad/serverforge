export function formatStatsName(format: string, count: number): string {
  return format.replace(/\{count\}/g, count.toLocaleString('en-US')).slice(0, 100);
}

/**
 * Discord only allows ~2 channel renames per 10 minutes per channel, so updates are
 * coalesced: at most one rename per `intervalMs` per guild, and a burst of joins schedules a
 * single trailing update.
 */
export class StatsThrottle {
  private readonly lastRun = new Map<string, number>();
  private readonly scheduled = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly run: (guildId: string) => Promise<void>,
    private readonly intervalMs = 5.5 * 60_000,
    private readonly now: () => number = Date.now,
    private readonly schedule: (fn: () => void, ms: number) => ReturnType<typeof setTimeout> = (
      fn,
      ms,
    ) => {
      const t = setTimeout(fn, ms);
      t.unref?.();
      return t;
    },
  ) {}

  /** Request an update; returns 'now' | 'scheduled' | 'pending'. */
  request(guildId: string): 'now' | 'scheduled' | 'pending' {
    if (this.scheduled.has(guildId)) return 'pending';
    const last = this.lastRun.get(guildId) ?? -Infinity;
    const wait = last + this.intervalMs - this.now();
    if (wait <= 0) {
      this.fire(guildId);
      return 'now';
    }
    this.scheduled.set(
      guildId,
      this.schedule(() => {
        this.scheduled.delete(guildId);
        this.fire(guildId);
      }, wait),
    );
    return 'scheduled';
  }

  private fire(guildId: string): void {
    this.lastRun.set(guildId, this.now());
    void this.run(guildId).catch(() => undefined);
  }

  clear(): void {
    for (const t of this.scheduled.values()) clearTimeout(t);
    this.scheduled.clear();
  }
}
