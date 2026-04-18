'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth, SignIn } from '@clerk/nextjs';
import Link from 'next/link';
import { Logo } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.tendon.alashed.kz';

function BrandLink() {
  return (
    <Link href="/" aria-label="Tendon home">
      <Logo size={32} withWordmark />
    </Link>
  );
}

function TelegramGlyph({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M21 5L2 12.5l7 1M21 5l-5.5 15-3.5-6M21 5L9 13.5"
        stroke="url(#tgGrad)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="tgGrad" x1="2" y1="5" x2="21" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38bdf8" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
    </svg>
  );
}

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
    return (
      <div className="text-sm flex items-center gap-2" style={{ color: 'var(--muted)' }}>
        <span className="w-3 h-3 rounded-full animate-pulse" style={{ background: 'var(--accent-light)' }} />
        Loading…
      </div>
    );
  }

  if (!code) {
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
        <p className="eyebrow mb-2" style={{ color: '#fca5a5' }}>Invalid link</p>
        <h1 className="heading text-xl mb-2">No link code found</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
          Run <code className="kbd">/connect</code> again in Telegram — the bot will send you a fresh link.
        </p>
        <Link href="/dashboard/settings" className="btn-ghost w-full justify-center">Back to settings</Link>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <TelegramGlyph size={36} />
          <p className="eyebrow mt-4 mb-2">Telegram · Link chat</p>
          <h1 className="heading text-2xl mb-1.5">Sign in to connect</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            We&apos;ll bind this Telegram chat to your workspace.
          </p>
        </div>
        <SignIn
          fallbackRedirectUrl={`/telegram/link?code=${code}`}
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
        <p className="eyebrow mb-2" style={{ color: '#6ee7b7' }}>Linked</p>
        <h1 className="heading text-2xl mb-2">Chat connected</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
          Your Telegram chat is bound to the workspace — daily digests will arrive automatically.
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
            background: 'linear-gradient(135deg, rgba(56,189,248,0.12) 0%, rgba(99,102,241,0.18) 100%)',
            border: '1px solid rgba(99,102,241,0.28)',
          }}
        >
          <TelegramGlyph size={26} />
        </div>
        <p className="eyebrow mb-2">Telegram digest</p>
        <h1 className="heading text-2xl mb-2">Connect this chat</h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Link this chat to your workspace — we&apos;ll send a short summary every day: what you built,
          how long you focused, what&apos;s next.
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

      <button onClick={confirm} disabled={status === 'loading'} className="btn-accent w-full mb-3">
        {status === 'loading' ? 'Connecting…' : 'Connect this chat'}
      </button>
      <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
        Code <code className="kbd" style={{ fontSize: 10 }}>{code.slice(0, 8)}…</code> will be consumed once.
      </p>
    </div>
  );
}

export default function TelegramLinkPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-10 relative overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 0%, rgba(56,189,248,0.06) 0%, transparent 60%)',
        }}
      />
      <div className="absolute top-6 left-6"><BrandLink /></div>
      <div className="relative w-full flex items-center justify-center">
        <Suspense fallback={<div style={{ color: 'var(--muted)' }}>Loading…</div>}>
          <LinkContent />
        </Suspense>
      </div>
      <p className="text-xs mt-8 text-center" style={{ color: 'var(--subtle)' }}>
        Tendon · Telegram integration
      </p>
    </div>
  );
}
