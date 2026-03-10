'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.tendon.alashed.kz';

interface Workspace {
  id: string;
  name: string;
  type: 'personal' | 'team';
}

function OAuthConsent() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');

  const params = {
    response_type: searchParams.get('response_type') ?? 'code',
    client_id: searchParams.get('client_id') ?? '',
    redirect_uri: searchParams.get('redirect_uri') ?? '',
    code_challenge: searchParams.get('code_challenge') ?? '',
    code_challenge_method: searchParams.get('code_challenge_method') ?? 'S256',
    state: searchParams.get('state') ?? '',
    scope: searchParams.get('scope') ?? '',
  };

  useEffect(() => {
    const load = async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const { data } = await res.json();
        const list: Workspace[] = data.workspaces ?? [];
        setWorkspaces(list);
        const personal = list.find((w) => w.type === 'personal') ?? list[0];
        if (personal) setSelectedWorkspaceId(personal.id);
      } catch { /* ignore */ }
    };
    load();
  }, [getToken]);

  const allow = async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/oauth/consent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...params, workspace_id: selectedWorkspaceId }),
      });

      if (res.ok) {
        const { redirect_url } = await res.json();
        window.location.href = redirect_url;
      } else {
        const err = await res.json();
        setError(err.error ?? 'Authorization failed');
        setLoading(false);
      }
    } catch {
      setError('Network error — please try again');
      setLoading(false);
    }
  };

  const deny = () => {
    if (params.redirect_uri) {
      const url = new URL(params.redirect_uri);
      url.searchParams.set('error', 'access_denied');
      if (params.state) url.searchParams.set('state', params.state);
      window.location.href = url.toString();
    }
  };

  const selectedWs = workspaces.find((w) => w.id === selectedWorkspaceId);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 30%, rgba(59,130,246,0.07) 0%, transparent 65%)',
        }}
      />
      <div className="grid-bg absolute inset-0 opacity-50" />

      <div className="relative card p-8 max-w-sm w-full">
        {/* Icon */}
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{
            background: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.3)',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M13 10V3L4 14h7v7l9-11h-7z"
              stroke="#3B82F6"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="font-display text-xl font-bold mb-1 text-center">
          Connect Claude Code
        </h1>
        <p className="text-sm text-center mb-1" style={{ color: 'var(--muted)' }}>
          Claude Code is requesting access to your Tendon workspace
        </p>
        <p className="text-xs text-center mb-6" style={{ color: 'var(--subtle)' }}>
          as{' '}
          <span style={{ color: 'var(--text)' }}>
            {user?.emailAddresses[0]?.emailAddress}
          </span>
        </p>

        {/* Workspace selector */}
        {workspaces.length > 1 && (
          <div className="mb-5">
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>
              Connect to workspace:
            </p>
            <div className="space-y-1.5">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => setSelectedWorkspaceId(ws.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all text-sm"
                  style={{
                    borderColor:
                      selectedWorkspaceId === ws.id
                        ? 'rgba(59,130,246,0.5)'
                        : 'var(--border)',
                    background:
                      selectedWorkspaceId === ws.id
                        ? 'rgba(59,130,246,0.06)'
                        : 'transparent',
                    color: 'var(--text)',
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      background:
                        selectedWorkspaceId === ws.id ? '#3B82F6' : 'var(--subtle)',
                    }}
                  />
                  <span className="flex-1 truncate">{ws.name}</span>
                  <span
                    className="text-xs shrink-0"
                    style={{ color: 'var(--subtle)' }}
                  >
                    {ws.type}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Permissions */}
        <div
          className="space-y-2 mb-6 p-4 rounded-lg"
          style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.1)' }}
        >
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>
            Claude will be able to
            {selectedWs ? (
              <span style={{ color: 'var(--text)' }}> in &ldquo;{selectedWs.name}&rdquo;</span>
            ) : ''}:
          </p>
          {[
            'View and create tasks',
            'Log focus sessions and time',
            'Read your workspace plan',
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 text-xs">
              <span style={{ color: 'var(--accent)' }}>✓</span>
              <span>{item}</span>
            </div>
          ))}
        </div>

        {error && (
          <div
            className="text-sm mb-4 px-3 py-2.5 rounded-lg"
            style={{
              background: 'rgba(239,68,68,0.08)',
              color: '#FCA5A5',
              border: '1px solid rgba(239,68,68,0.2)',
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={allow}
          disabled={loading || !selectedWorkspaceId}
          className="amber-btn w-full py-3 rounded-lg text-sm mb-2"
        >
          {loading ? 'Authorizing…' : 'Allow access'}
        </button>

        <button
          onClick={deny}
          className="w-full py-2.5 text-sm rounded-lg transition-colors"
          style={{ color: 'var(--muted)' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function OAuthAuthorizePage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: 'var(--bg)', color: 'var(--muted)' }}
        >
          Loading…
        </div>
      }
    >
      <OAuthConsent />
    </Suspense>
  );
}
