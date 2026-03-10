import { query } from './db/pool.js';
import { AppError } from './errors/AppError.js';

export const PLAN_LIMITS = {
  free: { max_tasks: 50, history_days: 7, telegram: false, team_members: 1 },
  personal: { max_tasks: Infinity, history_days: Infinity, telegram: true, team_members: 1 },
  team: { max_tasks: Infinity, history_days: Infinity, telegram: true, team_members: 10 },
} as const;

export type Plan = keyof typeof PLAN_LIMITS;

export async function getWorkspacePlan(workspaceId: string): Promise<Plan> {
  const result = await query<{ plan: string }>(
    `SELECT plan FROM subscriptions WHERE workspace_id = $1`,
    [workspaceId],
  );
  const plan = result.rows[0]?.plan ?? 'free';
  return (plan in PLAN_LIMITS ? plan : 'free') as Plan;
}

export async function assertTaskLimit(workspaceId: string): Promise<void> {
  const plan = await getWorkspacePlan(workspaceId);
  const limit = PLAN_LIMITS[plan].max_tasks;
  if (limit === Infinity) return;

  const result = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM tasks
     WHERE workspace_id = $1 AND status != 'archived'`,
    [workspaceId],
  );
  const count = parseInt(result.rows[0]?.count ?? '0', 10);
  if (count >= limit) {
    throw new AppError(402, `Free plan limit reached (${limit} tasks). Upgrade to Pro for unlimited tasks.`, 'LIMIT_EXCEEDED');
  }
}
