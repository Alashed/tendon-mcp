'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { register } from '@/lib/api';
import { setAuth } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await register(name, email, password);
      setAuth(data.token, data.user, data.workspace.id);
      router.push('/onboarding');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
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

          <h1 className="font-display text-2xl font-bold mb-1.5">Create your account</h1>
          <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
            Free to start &middot; Takes 30 seconds
          </p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                Full name
              </label>
              <input
                type="text"
                className="input"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>

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
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                Password
              </label>
              <input
                type="password"
                className="input"
                placeholder="8+ characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
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
              {loading ? 'Creating account…' : 'Create account →'}
            </button>
          </form>

          <p className="text-sm mt-6 text-center" style={{ color: 'var(--muted)' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: 'var(--accent)' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* ── Preview side ───────────────────────────── */}
      <div
        className="hidden lg:flex flex-1 items-center justify-center p-12 relative border-l"
        style={{ borderColor: 'var(--border)' }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 30% 50%, rgba(245,158,11,0.06) 0%, transparent 65%)' }}
        />

        <div className="relative max-w-xs space-y-3 animate-fade-in delay-300">
          <p className="text-xs mb-5" style={{ color: 'var(--subtle)' }}>
            After signing up, you&apos;ll get:
          </p>

          {[
            {
              label: 'Step 1 — Run this',
              content: 'claude mcp add --transport http alashed-tracker https://mcp.tracker.alashed.kz',
              mono: true,
              accent: true,
            },
            {
              label: 'Step 2 — Say this in Claude Code',
              content: '"Create a task: implement refresh token, high priority"',
              mono: false,
              accent: false,
            },
            {
              label: 'Claude responds',
              content: '✓ Task created · #1 · High priority · Added to your workspace',
              mono: false,
              accent: true,
            },
          ].map(({ label, content, mono, accent }) => (
            <div
              key={label}
              className="card p-4"
              style={{ borderColor: accent ? 'rgba(245,158,11,0.2)' : 'var(--border)' }}
            >
              <p className="text-xs mb-2" style={{ color: 'var(--subtle)' }}>{label}</p>
              <p
                className={`text-xs leading-relaxed break-all ${mono ? 'font-mono' : ''}`}
                style={{ color: accent ? 'var(--accent-light)' : 'var(--text)' }}
              >
                {content}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
