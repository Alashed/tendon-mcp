import { query } from '../../shared/db/pool.js';
import type { Workspace, WorkspaceMember, WorkspaceRole } from '@alashed/shared';

export class WorkspaceRepository {
  async createPersonal(owner_id: string, name: string): Promise<Workspace> {
    const result = await query<Workspace>(
      `INSERT INTO workspaces (type, owner_id, name)
       VALUES ('personal', $1, $2) RETURNING *`,
      [owner_id, name],
    );
    const workspace = result.rows[0]!;
    // Add owner as member
    await query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [workspace.id, owner_id],
    );
    return workspace;
  }

  async createTeam(owner_id: string, name: string): Promise<Workspace> {
    const result = await query<Workspace>(
      `INSERT INTO workspaces (type, owner_id, name) VALUES ('team', $1, $2) RETURNING *`,
      [owner_id, name],
    );
    const workspace = result.rows[0]!;
    await query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [workspace.id, owner_id],
    );
    return workspace;
  }

  async listForUser(user_id: string): Promise<(Workspace & { role: WorkspaceRole })[]> {
    const result = await query<Workspace & { role: WorkspaceRole }>(
      `SELECT w.*, wm.role FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE wm.user_id = $1
       ORDER BY w.created_at ASC`,
      [user_id],
    );
    return result.rows;
  }

  async findById(id: string): Promise<Workspace | null> {
    const result = await query<Workspace>(`SELECT * FROM workspaces WHERE id = $1`, [id]);
    return result.rows[0] ?? null;
  }

  async getMember(workspace_id: string, user_id: string): Promise<WorkspaceMember | null> {
    const result = await query<WorkspaceMember>(
      `SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspace_id, user_id],
    );
    return result.rows[0] ?? null;
  }

  async addMember(workspace_id: string, user_id: string, role: WorkspaceRole): Promise<WorkspaceMember> {
    const result = await query<WorkspaceMember>(
      `INSERT INTO workspace_members (workspace_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = $3
       RETURNING *`,
      [workspace_id, user_id, role],
    );
    return result.rows[0]!;
  }
}
