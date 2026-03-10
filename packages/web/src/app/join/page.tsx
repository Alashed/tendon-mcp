'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth, SignIn } from '@clerk/nextjs';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.tendon.alashed.kz';

interface InviteInfo {
  workspace_id: string;
  workspace_name: string;
  role: string;
  email: string | null;
}

function JoinContent() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get('invite') ?? '';

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [inviteError, setInviteError] = useState('');
  const [status, setStatus] = useState<'idle' | 'joining' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) return;
    fetch(`${API_URL}/invites/${code}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.data) setInvite(d.data);
        else setInviteError(d.error ?? 'Invalid invite');
      })
      .catch(() => setInviteError('Could not load invite'));
  }, [code]);

  const accept = async () => {
    setStatus('joining');
    try {
      const token = await getToken();
      if (!token) { setError('Not authenticated'); setStatus('error'); return; }
      const res = await fetch(`${API_URL}/invites/${code}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong');
        setStatus('error');
        return;
      }
      setStatus('done');
    } catch {
      setError('Network error. Please try again.');
      setStatus('error');
    }
  };

  if (!code || inviteError) {
    return (
      <div className="text-center">
        <div className="text-4xl mb-4" style={{ opacity: 0.2 }}>⚠️</div>
        <p className="text-sm" style={{ color: '#FCA5A5' }}>
          {inviteError || 'No invite code found.'}
        </p>
      </div>
    );
  }

  if (!isLoaded || !invite) {
    return <div className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</div>;
  }

  if (!isSignedIn) {
    return (
      <div className="w-full max-w-sm">
        <p className="text-sm mb-1 text-center font-medium">
          Join <span style={{ color: 'var(--accent)' }}>{invite.workspace_name}</span>
        </p>
        <p className="text-xs mb-5 text-center" style={{ color: 'var(--muted)' }}>
          Sign in to accept your invitation
          {invite.email && ` (as ${invite.email})`}
        </p>
        <SignIn
          fallbackRedirectUrl={`/join?invite=${code}`}
          appearance={{
            variables: {
              colorPrimary: '#3B82F6', colorBackground: '#111115',
              colorText: '#FAFAFA', colorTextSecondary: '#A1A1AA',
              colorInputBackground: '#18181F', colorInputText: '#FAFAFA',
              colorNeutral: '#52525B', borderRadius: '8px',
            },
            elements: {
              rootBox: { width: '100%' },
              card: { background: '#111115', boxShadow: '0 0 0 1px rgba(255,255,255,0.07)' },
              formButtonPrimary: { backgroundColor: '#3B82F6', color: '#fff', fontWeight: '600' },
              footerActionLink: { color: '#60A5FA' },
            },
          }}
        />
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className="text-center">
        <div className="text-4xl mb-4">🎉</div>
        <h2 className="font-display text-xl font-bold mb-2">You're in!</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
          You've joined <strong>{invite.workspace_name}</strong> as {invite.role}.
        </p>
        <button
          onClick={() => router.push('/onboarding')}
          className="px-5 py-2.5 rounded-xl font-medium text-sm"
          style={{ background: '#3B82F6', color: '#fff' }}
        >
          Set up Claude Code →
        </button>
      </div>
    );
  }

  return (
    <div className="text-center max-w-sm w-full">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
        style={{ background: 'rgba(59,130,246,0.12)' }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#3B82F6" strokeWidth="1.75" strokeLinecap="round"/>
          <circle cx="9" cy="7" r="4" stroke="#3B82F6" strokeWidth="1.75"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="#3B82F6" strokeWidth="1.75" strokeLinecap="round"/>
        </svg>
      </div>

      <h1 className="font-display text-2xl font-bold mb-1">Join workspace</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
        You've been invited to{' '}
        <span style={{ color: 'var(--text)', fontWeight: 500 }}>{invite.workspace_name}</span>
        {' '}as <span style={{ color: 'var(--accent)' }}>{invite.role}</span>.
      </p>

      {status === 'error' && (
        <div
          className="text-xs px-3 py-2 rounded-lg mb-4"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          {error}
        </div>
      )}

      <button
        onClick={accept}
        disabled={status === 'joining'}
        className="w-full py-3 rounded-xl font-medium text-sm mb-3"
        style={{ background: status === 'joining' ? 'rgba(59,130,246,0.5)' : '#3B82F6', color: '#fff' }}
      >
        {status === 'joining' ? 'Joining…' : `Join ${invite.workspace_name}`}
      </button>
      <button
        onClick={() => router.push('/dashboard')}
        className="text-xs"
        style={{ color: 'var(--subtle)' }}
      >
        Not now
      </button>
    </div>
  );
}

export default function JoinPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--bg)' }}>
      <Suspense fallback={<div style={{ color: 'var(--muted)' }}>Loading…</div>}>
        <JoinContent />
      </Suspense>
    </div>
  );
}
