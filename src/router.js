import { sendJson } from './http/sendJson.js';

/**
 * Minimal router: exact match on "METHOD /path".
 *
 * This is, in essence, what Express does under the hood for simple routes —
 * made explicit here. Includes a detail many hand-rolled routers skip:
 * if the path exists but the method doesn't, the correct answer is
 * 405 Method Not Allowed with an Allow header, not 404.
 */
export function createRouter() {
  /** @type {Map<string, Function>} */
  const routes = new Map();

  return {
    /**
     * @param {string} method
     * @param {string} path
     * @param {(req, res, url: URL) => Promise<void>|void} handler
     */
    add(method, path, handler) {
      routes.set(`${method.toUpperCase()} ${path}`, handler);
    },

    /**
     * @param {import('node:http').IncomingMessage} req
     * @param {import('node:http').ServerResponse} res
     */
    async handle(req, res) {
      const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
      const handler = routes.get(`${req.method} ${url.pathname}`);

      if (handler) {
        return handler(req, res, url);
      }

      const allowedMethods = [...routes.keys()]
        .filter((key) => key.endsWith(` ${url.pathname}`))
        .map((key) => key.split(' ')[0]);

      if (allowedMethods.length > 0) {
        return sendJson(
          res,
          405,
          { error: `Method ${req.method} not allowed for ${url.pathname}` },
          { Allow: allowedMethods.join(', ') }
        );
      }

      return sendJson(res, 404, { error: `Route ${req.method} ${url.pathname} not found` });
    },
  };
}
