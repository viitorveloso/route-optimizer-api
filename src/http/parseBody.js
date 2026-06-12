import { HttpError } from './HttpError.js';

/**
 * Reads and parses a JSON request body, enforcing a size limit.
 *
 * The size check happens chunk by chunk while the body streams in,
 * so an oversized payload is rejected (413) as soon as it crosses the
 * limit — it never gets fully buffered in memory. This is the kind of
 * protection Express's body-parser gives you; here it is explicit.
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {{ maxBytes: number }} options
 * @returns {Promise<unknown>} parsed JSON payload
 */
export function parseJsonBody(req, { maxBytes }) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let received = 0;

    req.on('data', (chunk) => {
      received += chunk.length;

      if (received > maxBytes) {
        reject(new HttpError(413, `Payload too large (limit: ${maxBytes} bytes)`));
        req.destroy();
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => {
      if (received === 0) {
        reject(new HttpError(400, 'Request body is required'));
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'Request body is not valid JSON'));
      }
    });

    req.on('error', (err) => reject(err));
  });
}
