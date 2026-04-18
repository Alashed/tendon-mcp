'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth, SignIn } from '@clerk/nextjs';
import Link from 'next/link';
import { Logo } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.tendon.alashed.kz';

interface InviteInfo {
  workspace_id: string;
  workspace_name: string;
  role: string;
  email: string | null;
}

function BrandLink() {
  return (
    <Link href="/" aria-label="Tendon home">
      <Logo size={32} withWordmark />
    </Link>
  );
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
        else setInviteError(d.message ?? d.error ?? 'Invalid invite');
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
      <div className="card-elev p-10 text-center max-w-md w-full">
        <div
          className="w-12 h-12 rounded-2xl mx-auto mb-5 flex items-center justify-center"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 8v4M12 16h.01" stroke="#fca5a5" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="12" r="10" stroke="#fca5a5" strokeWidth="1.75" />
          </svg>
        </div>
        <p className="eyebrow mb-2" style={{ color: '#fca5a5' }}>Invite problem</p>
        <h1 className="heading text-xl mb-2">Can&apos;t open this invite</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
          {inviteError || 'No invite code found in the URL.'}
        </p>
        <Link href="/" className="btn-ghost w-full justify-center">Back to home</Link>
      </div>
    );
  }

  if (!isLoaded || !invite) {
    return (
      <div className="text-sm flex items-center gap-2" style={{ color: 'var(--muted)' }}>
        <span className="w-3 h-3 rounded-full animate-pulse" style={{ background: 'var(--accent-light)' }} />
        Loading invitation…
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <p className="eyebrow mb-2">Team invite</p>
          <h1 className="heading text-2xl mb-1.5">
            Join <span style={{ color: 'var(--accent-light)' }}>{invite.workspace_name}</span>
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Sign in to accept
            {invite.email && <> as <span className="font-mono text-xs" style={{ color: 'var(--text-soft)' }}>{invite.email}</span></>}
          </p>
        </div>
        <SignIn
          fallbackRedirectUrl={`/join?invite=${code}`}
          appearance={{
            variables: {
              colorPrimary: '#6366f1',
              colorBackground: '#111115',
              colorText: '#FAFAFA',
              colorTextSecondary: '#A1A1AA',
              colorInputBackground: '#18181F',
              colorInputText: '#FAFAFA',
              colorNeutral: '#52525B',
              borderRadius: '10px',
            },
            elements: {
              rootBox: { width: '100%' },
              card: { background: '#111115', boxShadow: '0 0 0 1px rgba(255,255,255,0.07)' },
              formButtonPrimary: { backgroundColor: '#6366f1', color: '#fff', fontWeight: '600' },
              footerActionLink: { color: '#818cf8' },
            },
          }}
        />
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className="card-elev p-10 text-center max-w-md w-full">
        <div
          className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center"
          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M5 12l4.5 4.5L19 7" stroke="#6ee7b7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="eyebrow mb-2" style={{ color: '#6ee7b7' }}>Welcome aboard</p>
        <h1 className="heading text-2xl mb-2">You&apos;re in</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
          Joined <span style={{ color: 'var(--text)' }}>{invite.workspace_name}</span> as{' '}
          <span className="capitalize" style={{ color: 'var(--accent-light)' }}>{invite.role}</span>.
        </p>
        <button onClick={() => router.push('/dashboard')} className="btn-accent w-full">
          Open dashboard →
        </button>
      </div>
    );
  }

  return (
    <div className="card-elev p-10 max-w-md w-full">
      <div className="text-center mb-7">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(139,92,246,0.18) 100%)',
            border: '1px solid rgba(99,102,241,0.28)',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="var(--accent-light)" strokeWidth="1.75" strokeLinecap="round" />
            <circle cx="9" cy="7" r="4" stroke="var(--accent-light)" strokeWidth="1.75" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="var(--accent-light)" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </div>
        <p className="eyebrow mb-2">Team invite</p>
        <h1 className="heading text-2xl mb-2">Join workspace</h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          You&apos;ve been invited to{' '}
          <span style={{ color: 'var(--text)', fontWeight: 500 }}>{invite.workspace_name}</span>{' '}
          as <span className="badge badge-accent capitalize" style={{ fontSize: 10 }}>{invite.role}</span>
        </p>
      </div>

      {status === 'error' && (
        <div
          className="text-xs px-3 py-2 rounded-lg mb-4"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.22)' }}
        >
          {error}
        </div>
      )}

      <button
        onClick={accept}
        disabled={status === 'joining'}
        className="btn-accent w-full mb-3"
      >
        {status === 'joining' ? 'Joining…' : `Join ${invite.workspace_name}`}
      </button>
      <button
        onClick={() => router.push('/dashboard')}
        className="w-full text-xs transition-colors"
        style={{ color: 'var(--muted)' }}
      >
        Not now
      </button>
    </div>
  );
}

export default function JoinPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-10 relative overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 60%)',
        }}
      />
      <div className="absolute top-6 left-6"><BrandLink /></div>
      <div className="relative w-full flex items-center justify-center">
        <Suspense fallback={<div style={{ color: 'var(--muted)' }}>Loading…</div>}>
          <JoinContent />
        </Suspense>
      </div>
      <p className="text-xs mt-8 text-center" style={{ color: 'var(--subtle)' }}>
        Powered by <Link href="/" className="hover:opacity-80" style={{ color: 'var(--muted)' }}>Tendon</Link>
      </p>
    </div>
  );
}
