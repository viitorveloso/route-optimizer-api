import { loadConfig } from './config.js';
import { createApp } from './server.js';

const config = loadConfig();
const server = createApp(config);

server.listen(config.port, () => {
  console.log(`route-optimizer-api listening on http://localhost:${config.port}`);
});

/**
 * Graceful shutdown: on SIGINT/SIGTERM, stop accepting new connections,
 * let in-flight requests finish, then exit. If draining takes more than
 * 5s, force-exit. This is what keeps deploys (systemd restart, Docker
 * stop) from killing requests mid-flight.
 */
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`\n${signal} received, shutting down gracefully...`);

    server.close(() => process.exit(0));

    setTimeout(() => {
      console.error('Forced shutdown after 5s timeout');
      process.exit(1);
    }, 5000).unref();
  });
}
