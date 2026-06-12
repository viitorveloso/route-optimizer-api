import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bruteForce, BRUTE_FORCE_LIMIT } from '../src/core/bruteForce.js';
import { buildDistanceMatrix } from '../src/core/distanceMatrix.js';
import { nearestNeighbor } from '../src/core/nearestNeighbor.js';
import { twoOpt } from '../src/core/twoOpt.js';
import { routeDistance } from '../src/core/routeDistance.js';

// 8 fixed points spread around São Luís (deterministic test data).
const stops = [
  { lat: -2.5297, lng: -44.3028 },
  { lat: -2.4979, lng: -44.2933 },
  { lat: -2.4856, lng: -44.2367 },
  { lat: -2.5246, lng: -44.2497 },
  { lat: -2.5126, lng: -44.2207 },
  { lat: -2.4866, lng: -44.2546 },
  { lat: -2.5394, lng: -44.2475 },
  { lat: -2.5052, lng: -44.2906 },
];

test('rejects instances above the factorial limit', () => {
  const tooBig = buildDistanceMatrix(
    Array.from({ length: BRUTE_FORCE_LIMIT + 1 }, (_, i) => ({ lat: i * 0.01, lng: 0 }))
  );

  assert.throws(() => bruteForce(tooBig), RangeError);
});

test('finds the obvious optimum on a tiny instance', () => {
  // Three collinear points: visiting in order is clearly optimal.
  const line = buildDistanceMatrix([
    { lat: 0, lng: 0 },
    { lat: 0, lng: 0.01 },
    { lat: 0, lng: 0.02 },
  ]);

  const { route } = bruteForce(line);
  assert.deepEqual(route, [0, 1, 2]);
});

test('keeps the depot fixed at position 0', () => {
  const matrix = buildDistanceMatrix(stops.slice(0, 6));
  const { route } = bruteForce(matrix);
  assert.equal(route[0], 0);
});

test('optimal is never worse than the heuristic (n=8, open route)', () => {
  const matrix = buildDistanceMatrix(stops);

  const heuristic = twoOpt(nearestNeighbor(matrix, 0), matrix);
  const heuristicDistance = routeDistance(heuristic, matrix);

  const { distance: optimal } = bruteForce(matrix);

  assert.ok(optimal <= heuristicDistance + 1e-9);
});

test('heuristic stays within 10% of the optimum on this instance', () => {
  const matrix = buildDistanceMatrix(stops);

  const heuristic = twoOpt(nearestNeighbor(matrix, 0), matrix);
  const heuristicDistance = routeDistance(heuristic, matrix);

  const { distance: optimal } = bruteForce(matrix);

  assert.ok(
    heuristicDistance <= optimal * 1.10,
    `heuristic ${heuristicDistance} km vs optimal ${optimal} km`
  );
});
