/**
 * Centralized configuration: every tunable lives here, read from
 * environment variables with sane defaults. Receiving `env` as a
 * parameter (instead of touching process.env directly) makes the
 * config itself unit-testable.
 *
 * @param {NodeJS.ProcessEnv} [env]
 */
export function loadConfig(env = process.env) {
  return {
    port: toNumber(env.PORT, 3000),

    // Hard limit of stops per request (2-opt is O(n^2) per pass).
    maxStops: toNumber(env.MAX_STOPS, 500),

    // Request body size limit in bytes (1 MiB default).
    maxBodyBytes: toNumber(env.MAX_BODY_BYTES, 1_048_576),

    // From this many stops on, computation moves to a worker thread.
    workerThreshold: toNumber(env.WORKER_THRESHOLD, 150),
    workerTimeoutMs: toNumber(env.WORKER_TIMEOUT_MS, 30_000),

    rateLimit: {
      capacity: toNumber(env.RATE_LIMIT_CAPACITY, 20),
      refillPerSecond: toNumber(env.RATE_LIMIT_REFILL, 1),
    },

    cache: {
      maxEntries: toNumber(env.CACHE_MAX_ENTRIES, 100),
      ttlMs: toNumber(env.CACHE_TTL_MS, 5 * 60_000),
    },

    // Disables the access log (used by the test suite).
    quiet: env.QUIET === 'true',
  };
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
