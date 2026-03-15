import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAndUpsertClerkUser } from '../../shared/clerk/clerkAuth.js';
import { getContainer } from '../../di/container.js';
import { config } from '../../config/index.js';

type AuthUser = { sub: string; email: string; workspace_id: string };

// Detect token type by shape — avoids trying wrong verifier
// Clerk tokens: JWT (3 parts) with header containing "kid" claim
// Fastify JWTs: JWT (3 parts), issued by us
// OAuth tokens: opaque hex string (no dots)
function tokenType(token: string): 'jwt' | 'opaque' {
  return token.includes('.') ? 'jwt' : 'opaque';
}

async function tryClerk(
  token: string,
  request: FastifyRequest,
): Promise<AuthUser | null> {
  if (!config.clerkSecretKey) return null;
  try {
    const { userRepository, workspaceRepository } = getContainer();
    const { user, workspaceId } = await verifyAndUpsertClerkUser(token, userRepository, workspaceRepository);
    return { sub: user.id, email: user.email, workspace_id: workspaceId };
  } catch (err) {
    request.log.debug({ err: (err as Error).message }, 'Clerk JWT verification failed');
    return null;
  }
}

async function tryFastifyJwt(
  token: string,
  request: FastifyRequest,
): Promise<AuthUser | null> {
  try {
    const payload = request.server.jwt.verify<{ sub: string; email: string; workspace_id: string }>(token);
    if (!payload.sub) return null;
    return { sub: payload.sub, email: payload.email ?? '', workspace_id: payload.workspace_id ?? '' };
  } catch {
    return null;
  }
}

async function tryOAuthToken(token: string): Promise<AuthUser | null> {
  try {
    const { oauthService } = getContainer();
    const info = await oauthService.introspect(token);
    if (!info.active || !info.sub || !info.workspace_id) return null;
    return { sub: info.sub, email: info.email ?? '', workspace_id: info.workspace_id };
  } catch {
    return null;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return void reply.status(401).send({ error: 'Unauthorized' });
  }

  let user: AuthUser | null = null;

  if (tokenType(token) === 'jwt') {
    // JWT token — try Clerk first, then our own Fastify JWT
    user = await tryClerk(token, request) ?? await tryFastifyJwt(token, request);
  } else {
    // Opaque token — OAuth access token from MCP/Claude flow
    user = await tryOAuthToken(token);
  }

  if (!user) {
    return void reply.status(401).send({ error: 'Unauthorized' });
  }

  request.user = user;
}
