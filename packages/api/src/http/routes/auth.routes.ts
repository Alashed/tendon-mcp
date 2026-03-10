import type { FastifyInstance } from 'fastify';
import { createHash } from 'crypto';
import { z } from 'zod';
import { getContainer } from '../../di/container.js';
import { ConflictError, UnauthorizedError } from '../../shared/errors/AppError.js';
import { authenticate } from '../middleware/auth.js';
import { query } from '../../shared/db/pool.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string; workspace_id: string };
    user: { sub: string; email: string; workspace_id: string };
  }
}

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

const RegisterSchema = z.object({
  email: z.email(),
  name: z.string().min(1),
  password: z.string().min(8),
});

const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const { userRepository, workspaceRepository } = getContainer();

  app.post('/auth/register', async (request, reply) => {
    const body = RegisterSchema.parse(request.body);

    const existing = await userRepository.findByEmail(body.email);
    if (existing) throw new ConflictError('Email already registered');

    const user = await userRepository.create({
      email: body.email,
      name: body.name,
      password_hash: hashPassword(body.password),
    });

    const workspace = await workspaceRepository.createPersonal(user.id, `${body.name}'s workspace`);
    const token = app.jwt.sign({ sub: user.id, email: user.email, workspace_id: workspace.id });

    return reply.status(201).send({ data: { user, workspace, token } });
  });

  app.post('/auth/login', async (request, reply) => {
    const body = LoginSchema.parse(request.body);

    const user = await userRepository.findByEmail(body.email);
    if (!user || user.password_hash !== hashPassword(body.password)) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Get personal workspace
    const workspaces = await workspaceRepository.listForUser(user.id);
    const personal = workspaces.find(w => w.type === 'personal') ?? workspaces[0];

    const token = app.jwt.sign({ sub: user.id, email: user.email, workspace_id: personal?.id ?? '' });
    const { password_hash: _, ...safeUser } = user;
    return reply.send({ data: { user: safeUser, workspaces, token } });
  });

  // Get current user + workspaces (supports both Clerk JWT and legacy JWT)
  app.get('/auth/me', { preHandler: authenticate }, async (request) => {
    const { userRepository, workspaceRepository } = getContainer();
    const user = await userRepository.findById(request.user.sub);
    const workspaces = await workspaceRepository.listForUser(request.user.sub);
    return { data: { user, workspaces } };
  });

  // Check if user has an active Claude Code OAuth token + plan info
  app.get('/auth/claude-status', { preHandler: authenticate }, async (request) => {
    const result = await query<{
      created_at: string;
      expires_at: string;
      workspace_name: string;
      workspace_id: string;
    }>(
      `SELECT t.created_at, t.expires_at, w.name AS workspace_name, w.id AS workspace_id
       FROM oauth_access_tokens t
       JOIN workspaces w ON w.id = t.workspace_id
       WHERE t.user_id = $1
         AND t.revoked = FALSE
         AND t.expires_at > NOW()
       ORDER BY t.created_at DESC
       LIMIT 1`,
      [request.user.sub],
    );

    const token = result.rows[0];

    // Get plan for personal workspace
    const workspaces = await workspaceRepository.listForUser(request.user.sub);
    const personal = workspaces.find(w => w.type === 'personal') ?? workspaces[0];
    const planResult = personal ? await query<{ plan: string }>(
      `SELECT plan FROM subscriptions WHERE workspace_id = $1`,
      [personal.id],
    ) : null;
    const plan = planResult?.rows[0]?.plan ?? 'free';

    return {
      data: {
        connected: !!token,
        workspace_name: token?.workspace_name ?? null,
        connected_at: token?.created_at ?? null,
        expires_at: token?.expires_at ?? null,
        plan,
      },
    };
  });
}
