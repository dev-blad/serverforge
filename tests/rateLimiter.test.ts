import { describe, expect, it } from 'vitest';
import {
  KeyAttemptGuard,
  SlidingWindowRateLimiter,
} from '../src/services/rateLimit/rateLimiter.js';

describe('SlidingWindowRateLimiter', () => {
  it('limits within the window and recovers as hits expire', () => {
    let now = 0;
    const limiter = new SlidingWindowRateLimiter(3, 1000, () => now);
    expect(limiter.hit('a').remaining).toBe(2);
    now = 100;
    limiter.hit('a');
    now = 200;
    const third = limiter.hit('a');
    expect(third.limited).toBe(true);
    expect(third.retryAfterMs).toBe(800);
    now = 1001; // first hit expired
    expect(limiter.status('a')).toMatchObject({ limited: false, remaining: 1 });
    expect(limiter.status('b').limited).toBe(false);
  });

  it('resets and sweeps', () => {
    let now = 0;
    const limiter = new SlidingWindowRateLimiter(1, 1000, () => now);
    limiter.hit('a');
    limiter.hit('b');
    limiter.reset('a');
    expect(limiter.status('a').limited).toBe(false);
    now = 5000;
    limiter.sweep();
    expect(limiter.size).toBe(0);
  });
});

describe('KeyAttemptGuard', () => {
  it('locks out per user and per guild independently', () => {
    let now = 0;
    const guard = new KeyAttemptGuard({ perUser: 2, perGuild: 3, windowMs: 600_000 }, () => now);
    guard.recordFailure('u1', 'g1');
    guard.recordFailure('u1', 'g1');
    expect(() => guard.assertAllowed('u1', 'g1')).toThrow(
      /Too many invalid key attempts\. Please try again in 10 minutes/,
    );
    expect(() => guard.assertAllowed('u2', 'g1')).not.toThrow();
    guard.recordFailure('u2', 'g1');
    expect(() => guard.assertAllowed('u3', 'g1')).toThrow(/in this server/);
    expect(() => guard.assertAllowed('u3', 'g2')).not.toThrow();
    now = 600_001;
    expect(() => guard.assertAllowed('u1', 'g1')).not.toThrow();
  });

  it('clears a user after a success', () => {
    const guard = new KeyAttemptGuard({ perUser: 2, perGuild: 10, windowMs: 1000 });
    guard.recordFailure('u', 'g');
    guard.recordSuccess('u');
    guard.recordFailure('u', 'g');
    expect(() => guard.assertAllowed('u', 'g')).not.toThrow();
    guard.sweep();
  });
});
