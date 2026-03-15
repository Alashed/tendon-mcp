import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { getContainer } from '../../di/container.js';
import { ForbiddenError } from '../../shared/errors/AppError.js';
import { query } from '../../shared/db/pool.js';

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  const { workspaceRepository } = getContainer();

  // GET /projects?workspace_id=
  app.get('/projects', { preHandler: authenticate }, async (request) => {
    const qs = request.query as { workspace_id: string };
    if (!qs.workspace_id) throw new Error('workspace_id required');
    const member = await workspaceRepository.getMember(qs.workspace_id, request.user.sub);
    if (!member) throw new ForbiddenError();
    const result = await query(
      `SELECT * FROM projects WHERE workspace_id = $1 AND status = 'active' ORDER BY name ASC`,
      [qs.workspace_id],
    );
    return { data: result.rows };
  });

  // POST /projects — find or create by name
  app.post('/projects', { preHandler: authenticate }, async (request, reply) => {
    const { workspace_id, name } = request.body as { workspace_id: string; name: string };
    if (!workspace_id || !name) throw new Error('workspace_id and name required');
    const member = await workspaceRepository.getMember(workspace_id, request.user.sub);
    if (!member) throw new ForbiddenError();
    // Find or create
    const existing = await query(
      `SELECT * FROM projects WHERE workspace_id = $1 AND LOWER(name) = LOWER($2) AND status = 'active' LIMIT 1`,
      [workspace_id, name],
    );
    if (existing.rows.length > 0) {
      return { data: existing.rows[0] };
    }
    const result = await query(
      `INSERT INTO projects (workspace_id, name) VALUES ($1, $2) RETURNING *`,
      [workspace_id, name],
    );
    return reply.status(201).send({ data: result.rows[0] });
  });
}
