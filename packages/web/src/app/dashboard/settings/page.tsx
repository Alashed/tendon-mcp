'use client';

import { useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.tendon.alashed.kz';

interface Workspace {
  id: string;
  name: string;
  type: 'personal' | 'team';
  role?: string;
}

export default function SettingsPage() {
  const { user } = useUser();
  const { getToken } = useAuth();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [claudeConnected, setClaudeConnected] = useState<boolean | null>(null);
  const [plan, setPlan] = useState<string>('free');
  const [loading, setLoading] = useState(true);

  // Create team workspace
  const [newTeamName, setNewTeamName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Invite modal state
  const [inviteWsId, setInviteWsId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      const token = await getToken();
      if (!token) { setLoading(false); return; }
      try {
        const [meRes, claudeRes] = await Promise.all([
          fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/auth/claude-status`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (meRes.ok) {
          const { data } = await meRes.json();
          setWorkspaces(data.workspaces ?? []);
        }
        if (claudeRes.ok) {
          const { data } = await claudeRes.json();
          setClaudeConnected(data.connected);
          setPlan(data.plan ?? 'free');
        }
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    };
    load();
  }, [getToken]);

  const createTeamWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newTeamName.trim(), type: 'team' }),
      });
      if (!res.ok) {
        const err = await res.json();
        setCreateError(err.error ?? 'Failed to create workspace');
        return;
      }
      const { data } = await res.json();
      setWorkspaces((prev) => [...prev, data]);
      setNewTeamName('');
    } catch {
      setCreateError('Network error');
    } finally {
      setCreating(false);
    }
  };

  const createInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteWsId) return;
    setInviteLoading(true);
    setInviteError('');
    setInviteUrl('');
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/workspaces/${inviteWsId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: inviteEmail.trim() || undefined, role: inviteRole }),
      });
      if (!res.ok) {
        const err = await res.json();
        setInviteError(err.error ?? 'Failed to create invite');
        return;
      }
      const { data } = await res.json();
      setInviteUrl(data.invite_url);
    } catch {
      setInviteError('Network error');
    } finally {
      setInviteLoading(false);
    }
  };

  const copyInvite = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2500);
  };

  const displayName = user?.firstName || user?.emailAddresses[0]?.emailAddress?.split('@')[0] || 'you';
  const teamWorkspaces = workspaces.filter((w) => w.type === 'team');
  const canInvite = teamWorkspaces.some((w) => w.role === 'owner' || w.role === 'admin');

  const COMMAND = 'claude mcp add --transport http tendon https://mcp.tendon.alashed.kz';
  const [cmdCopied, setCmdCopied] = useState(false);
  const copyCmd = async () => {
    await navigator.clipboard.writeText(COMMAND);
    setCmdCopied(true);
    setTimeout(() => setCmdCopied(false), 2500);
  };

  return (
    <div className="max-w-2xl mx-auto px-8 py-8">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold mb-1">Settings</h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Manage your account, connections, and workspaces.
        </p>
      </div>

      {/* ── Profile ──────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--subtle)' }}>
          Profile
        </h2>
        <div className="card p-5">
          {loading ? (
            <div className="h-10 animate-pulse rounded" style={{ background: 'var(--surface-2)' }} />
          ) : (
            <div className="flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--accent)' }}
              >
                {displayName[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{displayName}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  {user?.emailAddresses[0]?.emailAddress ?? '—'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {plan === 'free' && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--subtle)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    Free
                  </span>
                )}
                {plan === 'personal' && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent)' }}>
                    Pro
                  </span>
                )}
                {plan === 'team' && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(234,179,8,0.1)', color: '#EAB308' }}>
                    Team
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Claude Code ──────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--subtle)' }}>
          Claude Code
        </h2>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium">MCP connection</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                Lets Claude create tasks, track focus sessions, and summarize your day.
              </p>
            </div>
            {claudeConnected === true && (
              <span
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full shrink-0"
                style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.2)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#22C55E' }} />
                Connected
              </span>
            )}
            {claudeConnected === false && (
              <span
                className="text-xs px-2.5 py-1 rounded-full shrink-0"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.15)' }}
              >
                Not connected
              </span>
            )}
          </div>

          {claudeConnected === false && (
            <>
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
                onClick={copyCmd}
                className="w-full py-2 rounded-lg text-xs font-medium border transition-all"
                style={{
                  borderColor: cmdCopied ? 'rgba(59,130,246,0.4)' : 'rgba(59,130,246,0.12)',
                  color: cmdCopied ? 'var(--accent)' : 'var(--muted)',
                  background: cmdCopied ? 'rgba(59,130,246,0.05)' : 'transparent',
                }}
              >
                {cmdCopied ? '✓ Copied' : 'Copy command'}
              </button>
            </>
          )}
        </div>
      </section>

      {/* ── Telegram ─────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--subtle)' }}>
          Telegram
        </h2>
        <div className="card p-5">
          <div className="flex items-start gap-3 mb-5">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(59,130,246,0.1)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M21 5L2 12.5l7 1M21 5l-5.5 15-3.5-6M21 5L9 13.5" stroke="#3B82F6" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Daily digest & standup reports</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                Connect your Telegram chat to receive daily summaries — what you built,
                how long you focused, what&apos;s next. Teams get per-member reports in a shared chat.
              </p>
            </div>
          </div>

          <div
            className="rounded-lg p-4 mb-4"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <p className="text-xs font-medium mb-3" style={{ color: 'var(--muted)' }}>How to connect:</p>
            <div className="space-y-2">
              {[
                { num: '1', text: 'Open the Tendon bot in Telegram' },
                { num: '2', text: 'Send /connect — the bot replies with a link' },
                { num: '3', text: 'Click the link — your chat is linked to this workspace' },
              ].map(({ num, text }) => (
                <div key={num} className="flex items-center gap-3 text-xs" style={{ color: 'var(--muted)' }}>
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs"
                    style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent)' }}
                  >
                    {num}
                  </span>
                  {text}
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs" style={{ color: 'var(--subtle)' }}>
            For a team chat: add the bot to your group and send{' '}
            <code style={{ color: 'var(--muted)' }}>/connect</code> there.
          </p>
        </div>
      </section>

      {/* ── Workspaces ───────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--subtle)' }}>
          Workspaces
        </h2>

        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="card h-14 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {workspaces.map((ws) => (
              <div key={ws.id} className="card px-4 py-3 flex items-center gap-3">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: ws.type === 'team' ? '#EAB308' : 'var(--accent)' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{ws.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    {ws.type} · {ws.role ?? 'member'}
                  </p>
                </div>
                {ws.type === 'team' && (ws.role === 'owner' || ws.role === 'admin') && (
                  <button
                    onClick={() => {
                      setInviteWsId(ws.id);
                      setInviteUrl('');
                      setInviteEmail('');
                      setInviteError('');
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg border transition-all shrink-0"
                    style={{
                      borderColor: inviteWsId === ws.id ? 'rgba(59,130,246,0.4)' : 'rgba(59,130,246,0.2)',
                      color: 'var(--accent)',
                      background: inviteWsId === ws.id ? 'rgba(59,130,246,0.08)' : 'transparent',
                    }}
                  >
                    + Invite
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Invite form */}
        {inviteWsId && (
          <div className="card p-5 mb-4" style={{ borderColor: 'rgba(59,130,246,0.2)' }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium">Invite teammate</p>
              <button
                onClick={() => { setInviteWsId(''); setInviteUrl(''); }}
                className="text-xs"
                style={{ color: 'var(--muted)' }}
              >
                ✕
              </button>
            </div>
            {!inviteUrl ? (
              <form onSubmit={createInvite} className="space-y-3">
                <input
                  type="email"
                  className="input w-full"
                  placeholder="colleague@company.com (optional)"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <div className="flex gap-2">
                  {(['member', 'admin'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setInviteRole(r)}
                      className="flex-1 py-2 rounded-lg text-xs border transition-all"
                      style={{
                        borderColor: inviteRole === r ? 'rgba(59,130,246,0.5)' : 'var(--border)',
                        background: inviteRole === r ? 'rgba(59,130,246,0.08)' : 'transparent',
                        color: inviteRole === r ? 'var(--accent)' : 'var(--muted)',
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                {inviteError && <p className="text-xs" style={{ color: '#FCA5A5' }}>{inviteError}</p>}
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="amber-btn w-full py-2.5 rounded-lg text-sm"
                >
                  {inviteLoading ? 'Creating…' : 'Create invite link'}
                </button>
              </form>
            ) : (
              <div className="space-y-3">
                <div
                  className="p-3 rounded-lg text-xs font-mono break-all leading-relaxed"
                  style={{ background: 'var(--surface-2)', color: 'var(--accent-light)' }}
                >
                  {inviteUrl}
                </div>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  Link expires in 7 days.
                </p>
                <button
                  onClick={copyInvite}
                  className="w-full py-2.5 rounded-lg text-sm border transition-all"
                  style={{
                    borderColor: inviteCopied ? 'rgba(59,130,246,0.4)' : 'rgba(59,130,246,0.15)',
                    color: inviteCopied ? 'var(--accent)' : 'var(--muted)',
                    background: inviteCopied ? 'rgba(59,130,246,0.06)' : 'transparent',
                  }}
                >
                  {inviteCopied ? '✓ Copied!' : 'Copy link'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Create team workspace */}
        {!teamWorkspaces.length && (
          <div className="card p-5" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <p className="text-sm font-medium mb-1">Create a team workspace</p>
            <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
              Invite teammates, share tasks, and get per-member daily reports.
            </p>
            <form onSubmit={createTeamWorkspace} className="flex gap-2">
              <input
                type="text"
                className="input flex-1"
                placeholder="Team name…"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
              />
              <button
                type="submit"
                className="amber-btn px-4 py-2 rounded-lg text-sm shrink-0"
                disabled={creating || !newTeamName.trim()}
              >
                {creating ? '…' : 'Create'}
              </button>
            </form>
            {createError && (
              <p className="text-xs mt-2" style={{ color: '#FCA5A5' }}>{createError}</p>
            )}
          </div>
        )}

        {canInvite && teamWorkspaces.length > 0 && !inviteWsId && (
          <p className="text-xs mt-2" style={{ color: 'var(--subtle)' }}>
            Click &ldquo;+ Invite&rdquo; on a team workspace to generate an invite link.
          </p>
        )}
      </section>
    </div>
  );
}
