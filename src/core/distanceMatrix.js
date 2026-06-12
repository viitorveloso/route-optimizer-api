import { haversine } from './haversine.js';

/**
 * Builds a symmetric n x n distance matrix between all points.
 *
 * Computes only the upper triangle and mirrors it (distance is symmetric),
 * cutting the haversine calls in half: n*(n-1)/2 instead of n^2.
 *
 * @param {Array<{ lat: number, lng: number }>} points
 * @returns {number[][]} matrix[i][j] = distance in km between points i and j
 */
export function buildDistanceMatrix(points) {
  const n = points.length;
  const matrix = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const distance = haversine(points[i], points[j]);
      matrix[i][j] = distance;
      matrix[j][i] = distance;
    }
  }

  return matrix;
}
