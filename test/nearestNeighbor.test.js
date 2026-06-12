import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearestNeighbor } from '../src/core/nearestNeighbor.js';

// Hand-built matrix where the greedy path from 0 is unambiguous:
// 0 -> 2 (1km) -> 3 (2km) -> 1 (3km)
const matrix = [
  [0, 9, 1, 8],
  [9, 0, 7, 3],
  [1, 7, 0, 2],
  [8, 3, 2, 0],
];

test('follows the closest unvisited stop at each step', () => {
  assert.deepEqual(nearestNeighbor(matrix, 0), [0, 2, 3, 1]);
});

test('respects a different starting point', () => {
  const route = nearestNeighbor(matrix, 1);
  assert.equal(route[0], 1);
});

test('visits every stop exactly once', () => {
  const route = nearestNeighbor(matrix, 0);
  assert.equal(route.length, matrix.length);
  assert.equal(new Set(route).size, matrix.length);
});

test('handles a single point', () => {
  assert.deepEqual(nearestNeighbor([[0]], 0), [0]);
});

test('handles empty input', () => {
  assert.deepEqual(nearestNeighbor([], 0), []);
});
