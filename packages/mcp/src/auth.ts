const API_URL = process.env['ALASHED_API_URL'] ?? 'http://localhost:3001';

export interface TokenInfo {
  sub: string;
  email: string;
  workspace_id: string;
  scope: string | null;
}

export async function validateBearerToken(token: string): Promise<TokenInfo> {
  const res = await fetch(`${API_URL}/oauth/introspect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  });

  if (!res.ok) throw new Error('Introspection endpoint error');

  const data = await res.json() as {
    active: boolean;
    sub?: string;
    email?: string;
    workspace_id?: string;
    scope?: string;
  };

  if (!data.active || !data.sub || !data.workspace_id) {
    throw new Error('Token inactive or invalid');
  }

  return {
    sub: data.sub,
    email: data.email ?? '',
    workspace_id: data.workspace_id,
    scope: data.scope ?? null,
  };
}
