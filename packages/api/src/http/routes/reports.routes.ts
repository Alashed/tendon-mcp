import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { getContainer } from '../../di/container.js';
import { ForbiddenError } from '../../shared/errors/AppError.js';
import { query } from '../../shared/db/pool.js';

export interface UserDaySummary {
  user_id: string;
  user_name: string;
  focus_minutes: number;
  session_count: number;
  tasks_done: number;
  tasks_in_progress: number;
  tasks_planned: number;
}

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  const { workspaceRepository } = getContainer();

  // GET /reports/daily?workspace_id=&date=YYYY-MM-DD&user_id=
  app.get('/reports/daily', { preHandler: authenticate }, async (request) => {
    const qs = request.query as { workspace_id: string; date?: string; user_id?: string };
    if (!qs.workspace_id) throw new Error('workspace_id required');

    const member = await workspaceRepository.getMember(qs.workspace_id, request.user.sub);
    if (!member) throw new ForbiddenError();

    const date = qs.date ?? new Date().toISOString().split('T')[0]!;
    const filterUserId = qs.user_id ?? null; // null = all users in workspace

    const result = await query<UserDaySummary>(
      `SELECT
         u.id AS user_id,
         COALESCE(u.name, u.email) AS user_name,
         COALESCE(SUM(
           EXTRACT(EPOCH FROM (COALESCE(a.end_time, NOW()) - a.start_time)) / 60
         )::INT, 0) AS focus_minutes,
         COUNT(a.id)::INT AS session_count,
         COALESCE(
           (SELECT COUNT(*) FROM tasks td
            WHERE td.workspace_id = $1 AND td.created_by = u.id
              AND td.status = 'done' AND DATE(td.updated_at) = $2::DATE), 0
         )::INT AS tasks_done,
         COALESCE(
           (SELECT COUNT(*) FROM tasks ti
            WHERE ti.workspace_id = $1 AND ti.created_by = u.id
              AND ti.status = 'in_progress'), 0
         )::INT AS tasks_in_progress,
         COALESCE(
           (SELECT COUNT(*) FROM tasks tp
            WHERE tp.workspace_id = $1 AND tp.created_by = u.id
              AND tp.status = 'planned'), 0
         )::INT AS tasks_planned
       FROM users u
       LEFT JOIN activities a
         ON a.user_id = u.id AND a.workspace_id = $1 AND DATE(a.start_time) = $2::DATE
       WHERE u.id IN (
         SELECT user_id FROM workspace_members WHERE workspace_id = $1
       )
       AND ($3::UUID IS NULL OR u.id = $3::UUID)
       GROUP BY u.id, u.name, u.email
       ORDER BY focus_minutes DESC`,
      [qs.workspace_id, date, filterUserId],
    );

    const taskSummary = await query<{ total: number; done_today: number; in_progress: number }>(
      `SELECT
         COUNT(*) FILTER (WHERE status != 'archived')::INT AS total,
         COUNT(*) FILTER (WHERE status = 'done' AND DATE(updated_at) = $2::DATE)::INT AS done_today,
         COUNT(*) FILTER (WHERE status = 'in_progress')::INT AS in_progress
       FROM tasks WHERE workspace_id = $1`,
      [qs.workspace_id, date],
    );

    return {
      data: {
        date,
        workspace_id: qs.workspace_id,
        users: result.rows,
        tasks: taskSummary.rows[0] ?? { total: 0, done_today: 0, in_progress: 0 },
      },
    };
  });
}
