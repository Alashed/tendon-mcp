'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';

function OAuthConsent() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const params = {
    response_type: searchParams.get('response_type') ?? 'code',
    client_id: searchParams.get('client_id') ?? '',
    redirect_uri: searchParams.get('redirect_uri') ?? '',
    code_challenge: searchParams.get('code_challenge') ?? '',
    code_challenge_method: searchParams.get('code_challenge_method') ?? 'S256',
    state: searchParams.get('state') ?? '',
    scope: searchParams.get('scope') ?? '',
  };

  const allow = async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/oauth/consent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(params),
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

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 30%, rgba(245,158,11,0.07) 0%, transparent 65%)',
        }}
      />
      <div className="grid-bg absolute inset-0 opacity-50" />

      <div className="relative card p-8 max-w-sm w-full">
        {/* Icon */}
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.3)',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M13 10V3L4 14h7v7l9-11h-7z"
              stroke="#F59E0B"
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

        {/* Permissions */}
        <div
          className="space-y-2 mb-6 p-4 rounded-lg"
          style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.1)' }}
        >
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>
            Claude will be able to:
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
          disabled={loading}
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
