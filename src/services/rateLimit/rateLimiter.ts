import { UserFacingError } from '../../errors.js';

export interface RateLimitStatus {
  limited: boolean;
  remaining: number;
  /** Milliseconds until the oldest hit leaves the window (0 when not limited). */
  retryAfterMs: number;
}

/**
 * Sliding-window counter. In-memory (single process); the interface is small enough to back
 * with Redis if ServerForge is ever scaled horizontally.
 */
export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    readonly limit: number,
    readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  private prune(id: string): number[] {
    const cutoff = this.now() - this.windowMs;
    const list = (this.hits.get(id) ?? []).filter((t) => t > cutoff);
    if (list.length) this.hits.set(id, list);
    else this.hits.delete(id);
    return list;
  }

  status(id: string): RateLimitStatus {
    const list = this.prune(id);
    const limited = list.length >= this.limit;
    const oldest = list[0];
    return {
      limited,
      remaining: Math.max(0, this.limit - list.length),
      retryAfterMs: limited && oldest !== undefined ? oldest + this.windowMs - this.now() : 0,
    };
  }

  hit(id: string): RateLimitStatus {
    const list = this.prune(id);
    list.push(this.now());
    this.hits.set(id, list);
    return this.status(id);
  }

  reset(id: string): void {
    this.hits.delete(id);
  }

  /** Drop all expired entries (call periodically to bound memory). */
  sweep(): void {
    for (const id of [...this.hits.keys()]) this.prune(id);
  }

  get size(): number {
    return this.hits.size;
  }
}

function formatWait(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  return minutes <= 1 ? 'about a minute' : `${minutes} minutes`;
}

/** Throttles failed license key attempts per user and per guild. */
export class KeyAttemptGuard {
  readonly perUser: SlidingWindowRateLimiter;
  readonly perGuild: SlidingWindowRateLimiter;

  constructor(
    options: { perUser: number; perGuild: number; windowMs: number },
    now: () => number = Date.now,
  ) {
    this.perUser = new SlidingWindowRateLimiter(options.perUser, options.windowMs, now);
    this.perGuild = new SlidingWindowRateLimiter(options.perGuild, options.windowMs, now);
  }

  /** Throw a friendly error if this user or guild is currently locked out. */
  assertAllowed(userId: string, guildId: string): void {
    const user = this.perUser.status(userId);
    const guild = this.perGuild.status(guildId);
    if (user.limited || guild.limited) {
      const wait = Math.max(user.retryAfterMs, guild.retryAfterMs);
      throw new UserFacingError(
        `Too many invalid key attempts${guild.limited && !user.limited ? ' in this server' : ''}. Please try again in ${formatWait(wait)}.`,
        { title: 'Slow down' },
      );
    }
  }

  recordFailure(userId: string, guildId: string): void {
    this.perUser.hit(userId);
    this.perGuild.hit(guildId);
  }

  recordSuccess(userId: string): void {
    this.perUser.reset(userId);
  }

  sweep(): void {
    this.perUser.sweep();
    this.perGuild.sweep();
  }
}
