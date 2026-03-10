import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';
import { authenticate } from '../middleware/auth.js';
import { getContainer } from '../../di/container.js';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError.js';
import { query } from '../../shared/db/pool.js';
import { verifyAndUpsertClerkUser } from '../../shared/clerk/clerkAuth.js';

export async function inviteRoutes(app: FastifyInstance): Promise<void> {
  const { workspaceRepository, userRepository } = getContainer();

  // POST /workspaces/:id/invites — create invite link (owner/admin only)
  app.post('/workspaces/:id/invites', { preHandler: authenticate }, async (request, reply) => {
    const { id: workspaceId } = request.params as { id: string };
    const { email, role = 'member' } = (request.body ?? {}) as { email?: string; role?: string };

    const member = await workspaceRepository.getMember(workspaceId, request.user.sub);
    if (!member || !['owner', 'admin'].includes(member.role)) throw new ForbiddenError();

    const code = randomBytes(16).toString('hex');
    await query(
      `INSERT INTO workspace_invites (code, workspace_id, invited_by, email, role)
       VALUES ($1, $2, $3, $4, $5)`,
      [code, workspaceId, request.user.sub, email ?? null, role],
    );

    const workspace = await workspaceRepository.findById(workspaceId);
    return reply.status(201).send({
      data: {
        code,
        invite_url: `${process.env['WEB_BASE_URL'] ?? 'https://tendon.alashed.kz'}/join?invite=${code}`,
        workspace_name: workspace?.name,
        role,
        expires_in: '7 days',
      },
    });
  });

  // GET /invites/:code — get invite info (no auth required, for join page)
  app.get('/invites/:code', async (request, reply) => {
    const { code } = request.params as { code: string };
    const result = await query<{
      workspace_id: string;
      workspace_name: string;
      role: string;
      email: string | null;
      expires_at: string;
      used: boolean;
    }>(
      `SELECT i.workspace_id, w.name AS workspace_name, i.role, i.email, i.expires_at, i.used
       FROM workspace_invites i
       JOIN workspaces w ON w.id = i.workspace_id
       WHERE i.code = $1`,
      [code],
    );
    const invite = result.rows[0];
    if (!invite) throw new NotFoundError('Invite');
    if (invite.used) return reply.status(410).send({ error: 'Invite already used' });
    if (new Date(invite.expires_at) < new Date()) {
      return reply.status(410).send({ error: 'Invite expired' });
    }
    return { data: invite };
  });

  // POST /invites/:code/accept — accept invite (Clerk JWT required)
  app.post('/invites/:code/accept', async (request, reply) => {
    const { code } = request.params as { code: string };

    const authHeader = request.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });

    const { user, workspaceId: _personalWs } = await verifyAndUpsertClerkUser(
      token, userRepository, workspaceRepository,
    );

    // Fetch and validate invite
    const result = await query<{
      id: string; workspace_id: string; role: string; email: string | null;
      expires_at: string; used: boolean;
    }>(
      `SELECT * FROM workspace_invites WHERE code = $1`,
      [code],
    );
    const invite = result.rows[0];
    if (!invite) throw new NotFoundError('Invite');
    if (invite.used) return reply.status(410).send({ error: 'Invite already used' });
    if (new Date(invite.expires_at) < new Date()) {
      return reply.status(410).send({ error: 'Invite expired' });
    }
    if (invite.email && invite.email !== user.email) {
      return reply.status(403).send({ error: 'This invite is for a different email' });
    }

    // Add member + mark invite used
    await workspaceRepository.addMember(invite.workspace_id, user.id, invite.role as any);
    await query(`UPDATE workspace_invites SET used = TRUE WHERE id = $1`, [invite.id]);

    const workspace = await workspaceRepository.findById(invite.workspace_id);
    return reply.status(200).send({
      data: { workspace_id: invite.workspace_id, workspace_name: workspace?.name, role: invite.role },
    });
  });
}
