import { buildApp } from './app.js';
import { config, validateConfig } from './config/index.js';
import { closePool } from './shared/db/pool.js';

async function start(): Promise<void> {
  validateConfig();
  const app = await buildApp();

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      await app.close();
      await closePool();
      process.exit(0);
    });
  });

  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`
  Alashed Tracker API

  Local:  http://localhost:${config.port}
  Docs:   http://localhost:${config.port}/docs
  Health: http://localhost:${config.port}/health
  `);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
