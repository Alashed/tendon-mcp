'use client';

import Link from 'next/link';
import { useState } from 'react';

const CLOUD_CMD = 'claude mcp add --transport http tendon https://mcp.tendon.alashed.kz';
const CLI_CMD = 'npx tendon-cli';

export default function LandingPage() {
  const [copied, setCopied] = useState<'cloud' | 'cli' | null>(null);

  const copy = async (which: 'cloud' | 'cli') => {
    await navigator.clipboard.writeText(which === 'cloud' ? CLOUD_CMD : CLI_CMD);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>

      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto">
        <span className="font-display font-bold text-lg tracking-tight select-none">
          <span style={{ color: 'var(--accent)' }}>tendon</span>
          <span style={{ color: 'var(--subtle)' }}>.</span>
        </span>
        <div className="flex items-center gap-5">
          <a
            href="https://github.com/Alashed/tendon-mcp"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm transition-colors"
            style={{ color: 'var(--muted)' }}
          >
            GitHub
          </a>
          <Link href="/login" className="text-sm transition-colors" style={{ color: 'var(--muted)' }}>
            Sign in
          </Link>
          <Link href="/register" className="amber-btn text-sm px-4 py-2 rounded-lg">
            Get started
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="px-6 pt-24 pb-20 max-w-3xl mx-auto">

        <p className="text-xs font-mono mb-6 uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
          Open source · MCP · OAuth 2.1
        </p>

        <h1
          className="font-display font-bold leading-[1.05] tracking-tight mb-6"
          style={{ fontSize: 'clamp(2.8rem, 7vw, 4.5rem)' }}
        >
          Work context<br />
          <span className="text-shimmer">for Claude Code.</span>
        </h1>

        <p className="text-lg leading-relaxed mb-12 max-w-xl" style={{ color: 'var(--muted)' }}>
          Tendon tracks your tasks, focus sessions, and daily work — and delivers
          that context to Claude so it always knows what you&apos;re building and what matters next.
        </p>

        {/* ── Two paths ─────────────────────── */}
        <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">

          {/* Self-hosted */}
          <div className="card p-5">
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>Self-hosted</p>
            <p className="text-xs mb-4" style={{ color: 'var(--subtle)' }}>
              One command. Docker included. No account.
            </p>
            <div
              className="flex items-center justify-between px-3 py-2.5 rounded-lg mb-3 font-mono text-sm"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <code style={{ color: 'var(--accent-light)' }}>{CLI_CMD}</code>
              <button
                onClick={() => copy('cli')}
                className="shrink-0 ml-3 text-xs transition-colors"
                style={{ color: copied === 'cli' ? 'var(--accent)' : 'var(--subtle)' }}
              >
                {copied === 'cli' ? '✓' : 'copy'}
              </button>
            </div>
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>
              Runs locally · PostgreSQL via Docker · MIT license
            </p>
          </div>

          {/* Cloud */}
          <div className="card p-5" style={{ borderColor: 'rgba(59,130,246,0.2)', background: 'rgba(59,130,246,0.03)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--accent)' }}>Hosted</p>
            <p className="text-xs mb-4" style={{ color: 'var(--subtle)' }}>
              Dashboard, analytics, team features, Telegram.
            </p>
            <div
              className="flex items-center justify-between px-3 py-2.5 rounded-lg mb-3 font-mono text-sm overflow-hidden"
              style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}
            >
              <code className="truncate text-xs" style={{ color: 'var(--accent-light)' }}>
                {CLOUD_CMD}
              </code>
              <button
                onClick={() => copy('cloud')}
                className="shrink-0 ml-3 text-xs transition-colors"
                style={{ color: copied === 'cloud' ? 'var(--accent)' : 'var(--subtle)' }}
              >
                {copied === 'cloud' ? '✓' : 'copy'}
              </button>
            </div>
            <Link
              href="/register"
              className="text-xs font-medium"
              style={{ color: 'var(--accent)' }}
            >
              Create free account →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Chat demo ───────────────────────────────────────── */}
      <section className="px-6 max-w-2xl mx-auto mb-28">
        <div
          className="rounded-xl p-6 font-mono text-sm"
          style={{ background: '#111115', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <p className="text-xs mb-5 tracking-wide" style={{ color: 'var(--subtle)' }}>
            CLAUDE CODE  ·  TENDON MCP
          </p>
          <div className="space-y-5">
            {[
              {
                who: 'you',
                msg: '/morning',
                sub: null,
              },
              {
                who: 'claude',
                msg: 'Good morning. You have 3 tasks in progress.',
                sub: '  🔥 Fix auth token refresh    [!!]\n  🔥 Deploy pipeline           [ !]\n  ○  Write integration tests   [  ]\n\n  ⏱ 0m tracked today · last session ended 18:42 yesterday',
              },
              {
                who: 'you',
                msg: 'Start focus on the auth fix.',
                sub: null,
              },
              {
                who: 'claude',
                msg: '▶  Focus started\n   Task  : Fix auth token refresh\n   Since : 09:14\n   ID    : e3f1a...',
                sub: null,
              },
            ].map(({ who, msg, sub }, i) => (
              <div key={i} className="flex gap-4">
                <span
                  className="shrink-0 text-xs pt-0.5 w-14"
                  style={{ color: who === 'you' ? 'var(--muted)' : 'var(--accent)', opacity: 0.7 }}
                >
                  {who}
                </span>
                <div>
                  <p style={{ color: who === 'you' ? 'var(--text)' : 'var(--text)', whiteSpace: 'pre-line' }}>{msg}</p>
                  {sub && (
                    <pre
                      className="mt-2 text-xs leading-relaxed whitespace-pre-wrap"
                      style={{ color: 'var(--muted)', fontFamily: 'inherit' }}
                    >
                      {sub}
                    </pre>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What it does ────────────────────────────────────── */}
      <section className="px-6 max-w-3xl mx-auto mb-28">
        <h2 className="font-display text-2xl font-bold mb-10">What Tendon does</h2>
        <div className="space-y-8">
          {[
            {
              label: 'Tracks context Claude doesn\'t have',
              body: 'Claude knows your code but not your workload. Tendon bridges that gap — tasks, priorities, time logs, blockers — all accessible to Claude via MCP tools.',
            },
            {
              label: 'Zero friction time logging',
              body: '"Start focus on the auth bug" starts a timer. "Done" stops it and marks the task. No apps to switch to, no forms to fill.',
            },
            {
              label: 'Daily summaries, standups, week reviews',
              body: 'Built-in prompts: /morning, /wrap_up, /standup, /review. Claude pulls real data from your workspace and writes the summary for you.',
            },
            {
              label: 'Works for teams',
              body: 'Invite teammates to a shared workspace. Everyone connects Claude to the same workspace. A lead can run /today and see what the whole team is working on.',
            },
          ].map(({ label, body }) => (
            <div key={label} className="flex gap-6">
              <div
                className="shrink-0 w-px self-stretch"
                style={{ background: 'rgba(59,130,246,0.2)' }}
              />
              <div>
                <p className="font-semibold text-sm mb-1">{label}</p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── MCP Tools ───────────────────────────────────────── */}
      <section className="px-6 max-w-3xl mx-auto mb-28">
        <h2 className="font-display text-2xl font-bold mb-2">11 MCP tools</h2>
        <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
          Everything Claude needs to manage your work, out of the box.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {[
            ['create_task', 'Create a task with title, priority, due date'],
            ['list_tasks', 'List filtered by status'],
            ['update_task', 'Edit title, priority, description'],
            ['update_task_status', 'Move to planned / in_progress / done'],
            ['archive_task', 'Remove from active list'],
            ['start_focus_session', 'Start timer, auto-stops previous'],
            ['stop_focus_session', 'Log duration + timestamps'],
            ['get_today_plan', 'In-progress + planned + time tracked'],
            ['get_daily_summary', 'Any date — supports "yesterday"'],
            ['week_summary', '7-day grid with focus bars'],
            ['log_blocker', 'Append blocker note to a task'],
          ].map(([name, desc]) => (
            <div
              key={name}
              className="flex gap-3 px-4 py-3 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <code className="text-xs shrink-0 pt-0.5" style={{ color: 'var(--accent)', minWidth: 160 }}>
                {name}
              </code>
              <span className="text-xs" style={{ color: 'var(--subtle)' }}>{desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Open source ─────────────────────────────────────── */}
      <section
        className="px-6 max-w-3xl mx-auto mb-28 py-10 rounded-2xl"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <p className="text-xs uppercase tracking-widest mb-4" style={{ color: 'var(--subtle)' }}>
          Open source · MIT
        </p>
        <h2 className="font-display text-2xl font-bold mb-3">
          Built in public.
        </h2>
        <p className="text-sm leading-relaxed mb-6 max-w-lg" style={{ color: 'var(--muted)' }}>
          Tendon is fully open source. Run it yourself, fork it, contribute.
          The hosted version at tendon.alashed.kz runs the same code.
        </p>
        <div className="flex gap-4">
          <a
            href="https://github.com/Alashed/tendon-mcp"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm px-4 py-2 rounded-lg border transition-all"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            View on GitHub →
          </a>
          <a
            href="https://github.com/Alashed/tendon-mcp/blob/main/CONTRIBUTING.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm px-4 py-2 rounded-lg border transition-all"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            Contributing guide
          </a>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────── */}
      <section className="px-6 max-w-3xl mx-auto mb-28">
        <h2 className="font-display text-2xl font-bold mb-2">Pricing</h2>
        <p className="text-sm mb-10" style={{ color: 'var(--muted)' }}>
          Self-hosted is always free. Hosted cloud starts free.
        </p>

        <div className="grid sm:grid-cols-3 gap-4">
          {/* Free */}
          <div className="card p-6 flex flex-col">
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--subtle)' }}>Free</p>
            <div className="font-display text-3xl font-bold mb-1">$0</div>
            <p className="text-xs mb-6" style={{ color: 'var(--muted)' }}>forever</p>
            <ul className="space-y-2 text-sm flex-1 mb-6" style={{ color: 'var(--muted)' }}>
              {['1 workspace', '50 tasks', 'All MCP tools', '7-day history', 'Self-hosted: unlimited'].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <span style={{ color: 'var(--subtle)' }}>·</span>{f}
                </li>
              ))}
            </ul>
            <Link href="/register"
              className="w-full py-2.5 rounded-lg text-sm border text-center transition-all block"
              style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
              Get started
            </Link>
          </div>

          {/* Pro */}
          <div className="card p-6 flex flex-col relative overflow-hidden"
            style={{ borderColor: 'rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.03)' }}>
            <div
              className="absolute top-0 left-0 right-0 h-0.5"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.6), transparent)' }}
            />
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--accent)' }}>Pro</p>
            <div className="font-display text-3xl font-bold mb-1">$9</div>
            <p className="text-xs mb-6" style={{ color: 'var(--muted)' }}>per month</p>
            <ul className="space-y-2 text-sm flex-1 mb-6" style={{ color: 'var(--muted)' }}>
              {[
                'Unlimited tasks',
                'Unlimited history',
                'Telegram daily reports',
                '/morning, /wrap_up, /review',
                'week_summary tool',
                'Priority support',
              ].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <span style={{ color: 'var(--accent)' }}>✓</span>{f}
                </li>
              ))}
            </ul>
            <a href="mailto:hello@tendon.alashed.kz?subject=Pro plan"
              className="amber-btn w-full py-2.5 rounded-lg text-sm text-center block">
              Get Pro
            </a>
          </div>

          {/* Team */}
          <div className="card p-6 flex flex-col">
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--subtle)' }}>Team</p>
            <div className="font-display text-3xl font-bold mb-1">$19</div>
            <p className="text-xs mb-6" style={{ color: 'var(--muted)' }}>per month</p>
            <ul className="space-y-2 text-sm flex-1 mb-6" style={{ color: 'var(--muted)' }}>
              {[
                'Everything in Pro',
                'Up to 10 members',
                'Team dashboard',
                'Per-member analytics',
                'Invite flow',
                'Shared workspace',
              ].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <span style={{ color: 'var(--subtle)' }}>·</span>{f}
                </li>
              ))}
            </ul>
            <a href="mailto:hello@tendon.alashed.kz?subject=Team plan"
              className="w-full py-2.5 rounded-lg text-sm border text-center transition-all block"
              style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
              Contact us
            </a>
          </div>
        </div>

        <p className="text-xs text-center mt-6" style={{ color: 'var(--subtle)' }}>
          Self-hosted via <code style={{ color: 'var(--muted)' }}>npx tendon-cli</code> is always free and unlimited. MIT license.
        </p>
      </section>

      {/* ── Final CTA ───────────────────────────────────────── */}
      <section className="px-6 max-w-xl mx-auto mb-24 text-center">
        <h2 className="font-display text-3xl font-bold mb-3">
          Get started now
        </h2>
        <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
          Self-hosted in one command. Hosted at tendon.alashed.kz.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => copy('cli')}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg border font-mono text-sm transition-all"
            style={{
              borderColor: copied === 'cli' ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.1)',
              background: copied === 'cli' ? 'rgba(59,130,246,0.08)' : 'transparent',
              color: copied === 'cli' ? 'var(--accent)' : 'var(--text)',
            }}
          >
            {copied === 'cli' ? '✓ Copied' : 'npx tendon-cli'}
          </button>
          <Link href="/register" className="amber-btn px-6 py-3 rounded-lg text-sm">
            Free account →
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer
        className="border-t px-6 py-8 max-w-5xl mx-auto flex items-center justify-between text-xs"
        style={{ borderColor: 'var(--border)', color: 'var(--subtle)' }}
      >
        <span>
          <span style={{ color: 'var(--accent)' }}>tendon</span> · MIT License
        </span>
        <div className="flex gap-5">
          <a href="https://github.com/Alashed/tendon-mcp" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">GitHub</a>
          <Link href="/register" className="transition-colors hover:text-white">Sign up</Link>
          <Link href="/login" className="transition-colors hover:text-white">Login</Link>
        </div>
      </footer>

    </div>
  );
}
