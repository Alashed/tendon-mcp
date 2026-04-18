'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Logo } from '@/components/ui';

const CLOUD_CMD = 'claude mcp add --transport http tendon https://api.tendon.alashed.kz/mcp';
const CLI_CMD = 'npx tendon-cli';

export default function LandingPage() {
  const [copied, setCopied] = useState<'cloud' | 'cli' | null>(null);

  const copy = async (which: 'cloud' | 'cli') => {
    await navigator.clipboard.writeText(which === 'cloud' ? CLOUD_CMD : CLI_CMD);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen relative" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="absolute inset-x-0 top-0 h-[640px] glow-bg pointer-events-none" aria-hidden />
      <div className="absolute inset-x-0 top-0 h-[640px] grid-bg pointer-events-none opacity-60" aria-hidden />

      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav className="container-app relative flex items-center justify-between py-5">
        <Link href="/" aria-label="Tendon home" className="select-none">
          <Logo size={32} withWordmark wordmarkSize="lg" />
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href="https://github.com/Alashed/tendon-mcp"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-block text-sm px-3 py-2 transition-colors"
            style={{ color: 'var(--muted)' }}
          >
            GitHub
          </a>
          <Link href="/login" className="text-sm px-3 py-2 transition-colors" style={{ color: 'var(--muted)' }}>
            Sign in
          </Link>
          <Link href="/register" className="btn-primary">
            Get started
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="container-app relative pt-16 sm:pt-24 pb-16">
        <div className="grid lg:grid-cols-[1.15fr_1fr] gap-12 lg:gap-16 items-center">
          {/* Left: copy + CTAs */}
          <div className="min-w-0">
            <div className="badge mb-6">
              <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse-soft" style={{ background: 'var(--success)' }} />
              Open source · MCP · OAuth 2.1
            </div>

            <h1 className="display-1 mb-6">
              Auto-tracks your work.<br />
              <span className="text-shimmer">Daily plan. Every day.</span>
            </h1>

            <p className="text-lg leading-relaxed mb-3 max-w-xl" style={{ color: 'var(--text-soft)' }}>
              Tendon collects everything you do in Claude Code and delivers a clear daily report and plan.
              No manual input. No context switching.
            </p>
            <p className="text-base leading-relaxed mb-8 max-w-xl" style={{ color: 'var(--muted)' }}>
              Web to see the full picture. Telegram to get the daily digest.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <Link href="/register" className="btn-accent px-6 py-3">
                Start free — no card →
              </Link>
              <button
                onClick={() => copy('cli')}
                className="btn-ghost font-mono text-xs px-4 py-3 justify-start sm:justify-center"
                style={copied === 'cli' ? { borderColor: 'rgba(99,102,241,0.5)', color: 'var(--accent-light)', background: 'rgba(99,102,241,0.08)' } : undefined}
              >
                <span style={{ color: 'var(--subtle)' }}>$</span> {copied === 'cli' ? '✓ Copied' : CLI_CMD}
              </button>
            </div>

            <p className="text-xs flex items-center gap-4" style={{ color: 'var(--muted)' }}>
              <span className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full" style={{ background: 'var(--success)' }} />
                2-min setup
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full" style={{ background: 'var(--accent-light)' }} />
                11 MCP tools
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full" style={{ background: '#fcd34d' }} />
                MIT license
              </span>
            </p>
          </div>

          {/* Right: product mockup */}
          <div className="relative">
            <div className="absolute -inset-8 opacity-40 pointer-events-none" style={{
              background: 'radial-gradient(circle at center, rgba(99,102,241,0.25), transparent 70%)',
              filter: 'blur(40px)',
            }} />
            <div
              className="relative card-elev overflow-hidden"
              style={{ borderRadius: 16 }}
            >
              {/* mock titlebar */}
              <div className="flex items-center gap-1.5 px-3 py-2 border-b" style={{ borderColor: 'var(--border)', background: 'rgba(0,0,0,0.3)' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} />
                <span className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }} />
                <span className="w-2 h-2 rounded-full" style={{ background: '#10b981' }} />
                <span className="flex-1 text-center text-[10px] font-mono" style={{ color: 'var(--subtle)' }}>
                  tendon.alashed.kz/dashboard
                </span>
              </div>
              <div className="flex">
                {/* mini sidebar */}
                <div className="w-16 shrink-0 px-2 py-3 border-r" style={{ borderColor: 'var(--border)', background: 'var(--bg-soft)' }}>
                  <div className="flex items-center gap-1 mb-4 px-1">
                    <Logo size={12} variant="gradient" />
                    <span className="text-[9px] font-semibold">tendon</span>
                  </div>
                  {['Overview', 'Tasks', 'Sessions', 'Team'].map((label, i) => (
                    <div
                      key={label}
                      className="px-1.5 py-1 rounded mb-0.5 text-[9px]"
                      style={{
                        background: i === 0 ? 'var(--surface-2)' : 'transparent',
                        color: i === 0 ? 'var(--text)' : 'var(--muted)',
                      }}
                    >
                      {label}
                    </div>
                  ))}
                </div>
                {/* mini content */}
                <div className="flex-1 p-3 min-w-0">
                  <p className="text-[8px] uppercase tracking-widest mb-1" style={{ color: 'var(--subtle)' }}>Overview</p>
                  <p className="text-xs font-display font-semibold mb-3">Good work, Alex.</p>

                  {/* focus card */}
                  <div
                    className="rounded-md p-2 mb-2"
                    style={{
                      background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 100%)',
                      border: '1px solid rgba(99,102,241,0.28)',
                    }}
                  >
                    <p className="text-[8px] uppercase tracking-widest" style={{ color: 'var(--accent-light)' }}>Focus · active</p>
                    <p className="text-[10px] font-semibold truncate">Fix auth token refresh</p>
                    <p className="text-[9px] font-mono" style={{ color: 'var(--accent-light)' }}>⏱ 42m</p>
                  </div>

                  {/* stats */}
                  <div className="grid grid-cols-3 gap-1 mb-2">
                    {[
                      { v: '2h 14m', l: 'Time' },
                      { v: '3', l: 'Active' },
                      { v: '8', l: 'Done' },
                    ].map((s) => (
                      <div
                        key={s.l}
                        className="rounded p-1.5"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                      >
                        <p className="text-[10px] font-display font-semibold leading-none">{s.v}</p>
                        <p className="text-[8px] mt-0.5" style={{ color: 'var(--muted)' }}>{s.l}</p>
                      </div>
                    ))}
                  </div>

                  {/* heatmap */}
                  <div className="flex gap-[2px] mb-2">
                    {Array.from({ length: 18 }).map((_, i) => {
                      const seed = (i * 7) % 10;
                      const op = seed < 2 ? 0.06 : seed < 5 ? 0.25 : seed < 8 ? 0.5 : 0.8;
                      return (
                        <div
                          key={i}
                          className="w-1.5 h-4 rounded-sm"
                          style={{ background: `rgba(99,102,241,${op})` }}
                        />
                      );
                    })}
                  </div>

                  {/* task rows */}
                  {[
                    { title: 'Ship onboarding v2', status: '#a5b4fc' },
                    { title: 'Review Team PRs', status: '#6ee7b7' },
                    { title: 'Write MCP spec', status: '#71717a' },
                  ].map((t) => (
                    <div key={t.title} className="flex items-center gap-1.5 py-1 px-1">
                      <span className="w-1 h-1 rounded-full" style={{ background: t.status }} />
                      <p className="text-[10px] truncate flex-1">{t.title}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Two install paths ───────────────────────────────── */}
      <section className="container-app relative mb-20">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="card p-5">
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-soft)' }}>Self-hosted</p>
            <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
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
                style={{ color: copied === 'cli' ? 'var(--accent-light)' : 'var(--muted)' }}
              >
                {copied === 'cli' ? '✓' : 'copy'}
              </button>
            </div>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Runs locally · PostgreSQL via Docker · MIT license
            </p>
          </div>

          <div className="card p-5" style={{ borderColor: 'rgba(99,102,241,0.28)', background: 'rgba(99,102,241,0.04)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--accent-light)' }}>Hosted</p>
            <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
              Dashboard, analytics, team features, Telegram.
            </p>
            <div
              className="flex items-center justify-between px-3 py-2.5 rounded-lg mb-3 font-mono text-sm overflow-hidden"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}
            >
              <code className="truncate text-xs" style={{ color: 'var(--accent-light)' }}>
                {CLOUD_CMD}
              </code>
              <button
                onClick={() => copy('cloud')}
                className="shrink-0 ml-3 text-xs transition-colors"
                style={{ color: copied === 'cloud' ? 'var(--accent-light)' : 'var(--muted)' }}
              >
                {copied === 'cloud' ? '✓' : 'copy'}
              </button>
            </div>
            <Link href="/register" className="text-xs font-medium" style={{ color: 'var(--accent-light)' }}>
              Create free account →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Chat demo ───────────────────────────────────────── */}
      <section className="container-reading mb-28">
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
                msg: 'Start my day in Tendon: create my first task, start a focus session, and show today plan.',
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
      <section className="container-reading mb-28">
        <p className="eyebrow mb-3">Product</p>
        <h2 className="display-2 mb-10">What Tendon does</h2>
        <div className="space-y-8">
          {[
            {
              label: 'Auto-collects everything from Claude Code',
              body: 'Tasks you create, focus sessions you start, blockers you log — all captured automatically. No separate app, no manual tracking.',
            },
            {
              label: 'Daily report and plan, every morning',
              body: 'Your first prompt can create tasks, start focus, and generate a plan. Then /morning keeps the daily loop running with prioritized next steps.',
            },
            {
              label: 'Telegram digest — no need to open anything',
              body: 'Every evening: what you built, how long you focused, what\'s next. For teams: per-member summary drops into your shared chat.',
            },
            {
              label: 'Web dashboard for the full picture',
              body: 'See your task timeline, focus session history, and weekly breakdown. Team leads get per-member analytics and can see who\'s blocked.',
            },
          ].map(({ label, body }) => (
            <div key={label} className="flex gap-6">
              <div
                className="shrink-0 w-px self-stretch"
                style={{ background: 'rgba(99,102,241,0.2)' }}
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
      <section className="container-reading mb-28">
        <p className="eyebrow mb-3">Toolbelt</p>
        <h2 className="display-2 mb-2">11 MCP tools</h2>
        <p className="text-base mb-10" style={{ color: 'var(--muted)' }}>
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
        className="container-reading mb-28 py-10 rounded-2xl"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <p className="eyebrow mb-3">Open source · MIT</p>
        <h2 className="display-2 mb-3">Built in public.</h2>
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
      <section className="container-reading mb-28">
        <p className="eyebrow mb-3">Pricing</p>
        <h2 className="display-2 mb-2">Simple, honest, free.</h2>
        <p className="text-base mb-10" style={{ color: 'var(--muted)' }}>
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
            style={{ borderColor: 'rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.04)' }}>
            <div
              className="absolute top-0 left-0 right-0 h-0.5"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.7), rgba(139,92,246,0.6), transparent)' }}
            />
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--accent-light)' }}>Pro</p>
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
                  <span style={{ color: 'var(--accent-light)' }}>✓</span>{f}
                </li>
              ))}
            </ul>
            <a href="mailto:hello@tendon.alashed.kz?subject=Pro plan"
              className="btn-accent w-full text-center">
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
      <section className="container-narrow mb-24 text-center">
        <h2 className="display-2 mb-4">Get started in 60 seconds.</h2>
        <p className="text-base mb-8" style={{ color: 'var(--muted)' }}>
          Self-hosted in one command. Hosted at tendon.alashed.kz.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => copy('cli')}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg border font-mono text-sm transition-all"
            style={{
              borderColor: copied === 'cli' ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)',
              background: copied === 'cli' ? 'rgba(99,102,241,0.08)' : 'transparent',
              color: copied === 'cli' ? 'var(--accent-light)' : 'var(--text)',
            }}
          >
            {copied === 'cli' ? '✓ Copied' : 'npx tendon-cli'}
          </button>
          <Link href="/register" className="btn-accent px-6 py-3">
            Free account →
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer
        className="container-app border-t py-8 flex items-center justify-between text-xs"
        style={{ borderColor: 'var(--border)', color: 'var(--subtle)' }}
      >
        <span className="flex items-center gap-2">
          <Logo size={20} variant="gradient" />
          <span style={{ color: 'var(--text-soft)' }}>Tendon</span>
          <span>· MIT License</span>
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
