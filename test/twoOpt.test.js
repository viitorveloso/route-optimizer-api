import { test } from 'node:test';
import assert from 'node:assert/strict';
import { twoOpt } from '../src/core/twoOpt.js';
import { buildDistanceMatrix } from '../src/core/distanceMatrix.js';
import { routeDistance } from '../src/core/routeDistance.js';
import { bruteForce } from '../src/core/bruteForce.js';

// Four corners of a "square" (~1.1 km sides) near the equator.
const square = [
  { lat: 0, lng: 0 }, // 0: bottom-left (depot)
  { lat: 0, lng: 0.01 }, // 1: bottom-right
  { lat: 0.01, lng: 0.01 }, // 2: top-right
  { lat: 0.01, lng: 0 }, // 3: top-left
];

test('uncrosses a route with crossing edges', () => {
  const matrix = buildDistanceMatrix(square);

  // 0 -> 2 -> 1 -> 3 forms an X across the square.
  const crossed = [0, 2, 1, 3];
  const crossedDistance = routeDistance(crossed, matrix);

  const improved = twoOpt(crossed, matrix);
  const improvedDistance = routeDistance(improved, matrix);

  assert.ok(
    improvedDistance < crossedDistance,
    `expected improvement: ${improvedDistance} >= ${crossedDistance}`
  );

  // On this instance 2-opt must reach the true optimum.
  const { distance: optimal } = bruteForce(matrix);
  assert.ok(Math.abs(improvedDistance - optimal) < 1e-9);
});

test('never makes a route worse', () => {
  const matrix = buildDistanceMatrix(square);
  const alreadyGood = [0, 1, 2, 3];

  const result = twoOpt(alreadyGood, matrix);

  assert.ok(routeDistance(result, matrix) <= routeDistance(alreadyGood, matrix) + 1e-9);
});

test('result is a valid permutation, depot fixed at position 0', () => {
  const matrix = buildDistanceMatrix(square);
  const result = twoOpt([0, 2, 1, 3], matrix);

  assert.equal(result.length, 4);
  assert.equal(new Set(result).size, 4);
  assert.equal(result[0], 0);
});

test('does not mutate the input route', () => {
  const matrix = buildDistanceMatrix(square);
  const input = [0, 2, 1, 3];
  const copy = input.slice();

  twoOpt(input, matrix);

  assert.deepEqual(input, copy);
});

test('roundTrip mode also reaches the optimum on the square', () => {
  const matrix = buildDistanceMatrix(square);

  const improved = twoOpt([0, 2, 1, 3], matrix, { roundTrip: true });
  const improvedDistance = routeDistance(improved, matrix, true);

  const { distance: optimal } = bruteForce(matrix, { roundTrip: true });
  assert.ok(Math.abs(improvedDistance - optimal) < 1e-9);
});

test('returns short routes (n < 3) unchanged', () => {
  const matrix = buildDistanceMatrix(square.slice(0, 2));
  assert.deepEqual(twoOpt([0, 1], matrix), [0, 1]);
});
