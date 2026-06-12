/**
 * Manual validation of the /optimize payload.
 *
 * No schema library: every rule is explicit, and every violation produces
 * a human-readable message pointing at the exact field. Returns ALL errors
 * at once instead of failing on the first one, so the client can fix the
 * payload in a single round trip.
 */

/**
 * @param {unknown} payload
 * @param {{ maxStops: number }} limits
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateOptimizePayload(payload, { maxStops }) {
  const errors = [];

  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, errors: ['Body must be a JSON object'] };
  }

  const { stops, options } = /** @type {Record<string, unknown>} */ (payload);

  if (!Array.isArray(stops)) {
    errors.push('"stops" must be an array');
  } else {
    if (stops.length < 1) {
      errors.push('"stops" must contain at least 1 stop');
    }
    if (stops.length > maxStops) {
      errors.push(`"stops" exceeds the limit of ${maxStops} stops (got ${stops.length})`);
    }

    const seenIds = new Set();

    stops.forEach((stop, index) => {
      const path = `stops[${index}]`;

      if (stop === null || typeof stop !== 'object' || Array.isArray(stop)) {
        errors.push(`${path} must be an object`);
        return;
      }

      const { id, lat, lng } = stop;

      if (typeof id !== 'string' && typeof id !== 'number') {
        errors.push(`${path}.id must be a string or a number`);
      } else if (seenIds.has(id)) {
        errors.push(`${path}.id "${id}" is duplicated`);
      } else {
        seenIds.add(id);
      }

      if (!isFiniteNumber(lat)) {
        errors.push(`${path}.lat must be a finite number`);
      } else if (lat < -90 || lat > 90) {
        errors.push(`${path}.lat must be between -90 and 90 (got ${lat})`);
      }

      if (!isFiniteNumber(lng)) {
        errors.push(`${path}.lng must be a finite number`);
      } else if (lng < -180 || lng > 180) {
        errors.push(`${path}.lng must be between -180 and 180 (got ${lng})`);
      }
    });
  }

  if (options !== undefined) {
    if (options === null || typeof options !== 'object' || Array.isArray(options)) {
      errors.push('"options" must be an object when present');
    } else if (
      options.roundTrip !== undefined &&
      typeof options.roundTrip !== 'boolean'
    ) {
      errors.push('"options.roundTrip" must be a boolean when present');
    }
  }

  return { valid: errors.length === 0, errors };
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}
