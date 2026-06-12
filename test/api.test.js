import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
import { createApp } from '../src/server.js';

/** Boots the real app on a random port and returns its base URL. */
async function startServer(overrides = {}) {
  const config = { ...loadConfig({}), quiet: true, ...overrides };
  const server = createApp(config);

  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

const stops = [
  { id: 'depot', name: 'Depósito - Centro', lat: -2.5297, lng: -44.3028 },
  { id: 'calhau', lat: -2.4856, lng: -44.2367 },
  { id: 'renascenca', lat: -2.4979, lng: -44.2933 },
  { id: 'cohama', lat: -2.5246, lng: -44.2497 },
  { id: 'turu', lat: -2.5126, lng: -44.2207 },
];

describe('API integration', () => {
  let server;
  let baseUrl;

  before(async () => {
    ({ server, baseUrl } = await startServer({
      // Generous limit so these tests never trip the limiter.
      rateLimit: { capacity: 1000, refillPerSecond: 1000 },
    }));
  });

  after(() => new Promise((resolve) => server.close(resolve)));

  test('GET /health returns ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.status, 'ok');
  });

  test('GET / describes the API', async () => {
    const res = await fetch(`${baseUrl}/`);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.name, 'route-optimizer-api');
  });

  test('unknown route returns 404', async () => {
    const res = await fetch(`${baseUrl}/nope`);
    assert.equal(res.status, 404);
  });

  test('wrong method on a known route returns 405 with Allow header', async () => {
    const res = await fetch(`${baseUrl}/optimize`);

    assert.equal(res.status, 405);
    assert.ok(res.headers.get('allow').includes('POST'));
  });

  test('POST /optimize returns an optimized route', async () => {
    const res = await fetch(`${baseUrl}/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stops }),
    });

    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-cache'), 'MISS');
    assert.equal(body.route.length, stops.length);
    assert.equal(body.route[0].id, 'depot');
    assert.equal(body.route[0].name, 'Depósito - Centro');
    assert.ok(body.distances.optimizedKm <= body.distances.originalKm);
    assert.equal(body.meta.computedIn, 'event-loop');
  });

  test('identical payload hits the cache on the second call', async () => {
    const payload = { stops, options: { roundTrip: true } };

    const first = await fetch(`${baseUrl}/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(first.headers.get('x-cache'), 'MISS');

    const second = await fetch(`${baseUrl}/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(second.headers.get('x-cache'), 'HIT');
    assert.deepEqual(await second.json(), await first.json());
  });

  test('invalid JSON returns 400', async () => {
    const res = await fetch(`${baseUrl}/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });

    assert.equal(res.status, 400);
  });

  test('empty body returns 400', async () => {
    const res = await fetch(`${baseUrl}/optimize`, { method: 'POST' });
    assert.equal(res.status, 400);
  });

  test('invalid payload returns 422 with detailed errors', async () => {
    const res = await fetch(`${baseUrl}/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stops: [{ id: 'a', lat: 999, lng: 0 }] }),
    });

    const body = await res.json();

    assert.equal(res.status, 422);
    assert.ok(Array.isArray(body.details));
    assert.ok(body.details.some((message) => message.includes('lat')));
  });

  test('large instances are computed in a worker thread', async () => {
    const manyStops = Array.from({ length: 160 }, (_, i) => ({
      id: `stop-${i}`,
      lat: -2.6 + (i % 40) * 0.003,
      lng: -44.35 + Math.floor(i / 40) * 0.003,
    }));

    const res = await fetch(`${baseUrl}/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stops: manyStops }),
    });

    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.meta.computedIn, 'worker-thread');
    assert.equal(body.route.length, 160);
  });
});

describe('rate limiting', () => {
  test('returns 429 with Retry-After once the bucket is empty', async () => {
    const { server, baseUrl } = await startServer({
      rateLimit: { capacity: 2, refillPerSecond: 0.1 },
    });

    try {
      const first = await fetch(`${baseUrl}/health`);
      const second = await fetch(`${baseUrl}/health`);
      const third = await fetch(`${baseUrl}/health`);

      assert.equal(first.status, 200);
      assert.equal(second.status, 200);
      assert.equal(third.status, 429);
      assert.ok(Number(third.headers.get('retry-after')) >= 1);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
