import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.routes.js';
import { taskRoutes } from './tasks.routes.js';
import { activityRoutes } from './activities.routes.js';
import { workspaceRoutes } from './workspaces.routes.js';
import { oauthRoutes } from './oauth.routes.js';
import { telegramRoutes } from './telegram.routes.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(oauthRoutes);
  await app.register(authRoutes);
  await app.register(taskRoutes);
  await app.register(activityRoutes);
  await app.register(workspaceRoutes);
  await app.register(telegramRoutes);

  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));
}
