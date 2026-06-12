/**
 * Token bucket rate limiter, in memory, per key (e.g. client IP).
 *
 * Each key gets a bucket holding up to `capacity` tokens. Every request
 * consumes 1 token; tokens refill continuously at `refillPerSecond`.
 * Lazy refill: instead of a timer per bucket, tokens are recalculated
 * from the elapsed time at the moment of each request.
 *
 * The clock (`now`) is injected so tests can control time deterministically
 * instead of sleeping.
 */

/**
 * @param {{ capacity: number, refillPerSecond: number, now?: () => number }} options
 */
export function createRateLimiter({ capacity, refillPerSecond, now = () => Date.now() }) {
  /** @type {Map<string, { tokens: number, lastRefill: number }>} */
  const buckets = new Map();

  /**
   * @param {string} key
   * @returns {{ allowed: boolean, remaining: number, retryAfterSeconds?: number }}
   */
  function tryConsume(key) {
    const timestamp = now();
    let bucket = buckets.get(key);

    if (!bucket) {
      bucket = { tokens: capacity, lastRefill: timestamp };
      buckets.set(key, bucket);
    } else {
      const elapsedSeconds = (timestamp - bucket.lastRefill) / 1000;
      bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSeconds * refillPerSecond);
      bucket.lastRefill = timestamp;
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true, remaining: Math.floor(bucket.tokens) };
    }

    const retryAfterSeconds = Math.ceil((1 - bucket.tokens) / refillPerSecond);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  /**
   * Removes buckets idle for longer than maxIdleMs, so the Map does not
   * grow forever with IPs that hit the API once and never came back.
   */
  function prune(maxIdleMs = 10 * 60_000) {
    const timestamp = now();
    for (const [key, bucket] of buckets) {
      if (timestamp - bucket.lastRefill > maxIdleMs) {
        buckets.delete(key);
      }
    }
  }

  return {
    tryConsume,
    prune,
    get size() {
      return buckets.size;
    },
  };
}
