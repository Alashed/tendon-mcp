'use client';

import Link from 'next/link';
import { useState } from 'react';

const COMMAND = 'claude mcp add --transport http tendon https://mcp.tendon.alashed.kz';

export default function LandingPage() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(COMMAND);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* Grid background */}
      <div className="grid-bg absolute inset-0" />

      {/* Top amber radial glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          width: '900px',
          height: '500px',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.13) 0%, transparent 68%)',
        }}
      />

      {/* ── Nav ──────────────────────────────────────── */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="font-display font-bold text-xl tracking-tight select-none">
          <span style={{ color: 'var(--accent)' }}>tendon</span>
          <span style={{ color: 'var(--muted)' }}>.</span>
        </div>
        <div className="flex items-center gap-5">
          <Link
            href="/login"
            className="text-sm transition-colors hover:text-white"
            style={{ color: 'var(--muted)' }}
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="amber-btn text-sm px-4 py-2 rounded-lg"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────── */}
      <section className="relative z-10 pt-20 pb-16 px-6 text-center max-w-4xl mx-auto">

        {/* Badge */}
        <div className="animate-fade-up">
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium mb-8"
            style={{
              borderColor: 'rgba(59,130,246,0.3)',
              color: 'var(--accent)',
              background: 'rgba(59,130,246,0.07)',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: 'var(--accent)',
                animation: 'blink 1.4s ease-in-out infinite',
              }}
            />
            MCP · OAuth 2.1 · Zero config
          </span>
        </div>

        <h1 className="animate-fade-up delay-100 font-display font-bold leading-[1.05] tracking-tight mb-6"
          style={{ fontSize: 'clamp(2.6rem, 8vw, 5rem)' }}>
          Your tasks,<br />
          <span className="text-shimmer">in Claude&apos;s hands.</span>
        </h1>

        <p
          className="animate-fade-up delay-200 text-lg max-w-2xl mx-auto mb-10 leading-relaxed"
          style={{ color: 'var(--muted)' }}
        >
          Track work, log focus sessions, and plan your day — all from inside Claude&nbsp;Code.
          One command to connect. No config files. No friction.
        </p>

        <div className="animate-fade-up delay-300 flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link
            href="/register"
            className="amber-btn px-7 py-3 rounded-lg text-sm gap-2"
          >
            Start for free
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2.5 7h9M8 3.5l3.5 3.5L8 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          <button
            onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-7 py-3 rounded-lg text-sm border transition-all hover:border-white/20"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            How it works
          </button>
        </div>
      </section>

      {/* ── Command showcase ──────────────────────────── */}
      <section className="relative z-10 px-6 max-w-2xl mx-auto mb-24">
        <div className="animate-fade-up delay-400">
          <div className="terminal-cmd">
            <div className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
              Run once in your terminal &rarr; connected forever
            </div>
            <div className="flex items-start gap-3">
              <span className="text-sm mt-px shrink-0" style={{ color: 'var(--muted)' }}>$</span>
              <code className="text-sm break-all flex-1 leading-relaxed" style={{ color: 'var(--accent-light)' }}>
                {COMMAND}
                <span className="animate-blink ml-1 inline-block w-2 h-4 align-text-bottom rounded-sm" style={{ background: 'var(--accent)', opacity: 0.7 }} />
              </code>
            </div>
          </div>
          <button
            onClick={copy}
            className="mt-3 w-full py-2.5 rounded-lg text-xs font-medium border transition-all"
            style={{
              borderColor: copied ? 'rgba(59,130,246,0.4)' : 'rgba(59,130,246,0.15)',
              color: copied ? 'var(--accent)' : 'var(--muted)',
              background: copied ? 'rgba(59,130,246,0.06)' : 'transparent',
            }}
          >
            {copied ? '✓ Copied to clipboard' : 'Copy command'}
          </button>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────── */}
      <section id="how" className="relative z-10 px-6 max-w-5xl mx-auto mb-28">
        <div className="text-center mb-14">
          <h2 className="font-display text-3xl font-bold mb-3">
            Three steps. That&apos;s it.
          </h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            From zero to fully integrated in under two minutes.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              step: '01',
              title: 'Create your account',
              desc: 'Sign up at tendon.alashed.kz. Your personal workspace is ready instantly.',
              detail: 'Takes 30 seconds',
            },
            {
              step: '02',
              title: 'Run one command',
              desc: 'Copy the command from your onboarding page and run it in your terminal. Claude handles auth automatically.',
              detail: '~ 5 seconds',
            },
            {
              step: '03',
              title: 'Ask Claude anything',
              desc: '"What should I focus on?" or "Create a task for the auth bug." Claude knows your workspace and priorities.',
              detail: 'Forever after',
            },
          ].map(({ step, title, desc, detail }) => (
            <div key={step} className="card p-6 relative overflow-hidden group">
              {/* Left amber accent bar */}
              <div
                className="absolute top-0 left-0 w-0.5 h-full transition-opacity"
                style={{
                  background: 'linear-gradient(to bottom, var(--accent), transparent)',
                  opacity: 0.6,
                }}
              />
              <div
                className="font-display text-6xl font-bold mb-5 leading-none select-none"
                style={{ color: 'rgba(59,130,246,0.1)' }}
              >
                {step}
              </div>
              <h3 className="font-display font-semibold text-base mb-2">{title}</h3>
              <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--muted)' }}>{desc}</p>
              <span
                className="text-xs px-2 py-1 rounded"
                style={{ background: 'rgba(59,130,246,0.08)', color: 'var(--accent)' }}
              >
                {detail}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features grid ────────────────────────────── */}
      <section className="relative z-10 px-6 max-w-5xl mx-auto mb-28">
        <div className="text-center mb-14">
          <h2 className="font-display text-3xl font-bold mb-3">
            Everything your workflow needs
          </h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Built for developers who live inside their tools.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {[
            {
              icon: '⚡',
              title: 'Claude-native task management',
              desc: 'Create, update, and reprioritize tasks without leaving your editor. Claude understands your project context automatically.',
            },
            {
              icon: '⏱',
              title: 'Automatic time tracking',
              desc: 'Log focus sessions by telling Claude. "Start working on the login bug" — session starts. "Stop" — it logs.',
            },
            {
              icon: '📊',
              title: 'Daily standups via Telegram',
              desc: 'Get a morning digest of your tasks and blockers. Reply to update statuses. Your team stays in sync.',
            },
            {
              icon: '👥',
              title: 'Team workspaces',
              desc: 'Invite your team to a shared workspace. Everyone gets Claude-powered task access with their own credentials.',
            },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="card p-5 flex gap-4 group">
              <div
                className="text-xl shrink-0 w-10 h-10 flex items-center justify-center rounded-lg transition-colors"
                style={{ background: 'rgba(59,130,246,0.07)' }}
              >
                {icon}
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1.5">{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Claude demo conversation ─────────────────── */}
      <section className="relative z-10 px-6 max-w-2xl mx-auto mb-28">
        <div className="card p-6 relative overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 80% 0%, rgba(59,130,246,0.05) 0%, transparent 60%)' }}
          />
          <div className="text-xs mb-5 font-mono" style={{ color: 'var(--muted)' }}>
            Claude Code · Tendon MCP · Live conversation
          </div>
          <div className="space-y-4 text-sm">
            {[
              { who: 'You', color: 'var(--text)', msg: 'What should I focus on today?' },
              {
                who: 'Claude',
                color: 'var(--accent)',
                msg: 'You have 5 open tasks. The highest priority is "Fix auth token refresh" — you marked it as blocking yesterday. Want me to start a focus session?',
              },
              { who: 'You', color: 'var(--text)', msg: 'Yes, start it.' },
              {
                who: 'Claude',
                color: 'var(--accent)',
                msg: '⏱ Focus session started for "Fix auth token refresh". I\'ll log your time automatically. Good luck!',
              },
            ].map(({ who, color, msg }, i) => (
              <div key={i} className="flex gap-3">
                <span className="text-xs font-mono shrink-0 pt-0.5 w-12" style={{ color }}>
                  {who}
                </span>
                <p className="leading-relaxed" style={{ color: i % 2 === 0 ? 'var(--text)' : 'var(--accent-light)' }}>
                  {msg}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA bottom ───────────────────────────────── */}
      <section className="relative z-10 px-6 max-w-xl mx-auto mb-24 text-center">
        <div className="card p-10 relative overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 50% -20%, rgba(59,130,246,0.08) 0%, transparent 70%)' }}
          />
          <h2 className="relative font-display text-3xl font-bold mb-3">
            Ready to ship faster?
          </h2>
          <p className="relative text-sm mb-7" style={{ color: 'var(--muted)' }}>
            Free to start. No credit card. Connect Claude Code in 30 seconds.
          </p>
          <Link href="/register" className="amber-btn px-8 py-3.5 rounded-lg text-sm">
            Create your account
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────── */}
      <footer
        className="relative z-10 border-t px-6 py-8 text-center text-xs"
        style={{ borderColor: 'var(--border)', color: 'var(--subtle)' }}
      >
        <p>
          © 2026 Tendon &mdash; Built for developers who live in Claude Code.
        </p>
      </footer>
    </div>
  );
}
