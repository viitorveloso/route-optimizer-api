import { Worker } from 'node:worker_threads';

const workerUrl = new URL('../workers/optimizeWorker.js', import.meta.url);

/**
 * Runs the optimization in a worker thread.
 *
 * Why: Node is single-threaded for JavaScript. A heavy CPU-bound
 * computation (2-opt on hundreds of stops) on the main thread blocks the
 * event loop — and EVERY other request waits, including a trivial
 * GET /health. Moving the computation to a worker keeps the server
 * responsive while it runs.
 *
 * Trade-off (deliberate): one worker per request, simple and isolated.
 * Under sustained heavy traffic, a fixed worker pool would avoid the
 * thread spawn cost (~10ms) per request. Documented in the README.
 *
 * @param {Array<{ id: string|number, lat: number, lng: number }>} stops
 * @param {{ roundTrip?: boolean }} options
 * @param {{ timeoutMs?: number }} [config]
 * @returns {Promise<object>} optimization result
 */
export function optimizeInWorker(stops, options, { timeoutMs = 30_000 } = {}) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerUrl, { workerData: { stops, options } });

    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error(`Optimization timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    worker.once('message', (result) => {
      clearTimeout(timer);
      resolve(result);
    });

    worker.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    worker.once('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Worker exited with code ${code}`));
      }
    });
  });
}
