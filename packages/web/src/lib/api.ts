const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://api.tendon.alashed.kz';

async function apiFetch<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.message ?? data?.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

/* ── Tasks ─────────────────────────────────────────────── */

export interface Task {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  status: 'planned' | 'in_progress' | 'done' | 'archived';
  priority: 'low' | 'medium' | 'high' | null;
  created_at: string;
  source: string;
}

export async function getTasks(workspaceId: string, token: string): Promise<Task[]> {
  const res = await apiFetch<{ data: Task[] }>(
    `/tasks?workspace_id=${encodeURIComponent(workspaceId)}`,
    token
  );
  return res.data;
}

export async function createTask(workspaceId: string, title: string, token: string): Promise<Task> {
  const res = await apiFetch<{ data: Task }>('/tasks', token, {
    method: 'POST',
    body: JSON.stringify({ workspace_id: workspaceId, title, source: 'web' }),
  });
  return res.data;
}

export async function updateTask(
  taskId: string,
  updates: Partial<Pick<Task, 'status' | 'title' | 'priority'>>,
  token: string
): Promise<Task> {
  const res = await apiFetch<{ data: Task }>(`/tasks/${taskId}`, token, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return res.data;
}

export async function deleteTask(taskId: string, token: string): Promise<void> {
  await apiFetch<void>(`/tasks/${taskId}`, token, { method: 'DELETE' });
}

/* ── Activities (Focus Sessions) ───────────────────────── */

export interface Activity {
  id: string;
  workspace_id: string;
  user_id: string;
  task_id: string | null;
  start_time: string;
  end_time: string | null;
  source: string;
}

export async function getActivities(
  workspaceId: string,
  token: string,
  date?: string
): Promise<Activity[]> {
  const d = date ?? new Date().toISOString().split('T')[0];
  const res = await apiFetch<{ data: Activity[] }>(
    `/activities?workspace_id=${encodeURIComponent(workspaceId)}&date=${d}`,
    token
  );
  return res.data;
}

export async function startActivity(
  workspaceId: string,
  token: string,
  taskId?: string
): Promise<Activity> {
  const res = await apiFetch<{ data: Activity }>('/activities/start', token, {
    method: 'POST',
    body: JSON.stringify({ workspace_id: workspaceId, task_id: taskId, source: 'web' }),
  });
  return res.data;
}

export async function stopActivity(
  workspaceId: string,
  token: string,
  activityId?: string
): Promise<Activity | null> {
  const res = await apiFetch<{ data: Activity | null }>('/activities/stop', token, {
    method: 'POST',
    body: JSON.stringify({ workspace_id: workspaceId, activity_id: activityId }),
  });
  return res.data;
}
