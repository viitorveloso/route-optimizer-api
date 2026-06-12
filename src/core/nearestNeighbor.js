/**
 * Nearest Neighbor heuristic — O(n^2).
 *
 * Greedy strategy: always go to the closest unvisited stop.
 * Fast and simple, but short-sighted: it can "paint itself into a corner"
 * and leave a long final leg. That is why the result is refined by 2-opt.
 *
 * @param {number[][]} matrix - distance matrix
 * @param {number} [start=0] - index of the starting point (depot)
 * @returns {number[]} route as a sequence of point indices
 */
export function nearestNeighbor(matrix, start = 0) {
  const n = matrix.length;
  if (n === 0) return [];

  const visited = new Array(n).fill(false);
  const route = [start];
  visited[start] = true;

  let current = start;

  for (let step = 1; step < n; step++) {
    let nearest = -1;
    let nearestDistance = Infinity;

    for (let candidate = 0; candidate < n; candidate++) {
      if (!visited[candidate] && matrix[current][candidate] < nearestDistance) {
        nearestDistance = matrix[current][candidate];
        nearest = candidate;
      }
    }

    route.push(nearest);
    visited[nearest] = true;
    current = nearest;
  }

  return route;
}
