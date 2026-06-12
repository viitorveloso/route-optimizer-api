/**
 * 2-opt local search — O(n^2) per pass.
 *
 * Repeatedly looks for two edges that "cross" and uncrosses them by
 * reversing the segment between them. Each swap is evaluated in O(1)
 * by comparing only the two removed edges vs the two added edges,
 * instead of recomputing the whole route distance.
 *
 * Keeps passing over the route until no improving move exists
 * (local optimum) or maxPasses is reached.
 */

const EPSILON = 1e-9;

/**
 * @param {number[]} route - initial route (e.g. from nearest neighbor)
 * @param {number[][]} matrix - distance matrix
 * @param {{ roundTrip?: boolean, maxPasses?: number }} [options]
 * @returns {number[]} improved route (new array; input is not mutated)
 */
export function twoOpt(route, matrix, { roundTrip = false, maxPasses = 100 } = {}) {
  const best = route.slice();
  const n = best.length;
  if (n < 3) return best;

  let improved = true;
  let passes = 0;

  while (improved && passes < maxPasses) {
    improved = false;
    passes++;

    // i starts at 1: the first stop is the depot and stays fixed.
    for (let i = 1; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = best[i - 1];
        const b = best[i];
        const c = best[j];

        // In an open route the last stop has no outgoing edge;
        // in a round trip it connects back to the depot.
        const hasNext = j < n - 1 || roundTrip;
        const d = hasNext ? best[(j + 1) % n] : null;

        const removed = matrix[a][b] + (hasNext ? matrix[c][d] : 0);
        const added = matrix[a][c] + (hasNext ? matrix[b][d] : 0);

        // EPSILON avoids infinite loops caused by floating point noise.
        if (added < removed - EPSILON) {
          reverseSegment(best, i, j);
          improved = true;
        }
      }
    }
  }

  return best;
}

/** Reverses arr[i..j] in place. */
function reverseSegment(arr, i, j) {
  while (i < j) {
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
    i++;
    j--;
  }
}
