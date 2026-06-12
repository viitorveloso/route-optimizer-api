import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLruCache } from '../src/infra/lruCache.js';

test('stores and retrieves values', () => {
  const cache = createLruCache({ maxEntries: 2 });

  cache.set('a', 1);
  assert.equal(cache.get('a'), 1);
  assert.equal(cache.get('missing'), undefined);
});

test('evicts the least recently used entry when over capacity', () => {
  const cache = createLruCache({ maxEntries: 2 });

  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3); // 'a' is the oldest -> evicted

  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.get('b'), 2);
  assert.equal(cache.get('c'), 3);
});

test('get() refreshes recency and changes who gets evicted', () => {
  const cache = createLruCache({ maxEntries: 2 });

  cache.set('a', 1);
  cache.set('b', 2);
  cache.get('a'); // 'a' becomes most recent; 'b' is now the LRU
  cache.set('c', 3); // evicts 'b'

  assert.equal(cache.get('a'), 1);
  assert.equal(cache.get('b'), undefined);
});

test('expires entries after the TTL (fake clock, no sleeping)', () => {
  let fakeNow = 1000;
  const cache = createLruCache({
    maxEntries: 10,
    ttlMs: 500,
    now: () => fakeNow,
  });

  cache.set('a', 1);

  fakeNow = 1400; // 400ms later: still valid
  assert.equal(cache.get('a'), 1);

  fakeNow = 2000; // 1000ms after creation: expired
  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.size, 0);
});

test('overwriting a key does not inflate size', () => {
  const cache = createLruCache({ maxEntries: 5 });

  cache.set('a', 1);
  cache.set('a', 2);

  assert.equal(cache.size, 1);
  assert.equal(cache.get('a'), 2);
});
