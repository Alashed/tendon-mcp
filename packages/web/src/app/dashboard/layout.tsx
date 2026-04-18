'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { UserButton, useAuth } from '@clerk/nextjs';
import { useState, useEffect } from 'react';
import { Logo } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.tendon.alashed.kz';

const NAV_MAIN = [
  {
    href: '/dashboard',
    label: 'Overview',
    exact: true,
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      </svg>
    ),
  },
  {
    href: '/dashboard/tasks',
    label: 'Tasks',
    exact: false,
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.75" />
      </svg>
    ),
  },
  {
    href: '/dashboard/sessions',
    label: 'Sessions',
    exact: false,
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
        <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const NAV_WORKSPACE = [
  {
    href: '/dashboard/team',
    label: 'Team',
    exact: false,
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.75" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    exact: false,
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
          stroke="currentColor"
          strokeWidth="1.75"
        />
      </svg>
    ),
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { getToken } = useAuth();
  const [claudeConnected, setClaudeConnected] = useState<boolean | null>(null);
  const [activationChecked, setActivationChecked] = useState(false);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) {
        setActivationChecked(true);
        return;
      }

      try {
        const claudeStatusRes = await fetch(`${API_URL}/auth/claude-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const claudeStatusBody = claudeStatusRes.ok ? await claudeStatusRes.json() : null;
        const connected = Boolean(claudeStatusBody?.data?.connected);
        const workspaceId = claudeStatusBody?.data?.workspace_id as string | null | undefined;
        setClaudeConnected(connected);

        if (!connected || !workspaceId) {
          router.replace('/onboarding');
          return;
        }

        const onboardingStatusRes = await fetch(
          `${API_URL}/events/onboarding/status?workspace_id=${workspaceId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const onboardingStatusBody = onboardingStatusRes.ok ? await onboardingStatusRes.json() : null;
        const activated = Boolean(onboardingStatusBody?.data?.first_value_achieved);

        if (!activated) {
          router.replace('/onboarding');
          return;
        }
      } catch {
        // keep dashboard accessible on transient API issues
      } finally {
        setActivationChecked(true);
      }
    });
  }, [getToken, router]);

  if (!activationChecked) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--bg)', color: 'var(--muted)' }}
      >
        <div className="flex items-center gap-3 text-sm">
          <span className="inline-block w-2 h-2 rounded-full animate-pulse-soft" style={{ background: 'var(--accent-light)' }} />
          Checking activation…
        </div>
      </div>
    );
  }

  const renderNavItem = (item: (typeof NAV_MAIN)[number]) => {
    const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className="relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all"
        style={{
          background: active ? 'var(--surface-2)' : 'transparent',
          color: active ? 'var(--text)' : 'var(--muted)',
          fontWeight: active ? 500 : 400,
        }}
      >
        {active && (
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full"
            style={{ background: 'var(--accent-light)' }}
          />
        )}
        <span style={{ opacity: active ? 1 : 0.7, color: active ? 'var(--accent-light)' : 'currentColor' }}>
          {item.icon}
        </span>
        {item.label}
      </Link>
    );
  };

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* ── Sidebar ── */}
      <aside
        className="w-60 shrink-0 flex flex-col border-r sticky top-0 h-screen"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-soft)' }}
      >
        {/* Logo + workspace */}
        <div className="px-4 pt-5 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <Link href="/" className="inline-flex px-2 mb-3" aria-label="Tendon home">
            <Logo size={28} withWordmark />
          </Link>
          <button
            className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs transition-all"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-soft)',
            }}
            title="Workspace"
          >
            <span className="flex items-center gap-2 min-w-0">
              <span
                className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-[10px] font-semibold"
                style={{
                  background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)',
                  color: '#fff',
                }}
              >
                W
              </span>
              <span className="truncate">Personal workspace</span>
            </span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--subtle)' }}>
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <p className="eyebrow px-3 mb-2" style={{ fontSize: 10 }}>
            Workspace
          </p>
          <div className="space-y-0.5 mb-5">{NAV_MAIN.map(renderNavItem)}</div>

          <p className="eyebrow px-3 mb-2" style={{ fontSize: 10 }}>
            Organization
          </p>
          <div className="space-y-0.5">{NAV_WORKSPACE.map(renderNavItem)}</div>

          {claudeConnected === false && (
            <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <Link
                href="/onboarding"
                className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-xs transition-all"
                style={{
                  background: 'rgba(99,102,241,0.08)',
                  border: '1px solid rgba(99,102,241,0.22)',
                  color: 'var(--accent-light)',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  <span className="font-semibold block">Connect Claude</span>
                  <span style={{ color: 'var(--muted)' }}>Finish activation</span>
                </span>
              </Link>
            </div>
          )}
        </nav>

        {/* Help hint */}
        <div className="px-4 py-3 border-t flex items-center justify-between text-xs" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
          <a
            href="https://github.com/Alashed/tendon-mcp"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            Docs
          </a>
          <span className="flex items-center gap-1">
            <span className="kbd">⌘</span>
            <span className="kbd">K</span>
          </span>
        </div>

        {/* User */}
        <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <UserButton
            appearance={{
              elements: {
                avatarBox: { width: 28, height: 28 },
                userButtonTrigger: { display: 'flex', alignItems: 'center', gap: 8 },
                userButtonOuterIdentifier: { fontSize: 13, color: 'var(--text-soft)' },
              },
            }}
            showName
          />
        </div>
      </aside>

      {/* ── Content ── */}
      <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
    </div>
  );
}
