'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useUser, useAuth } from '@clerk/nextjs';

const COMMAND = 'claude mcp add --transport http tendon https://mcp.tendon.alashed.kz';
const TEST_PROMPT = 'tendon whoami';
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.tendon.alashed.kz';

export default function OnboardingPage() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [copied, setCopied] = useState<'cmd' | 'prompt' | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  const displayName =
    user?.firstName || user?.emailAddresses[0]?.emailAddress?.split('@')[0] || 'there';

  const copy = async (which: 'cmd' | 'prompt') => {
    await navigator.clipboard.writeText(which === 'cmd' ? COMMAND : TEST_PROMPT);
    setCopied(which);
    setTimeout(() => setCopied(null), 2500);
  };

  const checkConnection = async () => {
    setChecking(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/auth/claude-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const { data } = await res.json();
        setConnected(data.connected);
      }
    } catch { /* ignore */ } finally {
      setChecking(false);
    }
  };

  // Auto-check on mount and every 10s
  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 10_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-16 relative overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 20%, rgba(59,130,246,0.07) 0%, transparent 65%)' }}
      />
      <div className="grid-bg absolute inset-0 opacity-50" />

      <div className="relative max-w-lg w-full">

        {/* Header */}
        <div className="text-center mb-10">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M5 12l4.5 4.5L19 7" stroke="#3B82F6" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="font-display text-3xl font-bold mb-2">
            Welcome, {displayName}!
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            3 steps to connect Claude Code to your workspace.
          </p>
        </div>

        {/* Step 1 — run command */}
        <div className="card p-5 mb-3">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--accent)' }}
            >1</div>
            <div>
              <p className="text-sm font-medium">Run this in your terminal</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Any directory — runs once</p>
            </div>
          </div>
          <div
            className="flex items-start gap-2 px-3 py-2.5 rounded-lg mb-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <span className="text-sm shrink-0 mt-0.5" style={{ color: 'var(--subtle)' }}>$</span>
            <code className="text-xs flex-1 break-all leading-relaxed select-all" style={{ color: 'var(--accent-light)' }}>
              {COMMAND}
            </code>
          </div>
          <button
            onClick={() => copy('cmd')}
            className="w-full py-2 rounded-lg text-xs font-medium border transition-all"
            style={{
              borderColor: copied === 'cmd' ? 'rgba(59,130,246,0.4)' : 'rgba(59,130,246,0.12)',
              color: copied === 'cmd' ? 'var(--accent)' : 'var(--muted)',
              background: copied === 'cmd' ? 'rgba(59,130,246,0.05)' : 'transparent',
            }}
          >
            {copied === 'cmd' ? '✓ Copied' : 'Copy command'}
          </button>
        </div>

        {/* Step 2 — allow in browser */}
        <div className="card p-5 mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--accent)' }}
            >2</div>
            <div>
              <p className="text-sm font-medium">A browser opens — click Allow</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                This authorizes Claude to access your workspace. Happens once.
              </p>
            </div>
          </div>
        </div>

        {/* Step 3 — verify in Claude */}
        <div
          className="card p-5 mb-6"
          style={connected === true
            ? { borderColor: 'rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.03)' }
            : undefined}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{
                background: connected === true ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.12)',
                color: connected === true ? '#22C55E' : 'var(--accent)',
              }}
            >
              {connected === true ? '✓' : '3'}
            </div>
            <div>
              <p className="text-sm font-medium">
                {connected === true ? 'Claude is connected!' : 'Open Claude Code and verify'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                {connected === true
                  ? 'Your workspace is live. You can start using Tendon tools.'
                  : 'Type this in Claude Code chat (not in terminal) — Claude will call the API.'}
              </p>
            </div>
          </div>

          {connected !== true && (
            <>
              <div
                className="flex items-center justify-between px-4 py-3 rounded-lg mb-3 font-mono"
                style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}
              >
                <span className="text-sm" style={{ color: 'var(--accent-light)' }}>
                  {TEST_PROMPT}
                </span>
                <button
                  onClick={() => copy('prompt')}
                  className="text-xs ml-3 transition-colors shrink-0"
                  style={{ color: copied === 'prompt' ? 'var(--accent)' : 'var(--subtle)' }}
                >
                  {copied === 'prompt' ? '✓' : 'copy'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={checkConnection}
                  disabled={checking}
                  className="flex-1 py-2 rounded-lg text-xs border transition-all"
                  style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
                >
                  {checking ? 'Checking…' : '↺ Check connection'}
                </button>
              </div>

              <p className="text-xs mt-3 text-center" style={{ color: 'var(--subtle)' }}>
                This page auto-checks every 10 seconds
              </p>
            </>
          )}

          {connected === true && (
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-lg"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
            >
              <span style={{ color: '#22C55E' }}>●</span>
              <span className="text-xs" style={{ color: '#22C55E' }}>
                Active Claude OAuth token found — you&apos;re good to go!
              </span>
            </div>
          )}
        </div>

        {/* What to say next */}
        <div
          className="rounded-xl p-4 mb-6"
          style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.1)' }}
        >
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>
            Once connected, try these in Claude:
          </p>
          <div className="space-y-1">
            {[
              '/morning',
              '"Create a task: fix the auth bug, high priority"',
              '"Start a focus session on the first task"',
              '/wrap_up',
            ].map((p) => (
              <p key={p} className="text-xs font-mono" style={{ color: 'var(--accent-light)' }}>
                {p}
              </p>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/dashboard" className="amber-btn flex-1 py-3 rounded-lg text-sm text-center">
            Go to dashboard →
          </Link>
          <a
            href="https://docs.anthropic.com/claude-code"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 rounded-lg text-sm border text-center transition-all"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            Claude Code docs ↗
          </a>
        </div>
      </div>
    </div>
  );
}
