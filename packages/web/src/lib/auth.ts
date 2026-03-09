export interface AuthData {
  token: string;
  workspaceId: string;
  user: { id: string; name?: string; email: string };
}

export function setAuth(token: string, user: AuthData['user'], workspaceId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('alashed_token', token);
  localStorage.setItem('alashed_user', JSON.stringify(user));
  localStorage.setItem('alashed_workspace_id', workspaceId);
  // Set a cookie so the middleware can check auth on the server side
  document.cookie = `alashed_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
}

export function getAuth(): AuthData | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('alashed_token');
  const userStr = localStorage.getItem('alashed_user');
  const workspaceId = localStorage.getItem('alashed_workspace_id') ?? '';
  if (!token || !userStr) return null;
  try {
    const user = JSON.parse(userStr);
    return { token, workspaceId, user };
  } catch {
    return null;
  }
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('alashed_token');
  localStorage.removeItem('alashed_user');
  localStorage.removeItem('alashed_workspace_id');
  document.cookie = 'alashed_token=; path=/; max-age=0; SameSite=Lax';
}
