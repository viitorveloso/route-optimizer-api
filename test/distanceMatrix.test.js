import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDistanceMatrix } from '../src/core/distanceMatrix.js';
import { routeDistance } from '../src/core/routeDistance.js';
import { haversine } from '../src/core/haversine.js';

const points = [
  { lat: -2.5297, lng: -44.3028 },
  { lat: -2.4979, lng: -44.2933 },
  { lat: -2.4856, lng: -44.2367 },
];

test('matrix has zero diagonal', () => {
  const matrix = buildDistanceMatrix(points);
  for (let i = 0; i < points.length; i++) {
    assert.equal(matrix[i][i], 0);
  }
});

test('matrix is symmetric and matches haversine', () => {
  const matrix = buildDistanceMatrix(points);

  for (let i = 0; i < points.length; i++) {
    for (let j = 0; j < points.length; j++) {
      assert.equal(matrix[i][j], matrix[j][i]);
      assert.equal(matrix[i][j], haversine(points[i], points[j]));
    }
  }
});

test('empty input produces empty matrix', () => {
  assert.deepEqual(buildDistanceMatrix([]), []);
});

test('routeDistance sums consecutive legs', () => {
  const matrix = buildDistanceMatrix(points);
  const expected = matrix[0][1] + matrix[1][2];
  assert.equal(routeDistance([0, 1, 2], matrix), expected);
});

test('routeDistance with roundTrip adds the leg back to start', () => {
  const matrix = buildDistanceMatrix(points);
  const open = routeDistance([0, 1, 2], matrix, false);
  const closed = routeDistance([0, 1, 2], matrix, true);
  assert.equal(closed, open + matrix[2][0]);
});

test('single-stop route has zero distance', () => {
  const matrix = buildDistanceMatrix([points[0]]);
  assert.equal(routeDistance([0], matrix, true), 0);
});
