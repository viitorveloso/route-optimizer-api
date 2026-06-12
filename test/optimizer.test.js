import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optimize } from '../src/core/optimizer.js';

const stops = [
  { id: 'depot', lat: -2.5297, lng: -44.3028 },
  { id: 'b', lat: -2.4856, lng: -44.2367 },
  { id: 'c', lat: -2.4979, lng: -44.2933 },
  { id: 'd', lat: -2.5246, lng: -44.2497 },
];

test('optimized route is never longer than the original order', () => {
  const result = optimize(stops);

  assert.ok(result.distances.optimizedKm <= result.distances.originalKm);
  assert.ok(result.distances.savedKm >= 0);
});

test('keeps the first stop as the starting point', () => {
  const result = optimize(stops);
  assert.equal(result.route[0].id, 'depot');
});

test('returns every stop with sequential positions', () => {
  const result = optimize(stops);

  assert.equal(result.route.length, stops.length);
  assert.deepEqual(
    result.route.map((stop) => stop.position),
    [1, 2, 3, 4]
  );

  const ids = new Set(result.route.map((stop) => stop.id));
  assert.equal(ids.size, stops.length);
});

test('preserves extra fields like "name" on each stop', () => {
  const withNames = stops.map((stop) => ({ ...stop, name: `Client ${stop.id}` }));
  const result = optimize(withNames);

  for (const stop of result.route) {
    assert.match(stop.name, /^Client /);
  }
});

test('handles a single stop', () => {
  const result = optimize([stops[0]]);

  assert.equal(result.distances.optimizedKm, 0);
  assert.equal(result.distances.improvementPercent, 0);
  assert.equal(result.route.length, 1);
});

test('roundTrip flag is reflected in metadata and distance', () => {
  const open = optimize(stops, { roundTrip: false });
  const closed = optimize(stops, { roundTrip: true });

  assert.equal(open.meta.roundTrip, false);
  assert.equal(closed.meta.roundTrip, true);
  assert.ok(closed.distances.optimizedKm > open.distances.optimizedKm);
});
