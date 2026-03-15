import { randomBytes } from 'crypto';
import { query } from '../../shared/db/pool.js';

export interface TelegramChat {
  id: string;
  chat_id: bigint;
  thread_id: bigint | null;
  workspace_id: string;
  label: string | null;
  report_hour: number;
  reports_on: boolean;
  last_report_date: string | null;
  created_at: string;
}

export interface TelegramLinkCode {
  id: string;
  code: string;
  chat_id: bigint;
  thread_id: bigint | null;
  expires_at: string;
  used: boolean;
}

export interface DailyStats {
  user_id: string;
  user_name: string;
  total_minutes: number;
  session_count: number;
  tasks_done: number;
  tasks_in_progress: number;
}

export class TelegramRepository {
  // ── Link codes ───────────────────────────────────────────────────────────

  async createLinkCode(chatId: number, threadId?: number): Promise<string> {
    const code = randomBytes(16).toString('hex');
    await query(
      `INSERT INTO telegram_link_codes (code, chat_id, thread_id)
       VALUES ($1, $2, $3)`,
      [code, chatId, threadId ?? null],
    );
    return code;
  }

  async consumeLinkCode(code: string): Promise<{ chat_id: bigint; thread_id: bigint | null } | null> {
    const result = await query<TelegramLinkCode>(
      `UPDATE telegram_link_codes
       SET used = TRUE
       WHERE code = $1 AND used = FALSE AND expires_at > NOW()
       RETURNING *`,
      [code],
    );
    const row = result.rows[0];
    if (!row) return null;
    return { chat_id: row.chat_id, thread_id: row.thread_id };
  }

  // ── Linked chats ─────────────────────────────────────────────────────────

  async linkChat(
    chatId: number | bigint,
    threadId: number | bigint | null,
    workspaceId: string,
    label?: string,
  ): Promise<void> {
    await query(
      `INSERT INTO telegram_chats (chat_id, thread_id, workspace_id, label)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (chat_id, COALESCE(thread_id, 0))
       DO UPDATE SET workspace_id = EXCLUDED.workspace_id, label = EXCLUDED.label`,
      [chatId, threadId, workspaceId, label ?? null],
    );
  }

  async findChatsByWorkspace(workspaceId: string): Promise<TelegramChat[]> {
    const result = await query<TelegramChat>(
      `SELECT * FROM telegram_chats WHERE workspace_id = $1`,
      [workspaceId],
    );
    return result.rows;
  }

  async findWorkspaceByChatId(chatId: number): Promise<string | null> {
    const result = await query<{ workspace_id: string }>(
      `SELECT workspace_id FROM telegram_chats WHERE chat_id = $1 LIMIT 1`,
      [chatId],
    );
    return result.rows[0]?.workspace_id ?? null;
  }

  async findChatsForReport(hour: number): Promise<TelegramChat[]> {
    const today = new Date().toISOString().split('T')[0];
    const result = await query<TelegramChat>(
      `SELECT * FROM telegram_chats
       WHERE reports_on = TRUE
         AND report_hour = $1
         AND (last_report_date IS NULL OR last_report_date < $2)`,
      [hour, today],
    );
    return result.rows;
  }

  async markReportSent(chatId: bigint | number, date: string): Promise<void> {
    await query(
      `UPDATE telegram_chats SET last_report_date = $1
       WHERE chat_id = $2`,
      [date, chatId],
    );
  }

  // ── Stats for daily report ───────────────────────────────────────────────

