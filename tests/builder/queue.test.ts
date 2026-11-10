import { describe, expect, it } from 'vitest';
import {
  RetryError,
  TaskQueue,
  isRetryable,
  retryAfterMs,
} from '../../src/services/builder/queue.js';

const err = (props: Record<string, unknown>) => Object.assign(new Error('e'), props);

describe('TaskQueue', () => {
  it('classifies retryable errors', () => {
    expect(isRetryable(err({ status: 429 }))).toBe(true);
    expect(isRetryable(err({ status: 502 }))).toBe(true);
    expect(isRetryable(err({ status: 403 }))).toBe(false);
    expect(isRetryable(err({ code: 'ECONNRESET' }))).toBe(true);
    expect(isRetryable(err({ name: 'AbortError' }))).toBe(true);
    expect(isRetryable('nope')).toBe(false);
    expect(retryAfterMs(err({ retryAfter: 1200 }))).toBe(1200);
    expect(retryAfterMs(err({}))).toBeNull();
  });

  it('retries transient failures with exponential backoff', async () => {
    const sleeps: number[] = [];
    const q = new TaskQueue({
      minIntervalMs: 0,
      baseDelayMs: 100,
      random: () => 0,
      sleep: async (ms) => void sleeps.push(ms),
    });
    let calls = 0;
    const value = await q.run('t', async () => {
      calls += 1;
      if (calls < 4) throw err({ status: 500 });
      return 'ok';
    });
    expect(value).toBe('ok');
    expect(sleeps).toEqual([100, 200, 400]);
  });

  it('honours retry-after hints and caps delays', async () => {
    const sleeps: number[] = [];
    const q = new TaskQueue({
      minIntervalMs: 0,
      maxDelayMs: 1000,
      sleep: async (ms) => void sleeps.push(ms),
    });
    let calls = 0;
    await q.run('t', async () => {
      calls += 1;
      if (calls === 1) throw err({ status: 429, retryAfter: 300 });
      if (calls === 2) throw err({ status: 429, retryAfter: 99_999 });
      return 1;
    });
    expect(sleeps).toEqual([350, 1000]);
  });

  it('does not retry permanent errors and wraps exhausted retries', async () => {
    const q = new TaskQueue({
      minIntervalMs: 0,
      retries: 2,
      baseDelayMs: 1,
      sleep: async () => undefined,
    });
    const permanent = err({ status: 403 });
    let calls = 0;
    await expect(
      q.run('t', async () => {
        calls += 1;
        throw permanent;
      }),
    ).rejects.toBe(permanent);
    expect(calls).toBe(1);

    calls = 0;
    const failure = q.run('flaky', async () => {
      calls += 1;
      throw err({ status: 503 });
    });
    await expect(failure).rejects.toBeInstanceOf(RetryError);
    await expect(failure).rejects.toThrow(/flaky failed after 3 attempt/);
    expect(calls).toBe(3);
  });

  it('runs tasks one at a time in order and spaces them out', async () => {
    let now = 0;
    const sleeps: number[] = [];
    const q = new TaskQueue({
      minIntervalMs: 250,
      now: () => now,
      sleep: async (ms) => {
        sleeps.push(ms);
        now += ms;
      },
    });
    const order: number[] = [];
    let active = 0;
    let maxActive = 0;
    await Promise.all(
      [1, 2, 3].map((i) =>
        q.run(`t${i}`, async () => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          order.push(i);
          await Promise.resolve();
          active -= 1;
        }),
      ),
    );
    expect(order).toEqual([1, 2, 3]);
    expect(maxActive).toBe(1);
    expect(sleeps).toEqual([250, 250]);
    expect(q.pending).toBe(0);
  });

  it('supports concurrency > 1', async () => {
    const q = new TaskQueue({ concurrency: 2, minIntervalMs: 0, sleep: async () => undefined });
    let active = 0;
    let maxActive = 0;
    await Promise.all(
      Array.from({ length: 5 }, () =>
        q.run('t', async () => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          await new Promise((r) => setTimeout(r, 5));
          active -= 1;
        }),
      ),
    );
    expect(maxActive).toBe(2);
  });
});
