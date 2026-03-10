import { buildApp } from './app.js';
import { config, validateConfig } from './config/index.js';
import { closePool } from './shared/db/pool.js';
import { getContainer } from './di/container.js';

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

  // ── Telegram: register webhook + daily report cron ───────────────────────
  if (config.telegramBotToken) {
    const { telegramService } = getContainer();
    const webhookUrl = `${config.apiBaseUrl}/telegram/webhook`;
    await telegramService.setWebhook(webhookUrl);

    // Check every minute; fire daily reports at the right UTC hour
    let lastCheckedMinute = -1;
    setInterval(async () => {
      const now = new Date();
      const minute = now.getUTCMinutes();
      if (minute === 0 && minute !== lastCheckedMinute) {
        lastCheckedMinute = minute;
        await telegramService.sendDailyReports().catch(console.error);
      }
    }, 60_000);
  }
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
