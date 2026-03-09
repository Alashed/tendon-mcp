const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://api.tracker.alashed.kz';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('alashed_token');
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      data?.message ?? data?.error ?? `Request failed (${res.status})`
    );
  }
  return data as T;
}

/* ── Auth ──────────────────────────────────────────────── */

export interface RegisterResult {
  user: { id: string; email: string; name: string };
  workspace: { id: string; name: string; type: string };
  token: string;
}

export async function register(
  name: string,
  email: string,
  password: string
): Promise<RegisterResult> {
  const res = await apiFetch<{ data: RegisterResult }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  return res.data;
}

export interface LoginResult {
  user: { id: string; email: string; name: string };
  workspace: { id: string; name: string; type: string };
  token: string;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await apiFetch<{
    data: { user: LoginResult['user']; workspaces: LoginResult['workspace'][]; token: string };
  }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const personal =
    res.data.workspaces.find((w) => w.type === 'personal') ?? res.data.workspaces[0];
  return { user: res.data.user, workspace: personal, token: res.data.token };
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

export async function getTasks(workspaceId: string): Promise<Task[]> {
  const res = await apiFetch<{ data: Task[] }>(
    `/tasks?workspace_id=${encodeURIComponent(workspaceId)}`
  );
  return res.data;
}

export async function createTask(workspaceId: string, title: string): Promise<Task> {
  const res = await apiFetch<{ data: Task }>('/tasks', {
    method: 'POST',
    body: JSON.stringify({ workspace_id: workspaceId, title, source: 'web' }),
  });
  return res.data;
}

export async function updateTask(taskId: string, updates: Partial<Pick<Task, 'status' | 'title' | 'priority'>>): Promise<Task> {
  const res = await apiFetch<{ data: Task }>(`/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return res.data;
}

export async function deleteTask(taskId: string): Promise<void> {
  await apiFetch<void>(`/tasks/${taskId}`, { method: 'DELETE' });
}
