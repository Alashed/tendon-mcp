import { query } from '../../shared/db/pool.js';
import type { Activity, ActivitySource } from '@alashed/shared';

export interface StartActivityDTO {
  workspace_id: string;
  user_id: string;
  task_id?: string;
  source?: ActivitySource;
  client_id?: string;
  start_time?: string;
}

export class ActivityRepository {
  async findOngoing(workspace_id: string, user_id: string): Promise<Activity | null> {
    const result = await query<Activity>(
      `SELECT * FROM activities WHERE workspace_id = $1 AND user_id = $2 AND end_time IS NULL LIMIT 1`,
      [workspace_id, user_id],
    );
    return result.rows[0] ?? null;
  }

  async start(dto: StartActivityDTO): Promise<Activity> {
    const result = await query<Activity>(
      `INSERT INTO activities (workspace_id, task_id, user_id, start_time, source, client_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        dto.workspace_id,
        dto.task_id ?? null,
        dto.user_id,
        dto.start_time ?? new Date().toISOString(),
        dto.source ?? 'web',
        dto.client_id ?? null,
      ],
    );
    return result.rows[0]!;
  }

  async stop(id: string, end_time?: string): Promise<Activity | null> {
    const result = await query<Activity>(
      `UPDATE activities SET end_time = $1 WHERE id = $2 RETURNING *`,
      [end_time ?? new Date().toISOString(), id],
    );
    return result.rows[0] ?? null;
  }

  async stopOngoing(workspace_id: string, user_id: string): Promise<Activity | null> {
    const result = await query<Activity>(
      `UPDATE activities SET end_time = NOW()
       WHERE workspace_id = $1 AND user_id = $2 AND end_time IS NULL
       RETURNING *`,
      [workspace_id, user_id],
    );
    return result.rows[0] ?? null;
  }

  async listByDate(workspace_id: string, user_id: string, date: string): Promise<Activity[]> {
    const result = await query<Activity>(
      `SELECT * FROM activities
       WHERE workspace_id = $1 AND user_id = $2
         AND start_time::date = $3::date
       ORDER BY start_time ASC`,
      [workspace_id, user_id, date],
    );
    return result.rows;
  }

  async findByClientId(client_id: string): Promise<Activity | null> {
    const result = await query<Activity>(
      `SELECT * FROM activities WHERE client_id = $1 LIMIT 1`,
      [client_id],
    );
    return result.rows[0] ?? null;
  }
}
