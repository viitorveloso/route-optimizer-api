/**
 * Error with an HTTP status code attached, so the central error handler
 * in server.js can map exceptions to proper responses.
 */
export class HttpError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message
   */
  constructor(statusCode, message) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}