  async getDailyStats(workspaceId: string, date: string): Promise<DailyStats[]> {
    const result = await query<DailyStats>(
      `SELECT
         u.id AS user_id,
         COALESCE(u.name, u.email) AS user_name,
         COALESCE(SUM(
           EXTRACT(EPOCH FROM (COALESCE(a.end_time, NOW()) - a.start_time)) / 60
         )::INT, 0) AS total_minutes,
         COUNT(a.id)::INT AS session_count,
         COALESCE(
           (SELECT COUNT(*) FROM tasks t2
            WHERE t2.workspace_id = $1
              AND t2.created_by = u.id
              AND t2.status = 'done'
              AND DATE(t2.updated_at) = $2::DATE
           ), 0
         )::INT AS tasks_done,
         COALESCE(
           (SELECT COUNT(*) FROM tasks t3
            WHERE t3.workspace_id = $1
              AND t3.created_by = u.id
              AND t3.status = 'in_progress'
           ), 0
         )::INT AS tasks_in_progress
       FROM users u
       LEFT JOIN activities a
         ON a.user_id = u.id
         AND a.workspace_id = $1
         AND DATE(a.start_time) = $2::DATE
       WHERE u.id IN (
         SELECT user_id FROM workspace_members WHERE workspace_id = $1
       )
       GROUP BY u.id, u.name, u.email
       HAVING SUM(EXTRACT(EPOCH FROM (COALESCE(a.end_time, NOW()) - a.start_time))) > 0
          OR EXISTS (
            SELECT 1 FROM tasks t4
            WHERE t4.workspace_id = $1 AND t4.created_by = u.id
          )
       ORDER BY total_minutes DESC`,
      [workspaceId, date],
    );
    return result.rows;
  }

  async getWeekStats(workspaceId: string): Promise<Array<{ date: string; total_minutes: number; done_count: number }>> {
    const result = await query<{ date: string; total_minutes: number; done_count: number }>(
      `SELECT
         DATE(a.start_time)::TEXT AS date,
         COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(a.end_time, NOW()) - a.start_time)) / 60)::INT, 0) AS total_minutes,
         COALESCE((
           SELECT COUNT(*) FROM tasks t
           WHERE t.workspace_id = $1
             AND t.status = 'done'
             AND DATE(t.updated_at) = DATE(a.start_time)
         ), 0)::INT AS done_count
       FROM activities a
       WHERE a.workspace_id = $1
         AND a.start_time >= NOW() - INTERVAL '7 days'
       GROUP BY DATE(a.start_time)
       ORDER BY date DESC`,
      [workspaceId],
    );
    return result.rows;
  }

  async getPlannedTasks(workspaceId: string): Promise<Array<{ title: string; priority: string }>> {
    const result = await query<{ title: string; priority: string }>(
      `SELECT title, priority FROM tasks
       WHERE workspace_id = $1 AND status = 'planned'
       ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, created_at
       LIMIT 10`,
      [workspaceId],
    );
    return result.rows;
  }

  async getActiveSession(workspaceId: string): Promise<{ user_name: string; task_title: string | null; since: string } | null> {
    const result = await query<{ user_name: string; task_title: string | null; since: string }>(
      `SELECT
         COALESCE(u.name, u.email) AS user_name,
         t.title AS task_title,
         a.start_time::TEXT AS since
       FROM activities a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN tasks t ON t.id = a.task_id
       WHERE a.workspace_id = $1 AND a.end_time IS NULL
       ORDER BY a.start_time DESC
       LIMIT 1`,
      [workspaceId],
    );
    return result.rows[0] ?? null;
  }

  async getTaskSummary(workspaceId: string): Promise<{ total: number; in_progress: number; done_today: number }> {
    const today = new Date().toISOString().split('T')[0];
    const result = await query<{ total: number; in_progress: number; done_today: number }>(
      `SELECT
         COUNT(*) FILTER (WHERE status != 'archived')::INT AS total,
         COUNT(*) FILTER (WHERE status = 'in_progress')::INT AS in_progress,
         COUNT(*) FILTER (WHERE status = 'done' AND DATE(updated_at) = $2::DATE)::INT AS done_today
       FROM tasks WHERE workspace_id = $1`,
      [workspaceId, today],
    );
    return result.rows[0] ?? { total: 0, in_progress: 0, done_today: 0 };
  }
}
