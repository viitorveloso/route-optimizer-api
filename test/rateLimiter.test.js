import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../src/infra/rateLimiter.js';

function createWithFakeClock({ capacity, refillPerSecond }) {
  let fakeNow = 0;
  const limiter = createRateLimiter({
    capacity,
    refillPerSecond,
    now: () => fakeNow,
  });

  return { limiter, advance: (ms) => (fakeNow += ms) };
}

test('allows requests up to the bucket capacity', () => {
  const { limiter } = createWithFakeClock({ capacity: 3, refillPerSecond: 1 });

  assert.equal(limiter.tryConsume('ip-1').allowed, true);
  assert.equal(limiter.tryConsume('ip-1').allowed, true);
  assert.equal(limiter.tryConsume('ip-1').allowed, true);
  assert.equal(limiter.tryConsume('ip-1').allowed, false);
});

test('blocked response includes a retry hint', () => {
  const { limiter } = createWithFakeClock({ capacity: 1, refillPerSecond: 1 });

  limiter.tryConsume('ip-1');
  const verdict = limiter.tryConsume('ip-1');

  assert.equal(verdict.allowed, false);
  assert.ok(verdict.retryAfterSeconds >= 1);
});

test('tokens refill over time', () => {
  const { limiter, advance } = createWithFakeClock({ capacity: 2, refillPerSecond: 1 });

  limiter.tryConsume('ip-1');
  limiter.tryConsume('ip-1');
  assert.equal(limiter.tryConsume('ip-1').allowed, false);

  advance(1000); // +1 token
  assert.equal(limiter.tryConsume('ip-1').allowed, true);
  assert.equal(limiter.tryConsume('ip-1').allowed, false);
});

test('refill never exceeds capacity', () => {
  const { limiter, advance } = createWithFakeClock({ capacity: 2, refillPerSecond: 1 });

  limiter.tryConsume('ip-1');
  advance(60_000); // a minute idle: bucket caps at 2, not 60

  assert.equal(limiter.tryConsume('ip-1').allowed, true);
  assert.equal(limiter.tryConsume('ip-1').allowed, true);
  assert.equal(limiter.tryConsume('ip-1').allowed, false);
});

test('buckets are independent per key', () => {
  const { limiter } = createWithFakeClock({ capacity: 1, refillPerSecond: 1 });

  assert.equal(limiter.tryConsume('ip-1').allowed, true);
  assert.equal(limiter.tryConsume('ip-2').allowed, true);
  assert.equal(limiter.tryConsume('ip-1').allowed, false);
});

test('prune removes idle buckets to free memory', () => {
  const { limiter, advance } = createWithFakeClock({ capacity: 1, refillPerSecond: 1 });

  limiter.tryConsume('ip-1');
  limiter.tryConsume('ip-2');
  assert.equal(limiter.size, 2);

  advance(11 * 60_000);
  limiter.prune(10 * 60_000);

  assert.equal(limiter.size, 0);
});
