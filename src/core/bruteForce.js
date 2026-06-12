import { routeDistance } from './routeDistance.js';

/**
 * Exact solver by exhaustive permutation — O(n!).
 *
 * Only viable for tiny instances (n <= 10 means up to 362,880 permutations
 * of the 9 non-depot stops). Its real job in this project is to serve as
 * ground truth in tests and benchmarks, proving how close the
 * nearest-neighbor + 2-opt heuristic gets to the true optimum.
 *
 * Permutations are generated in place with swaps (no array allocations
 * per branch), backtracking after each recursive call.
 */

export const BRUTE_FORCE_LIMIT = 10;

/**
 * @param {number[][]} matrix - distance matrix
 * @param {{ roundTrip?: boolean, start?: number }} [options]
 * @returns {{ route: number[], distance: number }}
 */
export function bruteForce(matrix, { roundTrip = false, start = 0 } = {}) {
  const n = matrix.length;

  if (n > BRUTE_FORCE_LIMIT) {
    throw new RangeError(
      `bruteForce is limited to ${BRUTE_FORCE_LIMIT} points (got ${n}); use the heuristic instead`
    );
  }

  if (n === 0) return { route: [], distance: 0 };
  if (n === 1) return { route: [start], distance: 0 };

  const rest = [];
  for (let i = 0; i < n; i++) {
    if (i !== start) rest.push(i);
  }

  const candidate = new Array(n);
  candidate[0] = start;

  let bestRoute = null;
  let bestDistance = Infinity;

  permute(rest, 0, () => {
    for (let i = 0; i < rest.length; i++) {
      candidate[i + 1] = rest[i];
    }

    const distance = routeDistance(candidate, matrix, roundTrip);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestRoute = candidate.slice();
    }
  });

  return { route: bestRoute, distance: bestDistance };
}

/** Visits every permutation of arr[k..] using in-place swaps + backtracking. */
function permute(arr, k, visit) {
  if (k === arr.length - 1) {
    visit();
    return;
  }

  for (let i = k; i < arr.length; i++) {
    swap(arr, k, i);
    permute(arr, k + 1, visit);
    swap(arr, k, i); // backtrack
  }
}

function swap(arr, i, j) {
  const tmp = arr[i];
  arr[i] = arr[j];
  arr[j] = tmp;
}
