import { buildDistanceMatrix } from './distanceMatrix.js';
import { nearestNeighbor } from './nearestNeighbor.js';
import { twoOpt } from './twoOpt.js';
import { routeDistance } from './routeDistance.js';

/**
 * Full optimization pipeline:
 *
 *   stops -> distance matrix -> nearest neighbor -> 2-opt -> metrics
 *
 * The first stop in the array is treated as the starting point (depot).
 * Pure function: no I/O, no global state — which is exactly what makes
 * it trivial to unit test and to run inside a worker thread.
 *
 * @param {Array<{ id: string|number, lat: number, lng: number }>} stops
 * @param {{ roundTrip?: boolean }} [options]
 */
export function optimize(stops, { roundTrip = false } = {}) {
  const startedAt = performance.now();
  const n = stops.length;

  const matrix = buildDistanceMatrix(stops);

  const originalOrder = Array.from({ length: n }, (_, i) => i);
  const originalKm = routeDistance(originalOrder, matrix, roundTrip);

  const greedyRoute = nearestNeighbor(matrix, 0);
  const optimizedRoute = twoOpt(greedyRoute, matrix, { roundTrip });
  const optimizedKm = routeDistance(optimizedRoute, matrix, roundTrip);

  const savedKm = originalKm - optimizedKm;
  const improvementPercent = originalKm > 0 ? (savedKm / originalKm) * 100 : 0;

  return {
    route: optimizedRoute.map((stopIndex, position) => ({
      position: position + 1,
      ...stops[stopIndex],
    })),
    distances: {
      originalKm: round(originalKm, 3),
      optimizedKm: round(optimizedKm, 3),
      savedKm: round(savedKm, 3),
      improvementPercent: round(improvementPercent, 2),
    },
    meta: {
      stops: n,
      roundTrip,
      algorithm: 'nearest-neighbor + 2-opt',
      elapsedMs: round(performance.now() - startedAt, 2),
    },
  };
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
