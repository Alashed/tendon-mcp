import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { getContainer } from '../../di/container.js';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError.js';

const CreateWorkspaceSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['personal', 'team']),
});

export async function workspaceRoutes(app: FastifyInstance): Promise<void> {
  const { workspaceRepository } = getContainer();

  app.get('/workspaces', { preHandler: authenticate }, async (request) => {
    const workspaces = await workspaceRepository.listForUser(request.user.sub);
    return { data: workspaces };
  });

  app.post('/workspaces', { preHandler: authenticate }, async (request, reply) => {
    const body = CreateWorkspaceSchema.parse(request.body);
    const workspace = body.type === 'team'
      ? await workspaceRepository.createTeam(request.user.sub, body.name)
      : await workspaceRepository.createPersonal(request.user.sub, body.name);
    return reply.status(201).send({ data: workspace });
  });

  app.get('/workspaces/:id', { preHandler: authenticate }, async (request) => {
    const { id } = request.params as { id: string };
    const workspace = await workspaceRepository.findById(id);
    if (!workspace) throw new NotFoundError('Workspace');

    const member = await workspaceRepository.getMember(id, request.user.sub);
    if (!member) throw new ForbiddenError();

    return { data: workspace };
  });

  app.post('/workspaces/:id/members', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      user_id: z.string().uuid(),
      role: z.enum(['admin', 'member', 'guest']),
    }).parse(request.body);

    const member = await workspaceRepository.getMember(id, request.user.sub);
    if (!member || !['owner', 'admin'].includes(member.role)) throw new ForbiddenError();

    const added = await workspaceRepository.addMember(id, body.user_id, body.role);
    return reply.status(201).send({ data: added });
  });
}
