import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAndUpsertClerkUser } from '../../shared/clerk/clerkAuth.js';
import { getContainer } from '../../di/container.js';

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return void reply.status(401).send({ error: 'Unauthorized' });
  }

  try {
    const { userRepository, workspaceRepository } = getContainer();
    const { user, workspaceId } = await verifyAndUpsertClerkUser(
      token,
      userRepository,
      workspaceRepository,
    );

    // Set request.user for downstream route handlers
    request.user = { sub: user.id, email: user.email, workspace_id: workspaceId };
  } catch {
    return void reply.status(401).send({ error: 'Unauthorized' });
  }
}
