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
    try {
      if (params.redirect_uri) {
        const url = new URL(params.redirect_uri);
        url.searchParams.set('error', 'access_denied');
        if (params.state) url.searchParams.set('state', params.state);
        window.location.href = url.toString();
      }
    } catch {
      window.location.href = '/';
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
            'radial-gradient(ellipse at 50% 30%, rgba(99,102,241,0.07) 0%, transparent 65%)',
        }}
      />
      <div className="grid-bg absolute inset-0 opacity-40" />

      <div className="relative card-elev p-8 max-w-md w-full">
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(139,92,246,0.18) 100%)',
              border: '1px solid rgba(99,102,241,0.3)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M13 10V3L4 14h7v7l9-11h-7z"
                stroke="var(--accent-light)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="eyebrow mb-0.5">OAuth · authorize</p>
            <h1 className="heading text-lg font-semibold" style={{ letterSpacing: '-0.02em' }}>
              Connect Claude Code
            </h1>
          </div>
        </div>

        <p className="text-sm mb-1" style={{ color: 'var(--text-soft)' }}>
          <span className="font-semibold" style={{ color: 'var(--text)' }}>Claude Code</span> is requesting
          access to your Tendon workspace.
        </p>
        <p className="text-xs mb-6" style={{ color: 'var(--muted)' }}>
          Signed in as{' '}
          <span className="font-mono" style={{ color: 'var(--text-soft)' }}>
            {user?.emailAddresses[0]?.emailAddress}
          </span>
        </p>

        {/* Workspace selector */}
        {workspaces.length > 1 && (
          <div className="mb-5">
            <p className="eyebrow mb-2.5">Connect to workspace</p>
            <div className="space-y-1.5">
              {workspaces.map((ws) => {
                const active = selectedWorkspaceId === ws.id;
                const isTeam = ws.type === 'team';
                return (
                  <button
                    key={ws.id}
                    onClick={() => setSelectedWorkspaceId(ws.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all text-sm"
                    style={{
                      borderColor: active ? 'rgba(99,102,241,0.5)' : 'var(--border)',
                      background: active ? 'rgba(99,102,241,0.06)' : 'transparent',
                      color: 'var(--text)',
                    }}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-display font-semibold"
                      style={{
                        background: isTeam
                          ? 'linear-gradient(135deg, #eab308 0%, #f59e0b 100%)'
                          : 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)',
                        color: '#fff',
                      }}
                    >
                      {ws.name[0]?.toUpperCase()}
                    </div>
                    <span className="flex-1 truncate">{ws.name}</span>
                    <span
                      className="badge shrink-0 capitalize"
                      style={{
                        fontSize: 10,
                        color: isTeam ? '#fcd34d' : 'var(--accent-light)',
                        borderColor: isTeam ? 'rgba(234,179,8,0.28)' : 'rgba(99,102,241,0.25)',
                        background: isTeam ? 'rgba(234,179,8,0.06)' : 'rgba(99,102,241,0.05)',
                      }}
                    >
                      {ws.type}
                    </span>
                    {active && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
                        <path d="M5 12l4.5 4.5L19 7" stroke="var(--accent-light)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Permissions */}
        <div
          className="p-4 rounded-lg mb-6"
          style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.15)' }}
        >
          <p className="eyebrow mb-3">
            Permissions{selectedWs ? ` · in “${selectedWs.name}”` : ''}
          </p>
          <div className="space-y-2.5">
            {[
              { label: 'View and create tasks', scope: 'tasks:read tasks:write' },
              { label: 'Log focus sessions and time', scope: 'sessions:write' },
              { label: 'Read your workspace plan', scope: 'workspace:read' },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-2.5 text-xs">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5">
                  <path d="M5 12l4.5 4.5L19 7" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p style={{ color: 'var(--text-soft)' }}>{item.label}</p>
                  <p className="font-mono text-[10px] mt-0.5" style={{ color: 'var(--subtle)' }}>
                    {item.scope}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div
            className="text-xs mb-4 px-3 py-2.5 rounded-lg"
            style={{
              background: 'rgba(239,68,68,0.08)',
              color: '#fca5a5',
              border: '1px solid rgba(239,68,68,0.22)',
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={allow}
          disabled={loading || !selectedWorkspaceId}
          className="btn-accent w-full mb-2"
        >
          {loading ? 'Authorizing…' : 'Allow access'}
        </button>

        <button onClick={deny} className="w-full py-2.5 text-xs transition-colors" style={{ color: 'var(--muted)' }}>
          Cancel and return
        </button>

        <p className="text-[10px] text-center mt-5 font-mono" style={{ color: 'var(--dim)' }}>
          OAuth 2.1 · PKCE · state verified
        </p>
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
