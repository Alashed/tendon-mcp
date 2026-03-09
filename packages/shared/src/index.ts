// Workspace
export type WorkspaceType = 'personal' | 'team';
export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'guest';

export interface Workspace {
  id: string;
  type: WorkspaceType;
  owner_id: string;
  name: string;
  timezone: string;
  created_at: string;
}

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  joined_at: string;
}

// User
export interface User {
  id: string;
  email: string;
  name: string;
  telegram_id?: string;
  created_at: string;
}

// Project
export type ProjectStatus = 'active' | 'archived';

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  status: ProjectStatus;
  created_at: string;
}

// Task
export type TaskStatus = 'planned' | 'in_progress' | 'done' | 'archived';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskSource = 'claude' | 'telegram' | 'web' | 'agent';

export interface Task {
  id: string;
  workspace_id: string;
  project_id?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id?: string;
  created_by: string;
  source: TaskSource;
  due_date?: string;
  created_at: string;
  updated_at: string;
}

// Activity (time entry)
export type ActivitySource = 'claude' | 'agent' | 'telegram' | 'web';

export interface Activity {
  id: string;
  workspace_id: string;
  task_id?: string;
  user_id: string;
  start_time: string;
  end_time?: string;
  source: ActivitySource;
  client_id?: string; // для offline sync
  created_at: string;
}

// Standup
export interface Standup {
  id: string;
  workspace_id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  yesterday?: string;
  today?: string;
  blockers?: string;
  source: 'telegram' | 'web' | 'claude';
  created_at: string;
}

// Daily Plan
export interface DailyPlanItem {
  task_id?: string;
  title: string;
  estimated_minutes?: number;
}

export interface DailyPlan {
  id: string;
  workspace_id: string;
  user_id: string;
  date: string;
  items: DailyPlanItem[];
  notes?: string;
  created_at: string;
}

// Report
export type ReportType = 'daily' | 'weekly';

export interface DailyReportPayload {
  date: string;
  members: {
    user_id: string;
    name: string;
    planned: string[];
    done: string[];
    in_progress: string[];
    total_minutes: number;
    blockers?: string;
  }[];
  summary: string;
  next_day_plan?: string[];
}

export interface Report {
  id: string;
  workspace_id: string;
  type: ReportType;
  date: string;
  payload: DailyReportPayload;
  generated_at: string;
}

// Sync (agent)
export interface SyncActivityItem {
  user_id: string;
  task_id?: string;
  start_time: string;
  end_time?: string;
  source: ActivitySource;
  client_id?: string;
}

export interface SyncRequest {
  workspace_id: string;
  new_activities: SyncActivityItem[];
  local_task_updates: Array<{ id: string; status: TaskStatus }>;
}

export interface SyncResponse {
  activity_id_map: Record<string, string>; // client_id -> server_id
  task_updates_applied: number;
}

// API responses
export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: string;
  details?: unknown;
}
