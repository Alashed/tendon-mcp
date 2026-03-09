import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { getContainer } from '../../di/container.js';
import { ForbiddenError } from '../../shared/errors/AppError.js';

const StartSchema = z.object({
  workspace_id: z.string().uuid(),
  task_id: z.string().uuid().optional(),
  source: z.enum(['claude', 'agent', 'telegram', 'web']).optional(),
});

const SyncActivityItemSchema = z.object({
  user_id: z.string().uuid(),
  task_id: z.string().uuid().optional(),
  start_time: z.string(),
  end_time: z.string().optional(),
  source: z.enum(['claude', 'agent', 'telegram', 'web']),
  client_id: z.string().optional(),
});

const SyncSchema = z.object({
  workspace_id: z.string().uuid(),
  new_activities: z.array(SyncActivityItemSchema),
  local_task_updates: z.array(z.object({
    id: z.string().uuid(),
    status: z.enum(['planned', 'in_progress', 'done', 'archived']),
  })).default([]),
});

export async function activityRoutes(app: FastifyInstance): Promise<void> {
  const { activityService, workspaceRepository } = getContainer();

  app.post('/activities/start', { preHandler: authenticate }, async (request, reply) => {
    const body = StartSchema.parse(request.body);

    const member = await workspaceRepository.getMember(body.workspace_id, request.user.sub);
    if (!member) throw new ForbiddenError();

    const activity = await activityService.startFocus({
      workspace_id: body.workspace_id,
      user_id: request.user.sub,
      task_id: body.task_id,
      source: body.source ?? 'web',
    });
    return reply.status(201).send({ data: activity });
  });

  app.post('/activities/stop', { preHandler: authenticate }, async (request) => {
    const body = request.body as { workspace_id: string; activity_id?: string };

    const member = await workspaceRepository.getMember(body.workspace_id, request.user.sub);
    if (!member) throw new ForbiddenError();

    const activity = await activityService.stopFocus(body.workspace_id, request.user.sub, body.activity_id);
    return { data: activity };
  });

  app.post('/sync', { preHandler: authenticate }, async (request) => {
    const body = SyncSchema.parse(request.body);

    const member = await workspaceRepository.getMember(body.workspace_id, request.user.sub);
    if (!member) throw new ForbiddenError();

    const result = await activityService.sync(body);
    return { data: result };
  });

  app.get('/activities', { preHandler: authenticate }, async (request) => {
    const qs = request.query as { workspace_id: string; date?: string; user_id?: string };
    const member = await workspaceRepository.getMember(qs.workspace_id, request.user.sub);
    if (!member) throw new ForbiddenError();

    const { activityRepository } = getContainer();
    const activities = await activityRepository.listByDate(
      qs.workspace_id,
      qs.user_id ?? request.user.sub,
      qs.date ?? new Date().toISOString().split('T')[0]!,
    );
    return { data: activities };
  });
}
