import { query } from '../../shared/db/pool.js';
import type { Task, TaskStatus, TaskPriority, TaskSource } from '@alashed/shared';

export interface CreateTaskDTO {
  workspace_id: string;
  project_id?: string;
  assignee_id?: string;
  created_by: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  source?: TaskSource;
  due_date?: string;
}

export interface ListTasksFilter {
  workspace_id: string;
  status?: TaskStatus;
  assignee_id?: string;
  project_id?: string;
}

export class TaskRepository {
  async create(dto: CreateTaskDTO): Promise<Task> {
    const result = await query<Task>(
      `INSERT INTO tasks
        (workspace_id, project_id, assignee_id, created_by, title, description, priority, source, due_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        dto.workspace_id,
        dto.project_id ?? null,
        dto.assignee_id ?? null,
        dto.created_by,
        dto.title,
        dto.description ?? null,
        dto.priority ?? 'medium',
        dto.source ?? 'web',
        dto.due_date ?? null,
      ],
    );
    return result.rows[0]!;
  }

  async findById(id: string): Promise<Task | null> {
    const result = await query<Task>('SELECT * FROM tasks WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }

  async list(filter: ListTasksFilter): Promise<Task[]> {
    const conditions: string[] = ['workspace_id = $1', "status != 'archived'"];
    const params: unknown[] = [filter.workspace_id];

    if (filter.status) {
      params.push(filter.status);
      conditions.push(`status = $${params.length}`);
    }
    if (filter.assignee_id) {
      params.push(filter.assignee_id);
      conditions.push(`assignee_id = $${params.length}`);
    }
    if (filter.project_id) {
      params.push(filter.project_id);
      conditions.push(`project_id = $${params.length}`);
    }

    const result = await query<Task>(
      `SELECT * FROM tasks WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
      params,
    );
    return result.rows;
  }

  async updateStatus(id: string, status: TaskStatus): Promise<Task | null> {
    const result = await query<Task>(
      `UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id],
    );
    return result.rows[0] ?? null;
  }

  async update(id: string, fields: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'due_date' | 'assignee_id' | 'project_id'>>): Promise<Task | null> {
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];

    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) {
        params.push(val);
        sets.push(`${key} = $${params.length}`);
      }
    }

    if (params.length === 0) return this.findById(id);

    params.push(id);
    const result = await query<Task>(
      `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    return result.rows[0] ?? null;
  }

  async archive(id: string): Promise<void> {
    await query(`UPDATE tasks SET status = 'archived', updated_at = NOW() WHERE id = $1`, [id]);
  }
}
