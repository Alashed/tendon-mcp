'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useUser, useAuth } from '@clerk/nextjs';

const COMMAND = 'claude mcp add --transport http tendon https://mcp.tendon.alashed.kz/mcp';
const TEST_PROMPT = 'tendon whoami';
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.tendon.alashed.kz';

type Step = 'choose' | 'connect' | 'ready';
type Mode = 'solo' | 'team';

export default function OnboardingPage() {
  const { user } = useUser();
  const { getToken } = useAuth();

  const [step, setStep] = useState<Step>('choose');
  const [mode, setMode] = useState<Mode>('solo');
  const [copied, setCopied] = useState<'cmd' | 'prompt' | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [taskCount, setTaskCount] = useState<number | null>(null);
  const [trackedMinutes, setTrackedMinutes] = useState<number | null>(null);

  const displayName =
    user?.firstName || user?.emailAddresses[0]?.emailAddress?.split('@')[0] || 'there';

  const copy = async (which: 'cmd' | 'prompt') => {
    await navigator.clipboard.writeText(which === 'cmd' ? COMMAND : TEST_PROMPT);
    setCopied(which);
    setTimeout(() => setCopied(null), 2500);
  };

  const fetchAhaMoment = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const meRes = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!meRes.ok) return;
      const { data } = await meRes.json();
      const ws = data.workspaces?.find((w: { type: string }) => w.type === 'personal') ?? data.workspaces?.[0];
      if (!ws) return;

      const today = new Date().toISOString().split('T')[0];
      const [tasksRes, actsRes] = await Promise.all([
        fetch(`${API_URL}/tasks?workspace_id=${ws.id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/activities?workspace_id=${ws.id}&date=${today}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (tasksRes.ok) {
        const { data: tasks } = await tasksRes.json();
        setTaskCount((tasks as { status: string }[]).filter((t) => t.status !== 'archived').length);
      }
      if (actsRes.ok) {
        const { data: acts } = await actsRes.json();
        const mins = Math.floor(
          (acts as { end_time: string | null; start_time: string }[])
            .filter((a) => a.end_time)
            .reduce((acc: number, a) => acc + (new Date(a.end_time!).getTime() - new Date(a.start_time).getTime()) / 1000, 0) / 60
        );
        setTrackedMinutes(mins);
      }
    } catch { /* ignore */ }
  }, [getToken]);

  const checkConnection = useCallback(async () => {
    setChecking(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/auth/claude-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const { data } = await res.json();
        if (data.connected) {
          setConnected(true);
          setStep('ready');
          fetchAhaMoment();
        } else {
          setConnected(false);
        }
      }
    } catch { /* ignore */ } finally {
      setChecking(false);
    }
  }, [getToken, fetchAhaMoment]);

  useEffect(() => {
    if (step !== 'connect') return;
    checkConnection();
    const interval = setInterval(checkConnection, 10_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Step 1: Choose mode ──────────────────────────────────────────────────

  if (step === 'choose') {
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
          <div className="text-center mb-10">
            <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: 'var(--muted)' }}>
              Step 1 of 2
            </p>
            <h1 className="font-display text-3xl font-bold mb-2">Welcome, {displayName}!</h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              How do you plan to use Tendon?
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-8">
            {(
              [
                {
                  key: 'solo' as Mode,
                  title: 'Solo developer',
                  desc: 'Track your own tasks, focus sessions, and daily progress. Get Telegram digests.',
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.75" />
                      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                    </svg>
                  ),
                },
                {
                  key: 'team' as Mode,
                  title: 'Team',
                  desc: 'Shared workspace, per-member reports, lead sees the full picture.',
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.75" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                    </svg>
                  ),
                },
              ] as { key: Mode; title: string; desc: string; icon: React.ReactNode }[]
            ).map(({ key, title, desc, icon }) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className="card p-5 text-left transition-all"
                style={
                  mode === key
                    ? { borderColor: 'rgba(59,130,246,0.5)', background: 'rgba(59,130,246,0.05)' }
                    : undefined
                }
              >
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ color: mode === key ? 'var(--accent)' : 'var(--muted)' }}>{icon}</span>
                  <p className="text-sm font-medium">{title}</p>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                  {desc}
                </p>
                {mode === key && (
                  <div className="mt-3 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                    <span className="text-xs" style={{ color: 'var(--accent)' }}>Selected</span>
                  </div>
                )}
              </button>
            ))}
          </div>

          <button
            onClick={() => setStep('connect')}
            className="amber-btn w-full py-3 rounded-lg text-sm"
          >
            Continue — connect Claude Code →
          </button>

          <p className="text-xs text-center mt-4" style={{ color: 'var(--subtle)' }}>
            You can change this later in Settings
          </p>
        </div>
      </div>
    );
  }

  // ── Step 2: Connect ──────────────────────────────────────────────────────

  if (step === 'connect') {
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
          <div className="text-center mb-10">
            <button
              onClick={() => setStep('choose')}
              className="text-xs mb-6 inline-flex items-center gap-1 transition-colors"
              style={{ color: 'var(--subtle)' }}
            >
              ← Back
            </button>
            <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: 'var(--muted)' }}>
              Step 2 of 2
            </p>
            <h1 className="font-display text-3xl font-bold mb-2">Connect Claude Code</h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {mode === 'solo'
                ? 'Two steps. Claude will start tracking your work automatically.'
                : 'Connect your Claude. Teammates connect separately with the same command.'}
            </p>
          </div>

          {/* Step 1 — terminal command */}
          <div className="card p-5 mb-3">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--accent)' }}
              >
                1
              </div>
              <div>
                <p className="text-sm font-medium">Run this in your terminal</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Any directory · runs once</p>
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
            <p className="text-xs mt-2" style={{ color: 'var(--subtle)' }}>
              If tendon exists but shows &quot;Failed to connect&quot;: <code className="text-[11px]">claude mcp remove tendon</code> then add again. Restart Claude Code.
            </p>
          </div>

          {/* Step 2 — type in Claude */}
          <div
            className="card p-5 mb-6"
            style={
              connected === true
                ? { borderColor: 'rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.03)' }
                : undefined
            }
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{
                  background: connected === true ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.12)',
                  color: connected === true ? '#22C55E' : 'var(--accent)',
                }}
              >
                {connected === true ? '✓' : '2'}
              </div>
              <div>
                <p className="text-sm font-medium">
                  {connected === true ? 'Claude is connected!' : 'Open Claude Code — type this in chat'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  {connected === true
                    ? 'Tendon is now tracking your work.'
                    : 'Restart Claude Code if you just added, then type this. A browser opens for login.'}
                </p>
              </div>
            </div>

            {connected !== true && (
              <>
                <div
                  className="flex items-center justify-between px-4 py-3 rounded-lg mb-3 font-mono"
                  style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}
                >
                  <span className="text-sm" style={{ color: 'var(--accent-light)' }}>{TEST_PROMPT}</span>
                  <button
                    onClick={() => copy('prompt')}
                    className="text-xs ml-3 transition-colors shrink-0"
                    style={{ color: copied === 'prompt' ? 'var(--accent)' : 'var(--subtle)' }}
                  >
                    {copied === 'prompt' ? '✓' : 'copy'}
                  </button>
                </div>
                <button
                  onClick={checkConnection}
                  disabled={checking}
                  className="w-full py-2 rounded-lg text-xs border transition-all"
                  style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
                >
                  {checking ? 'Checking…' : '↺ Check connection'}
                </button>
                <p className="text-xs mt-3 text-center" style={{ color: 'var(--subtle)' }}>
                  Auto-checks every 10 seconds
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
                  Active OAuth token found — you&apos;re good to go!
                </span>
              </div>
            )}
          </div>

          {/* What to try */}
          <div
            className="rounded-xl p-4 mb-6"
            style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.1)' }}
          >
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>Once connected, try:</p>
            <div className="space-y-1">
              {[
                '"Create 3 tasks for today and start the first one"',
                '"What should I focus on today?"',
                '"/wrap_up — end of day summary"',
              ].map((p) => (
                <p key={p} className="text-xs font-mono" style={{ color: 'var(--accent-light)' }}>{p}</p>
              ))}
            </div>
          </div>

          <Link href="/dashboard" className="amber-btn w-full py-3 rounded-lg text-sm text-center block">
            Skip to dashboard →
          </Link>
        </div>
      </div>
    );
  }

  // ── Step 3: Ready / Aha moment ───────────────────────────────────────────

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-16 relative overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 20%, rgba(34,197,94,0.06) 0%, transparent 65%)' }}
      />
      <div className="grid-bg absolute inset-0 opacity-50" />

      <div className="relative max-w-lg w-full">
        <div className="text-center mb-10">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M5 12l4.5 4.5L19 7" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="font-display text-3xl font-bold mb-2">Claude is connected!</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Tendon is now tracking everything you do in Claude Code.
          </p>
        </div>

        {/* Detected data */}
        <div
          className="card p-5 mb-4"
          style={{ borderColor: 'rgba(34,197,94,0.2)', background: 'rgba(34,197,94,0.02)' }}
        >
          <p className="text-xs font-medium uppercase tracking-wide mb-4" style={{ color: 'var(--subtle)' }}>
            Your workspace · today
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-lg px-4 py-3"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <div
                className="font-display text-2xl font-bold mb-0.5"
                style={{ color: taskCount !== null && taskCount > 0 ? 'var(--accent)' : 'var(--subtle)' }}
              >
                {taskCount === null ? '—' : taskCount}
              </div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                {taskCount === null ? 'Loading…' : taskCount > 0 ? 'Tasks from Claude' : 'No tasks yet'}
              </div>
            </div>
            <div
              className="rounded-lg px-4 py-3"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <div
                className="font-display text-2xl font-bold mb-0.5"
                style={{ color: trackedMinutes !== null && trackedMinutes > 0 ? 'var(--text)' : 'var(--subtle)' }}
              >
                {trackedMinutes === null ? '—' : trackedMinutes > 0 ? `${trackedMinutes}m` : '0m'}
              </div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>Tracked today</div>
            </div>
          </div>
          {taskCount === 0 && (
            <p className="text-xs mt-4 px-1" style={{ color: 'var(--muted)' }}>
              Go to Claude and say:{' '}
              <span className="font-mono" style={{ color: 'var(--accent-light)' }}>
                &ldquo;Create 3 tasks for today and start the first one&rdquo;
              </span>
            </p>
          )}
        </div>

        {/* Try these */}
        <div
          className="rounded-xl p-4 mb-6"
          style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.1)' }}
        >
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>Try these in Claude:</p>
          <div className="space-y-1">
            {[
              '"/morning — start your day with a plan"',
              '"Start focus on the auth bug"',
              '"/wrap_up — stop tracking, recap today"',
            ].map((p) => (
              <p key={p} className="text-xs font-mono" style={{ color: 'var(--accent-light)' }}>{p}</p>
            ))}
          </div>
        </div>

        {/* Telegram nudge */}
        <div
          className="rounded-xl p-4 mb-6 flex items-start gap-3"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5">
            <path d="M21 5L2 12.5l7 1M21 5l-5.5 15-3.5-6M21 5L9 13.5" stroke="var(--muted)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text)' }}>Get daily Telegram digests</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Connect Telegram in{' '}
              <Link href="/dashboard/settings" className="underline" style={{ color: 'var(--accent)' }}>
                Settings
              </Link>{' '}
              to get daily summaries and team standup reports.
            </p>
          </div>
        </div>

        <Link href="/dashboard" className="amber-btn w-full py-3 rounded-lg text-sm text-center block">
          Open dashboard →
        </Link>
      </div>
    </div>
  );
}
