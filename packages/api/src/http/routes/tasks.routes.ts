import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { getContainer } from '../../di/container.js';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError.js';
import { assertTaskLimit } from '../../shared/limits.js';

const CreateTaskSchema = z.object({
  workspace_id: z.string().uuid(),
  project_id: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  due_date: z.string().optional(),
  assignee_id: z.string().uuid().optional(),
  source: z.enum(['claude', 'telegram', 'web', 'agent']).optional(),
});

const UpdateTaskSchema = z.object({
  status: z.enum(['planned', 'in_progress', 'done', 'archived']).optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  due_date: z.string().optional(),
  assignee_id: z.string().uuid().optional(),
});

export async function taskRoutes(app: FastifyInstance): Promise<void> {
  const { taskRepository, workspaceRepository } = getContainer();

  app.get('/tasks', { preHandler: authenticate }, async (request) => {
    const query = request.query as { workspace_id?: string; status?: string; assignee_id?: string };
    const workspace_id = query.workspace_id;
    if (!workspace_id) throw new Error('workspace_id is required');

    const member = await workspaceRepository.getMember(workspace_id, request.user.sub);
    if (!member) throw new ForbiddenError();

    const tasks = await taskRepository.list({
      workspace_id,
      status: query.status as any,
      assignee_id: query.assignee_id,
    });
    return { data: tasks };
  });

  app.get('/tasks/:id', { preHandler: authenticate }, async (request) => {
    const { id } = request.params as { id: string };
    const task = await taskRepository.findById(id);
    if (!task) throw new NotFoundError('Task');
    const member = await workspaceRepository.getMember(task.workspace_id, request.user.sub);
    if (!member) throw new ForbiddenError();
    return { data: task };
  });

  app.post('/tasks', { preHandler: authenticate }, async (request, reply) => {
    const body = CreateTaskSchema.parse(request.body);

    const member = await workspaceRepository.getMember(body.workspace_id, request.user.sub);
    if (!member) throw new ForbiddenError();

    await assertTaskLimit(body.workspace_id);

    const task = await taskRepository.create({
      ...body,
      created_by: request.user.sub,
      source: body.source ?? 'web',
    });
    return reply.status(201).send({ data: task });
  });

  app.patch('/tasks/:id', { preHandler: authenticate }, async (request) => {
    const { id } = request.params as { id: string };
    const body = UpdateTaskSchema.parse(request.body);

    const task = await taskRepository.findById(id);
    if (!task) throw new NotFoundError('Task');

    const member = await workspaceRepository.getMember(task.workspace_id, request.user.sub);
    if (!member) throw new ForbiddenError();

    let updated = task;
    if (body.status) {
      updated = (await taskRepository.updateStatus(id, body.status)) ?? task;
    }
    const { status: _, ...rest } = body;
    if (Object.keys(rest).length > 0) {
      updated = (await taskRepository.update(id, rest)) ?? updated;
    }

    return { data: updated };
  });

  app.delete('/tasks/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const task = await taskRepository.findById(id);
    if (!task) throw new NotFoundError('Task');

    const member = await workspaceRepository.getMember(task.workspace_id, request.user.sub);
    if (!member) throw new ForbiddenError();

    await taskRepository.archive(id);
    return reply.status(204).send();
  });
}
