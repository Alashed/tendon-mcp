import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { getContainer } from '../../di/container.js';
import { ForbiddenError } from '../../shared/errors/AppError.js';
import { query } from '../../shared/db/pool.js';

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  const { workspaceRepository } = getContainer();

  // GET /reports/daily?workspace_id=&date=YYYY-MM-DD&user_id=
  // Returns per-user focus time + task lists (done today, in_progress, planned)
  app.get('/reports/daily', { preHandler: authenticate }, async (request) => {
    const qs = request.query as { workspace_id: string; date?: string; user_id?: string };
    if (!qs.workspace_id) throw new Error('workspace_id required');

    const member = await workspaceRepository.getMember(qs.workspace_id, request.user.sub);
    if (!member) throw new ForbiddenError();

    const date = qs.date ?? new Date().toISOString().split('T')[0]!;
    const filterUserId = qs.user_id ?? null;

    // Per-user focus time + session count
    const timeResult = await query<{
      user_id: string;
      user_name: string;
      focus_minutes: number;
      session_count: number;
    }>(
      `SELECT
         u.id AS user_id,
         COALESCE(u.name, u.email) AS user_name,
         COALESCE(SUM(
           EXTRACT(EPOCH FROM (COALESCE(a.end_time, NOW()) - a.start_time)) / 60
         )::INT, 0) AS focus_minutes,
         COUNT(a.id)::INT AS session_count
       FROM users u
       LEFT JOIN activities a
         ON a.user_id = u.id AND a.workspace_id = $1 AND DATE(a.start_time) = $2::DATE
       WHERE u.id IN (SELECT user_id FROM workspace_members WHERE workspace_id = $1)
         AND ($3::UUID IS NULL OR u.id = $3::UUID)
       GROUP BY u.id, u.name, u.email
       ORDER BY focus_minutes DESC`,
      [qs.workspace_id, date, filterUserId],
    );

    // Per-user task lists
    const taskResult = await query<{
      user_id: string;
      status: string;
      task_id: string;
      title: string;
      priority: string;
    }>(
      `SELECT
         t.created_by AS user_id,
         t.status,
         t.id AS task_id,
         t.title,
         t.priority
       FROM tasks t
       WHERE t.workspace_id = $1
         AND t.status != 'archived'
         AND ($2::UUID IS NULL OR t.created_by = $2::UUID)
       ORDER BY t.updated_at DESC`,
      [qs.workspace_id, filterUserId],
    );

    // Group tasks by user + status
    const tasksByUser: Record<string, {
      done: Array<{ id: string; title: string; priority: string }>;
      in_progress: Array<{ id: string; title: string; priority: string }>;
      planned: Array<{ id: string; title: string; priority: string }>;
    }> = {};

    for (const row of taskResult.rows) {
      if (!tasksByUser[row.user_id]) {
        tasksByUser[row.user_id] = { done: [], in_progress: [], planned: [] };
      }
      const entry = { id: row.task_id, title: row.title, priority: row.priority };
      // Only include "done today" in done list, not all-time done
      if (row.status === 'done') {
        // We'll post-filter below
        tasksByUser[row.user_id].done.push(entry);
      } else if (row.status === 'in_progress') {
        tasksByUser[row.user_id].in_progress.push(entry);
      } else if (row.status === 'planned') {
        tasksByUser[row.user_id].planned.push(entry);
      }
    }

    // Done-today filter (tasks marked done on this date)
    const doneTodayResult = await query<{ user_id: string; task_id: string; title: string; priority: string }>(
      `SELECT created_by AS user_id, id AS task_id, title, priority
       FROM tasks
       WHERE workspace_id = $1 AND status = 'done' AND DATE(updated_at) = $2::DATE
         AND ($3::UUID IS NULL OR created_by = $3::UUID)`,
      [qs.workspace_id, date, filterUserId],
    );

    const doneTodayByUser: Record<string, Array<{ id: string; title: string; priority: string }>> = {};
    for (const row of doneTodayResult.rows) {
      (doneTodayByUser[row.user_id] ??= []).push({ id: row.task_id, title: row.title, priority: row.priority });
    }

    // Merge
    const users = timeResult.rows.map((u) => ({
      user_id: u.user_id,
      user_name: u.user_name,
      focus_minutes: u.focus_minutes,
      session_count: u.session_count,
      tasks_done_today: doneTodayByUser[u.user_id] ?? [],
      tasks_in_progress: tasksByUser[u.user_id]?.in_progress ?? [],
      tasks_planned: tasksByUser[u.user_id]?.planned ?? [],
    }));

    const workspaceTotals = {
      total_focus_minutes: users.reduce((s, u) => s + u.focus_minutes, 0),
      total_done_today: users.reduce((s, u) => s + u.tasks_done_today.length, 0),
      total_in_progress: users.reduce((s, u) => s + u.tasks_in_progress.length, 0),
    };

    return { data: { date, workspace_id: qs.workspace_id, users, totals: workspaceTotals } };
  });
}
