'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth, SignIn } from '@clerk/nextjs';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.tendon.alashed.kz';

function LinkContent() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get('code') ?? '';

  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  const confirm = async () => {
    setStatus('loading');
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/telegram/link/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? 'Something went wrong');
        setStatus('error');
        return;
      }
      setStatus('done');
    } catch {
      setError('Network error. Please try again.');
      setStatus('error');
    }
  };

  if (!isLoaded) {
    return <div className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</div>;
  }

  if (!code) {
    return (
      <div className="text-sm" style={{ color: '#FCA5A5' }}>
        Invalid link. Please run /connect again in Telegram.
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="w-full max-w-sm">
        <p className="text-sm mb-4 text-center" style={{ color: 'var(--muted)' }}>
          Sign in to connect your Telegram chat
        </p>
        <SignIn
          fallbackRedirectUrl={`/telegram/link?code=${code}`}
          appearance={{
            variables: {
              colorPrimary: '#3B82F6',
              colorBackground: '#111115',
              colorText: '#FAFAFA',
              colorTextSecondary: '#A1A1AA',
              colorInputBackground: '#18181F',
              colorInputText: '#FAFAFA',
              colorNeutral: '#52525B',
              borderRadius: '8px',
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
        <div className="text-4xl mb-4">✅</div>
        <h2 className="font-display text-xl font-bold mb-2">Chat connected!</h2>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Your Telegram chat is now linked to your tendon workspace.
          You'll receive daily summaries there.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-6 px-5 py-2.5 rounded-lg text-sm font-medium"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          Go to Dashboard →
        </button>
      </div>
    );
  }

  return (
    <div className="text-center max-w-sm">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
        style={{ background: 'rgba(59,130,246,0.12)' }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M21 5L2 12.5l7 1M21 5l-5.5 15-3.5-6M21 5L9 13.5" stroke="#3B82F6" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <h1 className="font-display text-2xl font-bold mb-2">Connect Telegram</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
        Connect your Telegram chat to receive daily summaries and quick stats.
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
        onClick={confirm}
        disabled={status === 'loading'}
        className="w-full py-3 rounded-xl font-medium text-sm transition-all"
        style={{ background: status === 'loading' ? 'rgba(59,130,246,0.5)' : '#3B82F6', color: '#fff' }}
      >
        {status === 'loading' ? 'Connecting…' : 'Connect this chat'}
      </button>
      <p className="text-xs mt-3" style={{ color: 'var(--subtle)' }}>
        You're logged in — your workspace will be linked automatically.
      </p>
    </div>
  );
}

export default function TelegramLinkPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--bg)' }}
    >
      <Suspense fallback={<div style={{ color: 'var(--muted)' }}>Loading…</div>}>
        <LinkContent />
      </Suspense>
    </div>
  );
}
