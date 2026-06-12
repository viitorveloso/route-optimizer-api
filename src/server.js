import http from 'node:http';
import { createRouter } from './router.js';
import { sendJson } from './http/sendJson.js';
import { createRateLimiter } from './infra/rateLimiter.js';
import { createLruCache } from './infra/lruCache.js';
import { createOptimizeController } from './controllers/optimizeController.js';

/**
 * App factory: receives config, returns an http.Server (not yet listening).
 *
 * This separation — createApp(config) here, listen() in index.js — is what
 * lets the integration tests boot the full app on a random port with
 * custom config, without spawning processes.
 *
 * Request pipeline:
 *   rate limit -> router -> handler -> central error handler -> access log
 */
export function createApp(config) {
  const cache = createLruCache(config.cache);
  const limiter = createRateLimiter(config.rateLimit);
  const router = createRouter();

  router.add('GET', '/', (req, res) =>
    sendJson(res, 200, {
      name: 'route-optimizer-api',
      description:
        'Delivery route optimization (TSP) using nearest-neighbor + 2-opt. Zero dependencies.',
      endpoints: {
        'GET /health': 'liveness check',
        'POST /optimize': 'optimizes the visiting order of a list of stops',
      },
    })
  );

  router.add('GET', '/health', (req, res) =>
    sendJson(res, 200, { status: 'ok', uptimeSeconds: Math.round(process.uptime()) })
  );

  router.add('POST', '/optimize', createOptimizeController({ config, cache }));

  // Periodically drops idle rate-limit buckets. unref() lets the process
  // exit naturally even with this timer scheduled.
  const pruneTimer = setInterval(() => limiter.prune(), 60_000);
  pruneTimer.unref();

  const server = http.createServer(async (req, res) => {
    const startedAt = performance.now();

    try {
      const clientIp = req.socket.remoteAddress ?? 'unknown';
      const verdict = limiter.tryConsume(clientIp);

      if (!verdict.allowed) {
        sendJson(
          res,
          429,
          { error: 'Too many requests, slow down' },
          { 'Retry-After': String(verdict.retryAfterSeconds) }
        );
        return;
      }

      await router.handle(req, res);
    } catch (err) {
      // Central error handler: HttpError carries its own status code;
      // anything else is an unexpected 500 (logged, but never leaked
      // to the client).
      const statusCode = err.statusCode ?? 500;
      const message = statusCode >= 500 ? 'Internal server error' : err.message;

      if (statusCode >= 500) {
        console.error(err);
      }

      if (!res.headersSent) {
        sendJson(res, statusCode, { error: message });
      } else {
        res.end();
      }
    } finally {
      if (!config.quiet) {
        const elapsed = (performance.now() - startedAt).toFixed(1);
        console.log(`${req.method} ${req.url} -> ${res.statusCode} (${elapsed}ms)`);
      }
    }
  });

  return server;
}
