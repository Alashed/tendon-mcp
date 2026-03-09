'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';

const COMMAND = 'claude mcp add --transport http alashed-tracker https://mcp.tracker.alashed.kz';

export default function OnboardingPage() {
  const { user } = useUser();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(COMMAND);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const displayName =
    user?.firstName || user?.emailAddresses[0]?.emailAddress?.split('@')[0] || 'there';

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-16 relative overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 20%, rgba(245,158,11,0.08) 0%, transparent 65%)',
        }}
      />
      <div className="grid-bg absolute inset-0 opacity-50" />

      <div className="relative max-w-lg w-full">
        {/* Check */}
        <div className="animate-fade-up text-center mb-8">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.3)',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12l4.5 4.5L19 7"
                stroke="#F59E0B"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="font-display text-3xl font-bold mb-2">
            Welcome, {displayName}!
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Your account is ready. Now connect Claude Code in one command.
          </p>
        </div>

        {/* Command */}
        <div className="animate-fade-up delay-200 mb-3">
          <div className="terminal-cmd">
            <div className="flex items-center gap-2 mb-3">
              <span
                className="text-xs px-2 py-0.5 rounded font-mono"
                style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--accent)' }}
              >
                terminal
              </span>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                Paste and run once
              </span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-sm shrink-0 mt-0.5" style={{ color: 'var(--muted)' }}>$</span>
              <code
                className="text-sm flex-1 break-all leading-relaxed select-all"
                style={{ color: 'var(--accent-light)' }}
              >
                {COMMAND}
              </code>
            </div>
          </div>
        </div>

        <button
          onClick={copy}
          className="w-full py-3 rounded-lg text-sm font-medium border transition-all mb-8"
          style={{
            borderColor: copied ? 'rgba(245,158,11,0.4)' : 'rgba(245,158,11,0.15)',
            color: copied ? 'var(--accent)' : 'var(--muted)',
            background: copied ? 'rgba(245,158,11,0.06)' : 'transparent',
          }}
        >
          {copied ? '✓ Copied — paste it in your terminal' : 'Copy command'}
        </button>

        {/* Steps */}
        <div className="animate-fade-up delay-300 space-y-2 mb-8">
          {[
            { n: 1, title: 'Open your terminal', sub: 'Any terminal, any directory' },
            {
              n: 2,
              title: 'Paste and run the command above',
              sub: 'Claude will open a browser — click Allow',
            },
            {
              n: 3,
              title: 'Open Claude Code and ask away',
              sub: '"What tasks do I have today?"',
            },
          ].map(({ n, title, sub }) => (
            <div key={n} className="card flex items-center gap-4 px-4 py-3.5">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--accent)' }}
              >
                {n}
              </div>
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{sub}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="animate-fade-up delay-400 flex flex-col sm:flex-row gap-3">
          <Link href="/dashboard" className="amber-btn flex-1 py-3 rounded-lg text-sm">
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
