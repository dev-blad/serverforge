import type { Logger } from '../../logger.js';

export interface QueueOptions {
  /** Parallel tasks. Builds use 1 so Discord sees a steady, ordered stream. */
  concurrency?: number;
  /** Minimum delay between task starts (ms). */
  minIntervalMs?: number;
  /** Retries after the first attempt for retryable errors. */
  retries?: number;
  /** First backoff delay (ms); doubles each retry, with jitter. */
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
  logger?: Logger;
}

const RETRYABLE_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
  'UND_ERR_HEADERS_TIMEOUT',
]);

interface ErrorLike {
  status?: unknown;
  code?: unknown;
  name?: unknown;
  retryAfter?: unknown;
  timeToReset?: unknown;
}

/**
 * Is this error worth retrying? Rate limits (429), Discord 5xx, aborted requests and network
 * errors are. Permission/validation errors (4xx) are not — they'd just fail again.
 */
export function isRetryable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as ErrorLike;
  if (typeof e.status === 'number') return e.status === 429 || e.status >= 500;
  if (typeof e.code === 'string' && RETRYABLE_CODES.has(e.code)) return true;
  if (e.name === 'AbortError' || e.name === 'RateLimitError') return true;
  return false;
}

/** Server-suggested wait in ms, if the error carries one. */
export function retryAfterMs(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const e = error as ErrorLike;
  if (typeof e.retryAfter === 'number') return e.retryAfter;
  if (typeof e.timeToReset === 'number') return e.timeToReset;
  return null;
}

export class RetryError extends Error {
  constructor(
    readonly label: string,
    readonly attempts: number,
    override readonly cause: unknown,
  ) {
    super(
      `${label} failed after ${attempts} attempt(s): ${cause instanceof Error ? cause.message : String(cause)}`,
    );
    this.name = 'RetryError';
  }
}

/**
 * A small promise queue with concurrency control, minimum spacing between task starts and
 * exponential backoff with jitter for retryable errors.
 *
 * discord.js already obeys Discord's per-route rate limits; this queue adds pacing (so a
 * 100-action build doesn't hit global/"bulk create" limits), ordering and retries for
 * transient failures.
 */
export class TaskQueue {
  private readonly concurrency: number;
  private readonly minIntervalMs: number;
  private readonly retries: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly now: () => number;
  private readonly logger: Logger | undefined;
  private running = 0;
  private lastStart = -Infinity;
  private readonly waiting: (() => void)[] = [];

  constructor(options: QueueOptions = {}) {
    this.concurrency = options.concurrency ?? 1;
    this.minIntervalMs = options.minIntervalMs ?? 250;
    this.retries = options.retries ?? 4;
    this.baseDelayMs = options.baseDelayMs ?? 1000;
    this.maxDelayMs = options.maxDelayMs ?? 30_000;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.random = options.random ?? Math.random;
    this.now = options.now ?? Date.now;
    this.logger = options.logger;
  }

  get pending(): number {
    return this.waiting.length + this.running;
  }

  backoffDelay(attempt: number, error: unknown): number {
    const suggested = retryAfterMs(error);
    if (suggested !== null) return Math.min(this.maxDelayMs, suggested + 50);
    const exp = this.baseDelayMs * 2 ** (attempt - 1);
    const jitter = exp * 0.25 * this.random();
    return Math.min(this.maxDelayMs, Math.round(exp + jitter));
  }

  private async acquire(): Promise<void> {
    if (this.running >= this.concurrency) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.running += 1;
    const wait = this.lastStart + this.minIntervalMs - this.now();
    this.lastStart = Math.max(this.now(), this.lastStart + this.minIntervalMs);
    if (wait > 0) await this.sleep(wait);
  }

  private release(): void {
    this.running -= 1;
    this.waiting.shift()?.();
  }

  /** Run a task through the queue with retries. */
  async run<T>(label: string, task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      let attempt = 0;
      for (;;) {
        attempt += 1;
        try {
          return await task();
        } catch (error) {
          if (attempt > this.retries || !isRetryable(error)) {
            if (attempt > 1) throw new RetryError(label, attempt, error);
            throw error;
          }
          const delay = this.backoffDelay(attempt, error);
          this.logger?.warn({ label, attempt, delay, err: error }, 'retrying Discord request');
          await this.sleep(delay);
        }
      }
    } finally {
      this.release();
    }
  }
}
