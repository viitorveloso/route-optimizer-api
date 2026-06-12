/**
 * LRU (Least Recently Used) cache with optional TTL.
 *
 * Built on a single trick: JavaScript's Map preserves insertion order.
 * - get(): delete + re-set moves the entry to the "end" (most recent).
 * - set(): when over capacity, the first key in iteration order is,
 *   by construction, the least recently used one — evict it.
 *
 * Both operations stay O(1). The clock is injectable for deterministic
 * TTL tests (no sleeping in the test suite).
 */

/**
 * @param {{ maxEntries: number, ttlMs?: number, now?: () => number }} options
 */
export function createLruCache({ maxEntries, ttlMs = Infinity, now = () => Date.now() }) {
  /** @type {Map<string, { value: unknown, createdAt: number }>} */
  const entries = new Map();

  /**
   * @param {string} key
   * @returns {unknown | undefined}
   */
  function get(key) {
    const entry = entries.get(key);
    if (!entry) return undefined;

    if (ttlMs !== Infinity && now() - entry.createdAt > ttlMs) {
      entries.delete(key);
      return undefined;
    }

    // Refresh recency: move to the end of the Map's insertion order.
    entries.delete(key);
    entries.set(key, entry);

    return entry.value;
  }

  /**
   * @param {string} key
   * @param {unknown} value
   */
  function set(key, value) {
    if (entries.has(key)) {
      entries.delete(key);
    }

    entries.set(key, { value, createdAt: now() });

    if (entries.size > maxEntries) {
      const leastRecentlyUsed = entries.keys().next().value;
      entries.delete(leastRecentlyUsed);
    }
  }

  return {
    get,
    set,
    clear: () => entries.clear(),
    get size() {
      return entries.size;
    },
  };
}
