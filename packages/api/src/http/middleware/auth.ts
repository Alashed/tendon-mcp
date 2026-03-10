import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAndUpsertClerkUser } from '../../shared/clerk/clerkAuth.js';
import { getContainer } from '../../di/container.js';

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return void reply.status(401).send({ error: 'Unauthorized' });
  }

  const { userRepository, workspaceRepository, oauthService } = getContainer();

  // ── Try Clerk JWT (contains dots) ───────────────────────────────────────
  if (token.includes('.')) {
    try {
      const { user, workspaceId } = await verifyAndUpsertClerkUser(
        token,
        userRepository,
        workspaceRepository,
      );
      request.user = { sub: user.id, email: user.email, workspace_id: workspaceId };
      return;
    } catch (err) {
      request.log.warn({ err: (err as Error).message }, 'Clerk JWT verification failed');
      // fall through to OAuth
    }
  }

  // ── Try OAuth access token (opaque hex token from MCP/Claude flow) ──────
  try {
    const info = await oauthService.introspect(token);
    if (!info.active || !info.sub || !info.workspace_id) {
      return void reply.status(401).send({ error: 'Unauthorized' });
    }
    request.user = { sub: info.sub, email: info.email ?? '', workspace_id: info.workspace_id };
  } catch {
    return void reply.status(401).send({ error: 'Unauthorized' });
  }
}
