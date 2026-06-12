import { parentPort, workerData } from 'node:worker_threads';
import { optimize } from '../core/optimizer.js';

/**
 * Worker thread entry point.
 *
 * Receives { stops, options } via workerData, runs the pure optimization
 * pipeline and posts the result back. Because optimize() has no I/O and
 * no shared state, it runs in a worker with zero changes.
 */
const { stops, options } = workerData;

parentPort.postMessage(optimize(stops, options));
