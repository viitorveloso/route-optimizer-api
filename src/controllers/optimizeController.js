import { createHash } from 'node:crypto';
import { parseJsonBody } from '../http/parseBody.js';
import { validateOptimizePayload } from '../http/validate.js';
import { sendJson } from '../http/sendJson.js';
import { optimize } from '../core/optimizer.js';
import { optimizeInWorker } from '../infra/runInWorker.js';

/**
 * POST /optimize
 *
 * Flow: parse body -> validate -> cache lookup -> compute -> cache store.
 *
 * Two decisions worth noticing:
 *
 * 1. Cache key = SHA-256 of the canonical payload (only the fields that
 *    affect the result: id, lat, lng, roundTrip). Same stops in the same
 *    order => same hash => instant HIT, skipping the whole computation.
 *
 * 2. Small instances run inline (the computation costs less than spawning
 *    a thread); large ones go to a worker thread so the event loop never
 *    blocks. The threshold is configurable via env.
 */
export function createOptimizeController({ config, cache }) {
  return async function handleOptimize(req, res) {
    const payload = await parseJsonBody(req, { maxBytes: config.maxBodyBytes });

    const { valid, errors } = validateOptimizePayload(payload, {
      maxStops: config.maxStops,
    });

    if (!valid) {
      return sendJson(res, 422, { error: 'Validation failed', details: errors });
    }

    const { stops } = payload;
    const options = { roundTrip: payload.options?.roundTrip ?? false };

    const key = cacheKeyFor(stops, options);
    const cached = cache.get(key);

    if (cached) {
      return sendJson(res, 200, cached, { 'X-Cache': 'HIT' });
    }

    const useWorker = stops.length >= config.workerThreshold;

    const result = useWorker
      ? await optimizeInWorker(stops, options, { timeoutMs: config.workerTimeoutMs })
      : optimize(stops, options);

    result.meta.computedIn = useWorker ? 'worker-thread' : 'event-loop';

    cache.set(key, result);

    return sendJson(res, 200, result, { 'X-Cache': 'MISS' });
  };
}

/**
 * Canonical, deterministic cache key. Extra fields (like "name") are
 * ignored on purpose: they do not change the optimization result.
 */
function cacheKeyFor(stops, options) {
  const canonical = JSON.stringify({
    stops: stops.map((stop) => [stop.id, stop.lat, stop.lng]),
    roundTrip: options.roundTrip,
  });

  return createHash('sha256').update(canonical).digest('hex');
}
