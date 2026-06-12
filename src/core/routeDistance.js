/**
 * Total distance of a route, given a precomputed distance matrix.
 *
 * @param {number[]} route - sequence of point indices
 * @param {number[][]} matrix - distance matrix
 * @param {boolean} [roundTrip=false] - if true, adds the leg back to the start
 * @returns {number} total distance in km
 */
export function routeDistance(route, matrix, roundTrip = false) {
  let total = 0;

  for (let i = 0; i < route.length - 1; i++) {
    total += matrix[route[i]][route[i + 1]];
  }

  if (roundTrip && route.length > 1) {
    total += matrix[route[route.length - 1]][route[0]];
  }

  return total;
}
