'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';
import { setAuth } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      setAuth(data.token, data.user, data.workspace.id);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>

      {/* ── Form side ──────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[360px] animate-fade-up">

          <Link href="/" className="inline-flex items-center gap-1.5 mb-10 font-display font-bold text-lg">
            <span style={{ color: 'var(--accent)' }}>alashed</span>
            <span style={{ color: 'var(--muted)' }}>.</span>
          </Link>

          <h1 className="font-display text-2xl font-bold mb-1.5">Welcome back</h1>
          <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
            Sign in to your account to continue
          </p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                Email
              </label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                Password
              </label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div
                className="text-sm px-3.5 py-2.5 rounded-lg"
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
              type="submit"
              className="amber-btn w-full py-3 rounded-lg text-sm"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-sm mt-6 text-center" style={{ color: 'var(--muted)' }}>
            No account?{' '}
            <Link href="/register" style={{ color: 'var(--accent)' }}>
              Create one
            </Link>
          </p>
        </div>
      </div>

      {/* ── Decorative side ────────────────────────── */}
      <div
        className="hidden lg:flex flex-1 items-center justify-center p-12 relative border-l"
        style={{ borderColor: 'var(--border)' }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 30% 50%, rgba(245,158,11,0.06) 0%, transparent 65%)' }}
        />
        <div className="relative max-w-sm space-y-3 animate-fade-in delay-300">
          <div className="terminal-cmd text-sm leading-relaxed">
            <div className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
              Claude Code · Alashed MCP
            </div>
            <div className="space-y-3">
              <div>
                <span style={{ color: 'var(--muted)' }}>You: </span>
                What should I work on today?
              </div>
              <div style={{ color: 'var(--accent-light)' }}>
                <span style={{ color: 'var(--accent)' }}>Claude: </span>
                You have 3 in-progress tasks. The auth bug is highest priority — you flagged it as blocking yesterday.
              </div>
            </div>
          </div>
          <p className="text-xs text-center" style={{ color: 'var(--subtle)' }}>
            This is what Claude sees after you connect Alashed
          </p>
        </div>
      </div>
    </div>
  );
}
