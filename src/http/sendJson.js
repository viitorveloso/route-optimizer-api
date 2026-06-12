/**
 * Serializes data as JSON and finishes the response with correct headers.
 *
 * @param {import('node:http').ServerResponse} res
 * @param {number} statusCode
 * @param {unknown} data
 * @param {Record<string, string>} [headers]
 */
export function sendJson(res, statusCode, data, headers = {}) {
  const body = JSON.stringify(data);

  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...headers,
  });

  res.end(body);
}
