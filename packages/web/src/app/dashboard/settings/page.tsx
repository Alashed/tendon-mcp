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
  const [tgConnected, setTgConnected] = useState(false);
  const [tgBotUsername, setTgBotUsername] = useState<string | null>(null);

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
        const [meRes, claudeRes, tgRes] = await Promise.all([
          fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/auth/claude-status`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/telegram/status`, { headers: { Authorization: `Bearer ${token}` } }),
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
        if (tgRes.ok) {
          const { data } = await tgRes.json();
          setTgConnected(data.connected);
          setTgBotUsername(data.bot_username ?? null);
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

  const COMMAND = 'claude mcp add --transport http tendon https://api.tendon.alashed.kz/mcp';
  const [cmdCopied, setCmdCopied] = useState(false);
  const copyCmd = async () => {
    await navigator.clipboard.writeText(COMMAND);
    setCmdCopied(true);
    setTimeout(() => setCmdCopied(false), 2500);
  };

  return (
    <div>
      <header
        className="sticky top-0 z-20 pt-6 pb-5 border-b backdrop-blur-md"
        style={{ borderColor: 'var(--border)', background: 'rgba(8, 8, 11, 0.78)' }}
      >
        <div className="container-reading">
          <p className="eyebrow mb-1.5">Account</p>
          <h1 className="heading text-2xl leading-tight tracking-tight">Settings</h1>
          <p className="text-sm mt-1.5" style={{ color: 'var(--muted)' }}>
            Manage your account, connections, and workspaces.
          </p>
        </div>
      </header>

      <div className="container-reading py-8">

      {/* ── Profile ──────────────────────────────────────── */}
      <section className="mb-10">
        <div className="mb-4">
          <p className="eyebrow mb-1.5">Profile</p>
          <h2 className="heading text-base font-semibold">Account information</h2>
        </div>
        <div className="card-elev p-5">
          {loading ? (
            <div className="h-10 animate-pulse rounded" style={{ background: 'var(--surface-2)' }} />
          ) : (
            <div className="flex items-center gap-4">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-base font-display font-semibold shrink-0"
                style={{
                  background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)',
                  color: '#fff',
                }}
              >
                {displayName[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{displayName}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  {user?.emailAddresses[0]?.emailAddress ?? '—'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {plan === 'free' && (
                  <a href="/#pricing" className="badge hover:opacity-90" title="Upgrade to Pro">
                    Free
                  </a>
                )}
                {plan === 'personal' && <span className="badge badge-accent">Pro</span>}
                {plan === 'team' && (
                  <span className="badge" style={{ color: '#fcd34d', borderColor: 'rgba(234,179,8,0.3)', background: 'rgba(234,179,8,0.08)' }}>
                    Team
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Claude Code ──────────────────────────────────── */}
      <section className="mb-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-1.5">Integration</p>
            <h2 className="heading text-base font-semibold">Claude Code · MCP</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              Lets Claude create tasks, track focus sessions, and summarize your day.
            </p>
          </div>
          {claudeConnected === true && (
            <span className="badge badge-success shrink-0">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success)' }} />
              Connected
            </span>
          )}
          {claudeConnected === false && (
            <span className="badge shrink-0" style={{ color: '#fca5a5', borderColor: 'rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.06)' }}>
              Not connected
            </span>
          )}
        </div>
        <div className="card-elev p-5">
          {claudeConnected === false ? (
            <>
              <div className="flex items-start gap-2 px-3 py-3 rounded-lg mb-3 overflow-x-auto"
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)' }}
              >
                <span className="text-sm shrink-0 mt-0.5 font-mono" style={{ color: 'var(--subtle)' }}>$</span>
                <code className="text-xs flex-1 whitespace-nowrap select-all font-mono" style={{ color: 'var(--accent-light)' }}>
                  {COMMAND}
                </code>
              </div>
              <button
                onClick={copyCmd}
                className="btn-ghost w-full justify-center"
                style={cmdCopied ? { borderColor: 'rgba(99,102,241,0.45)', color: 'var(--accent-light)', background: 'rgba(99,102,241,0.08)' } : undefined}
              >
                {cmdCopied ? '✓ Copied' : 'Copy command'}
              </button>
              <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
                Then restart Claude Code — MCP tools load only at startup.
              </p>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.28)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12l4.5 4.5L19 7" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-soft)' }}>
                Tendon is connected to your Claude Code. Ask it to start your day.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Telegram ─────────────────────────────────────── */}
      <section className="mb-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-1.5">Notifications</p>
            <h2 className="heading text-base font-semibold">Telegram digest</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              Daily summaries: what you built, how long you focused, what&apos;s next.
            </p>
          </div>
          {!loading && tgConnected && (
            <span className="badge badge-success shrink-0">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success)' }} />
              Connected
            </span>
          )}
          {!loading && !tgConnected && (
            <span className="badge shrink-0">Not connected</span>
          )}
        </div>
        <div className="card-elev p-5">
          {tgConnected ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm" style={{ color: 'var(--text-soft)' }}>
                Chat linked. Daily digest will arrive automatically.
              </p>
              {tgBotUsername && (
                <a
                  href={`https://t.me/${tgBotUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost text-xs shrink-0"
                >
                  Open bot →
                </a>
              )}
            </div>
          ) : (
            <>
              <p className="text-xs font-medium mb-3" style={{ color: 'var(--muted)' }}>How to connect:</p>
              <div className="space-y-2.5 mb-5">
                {[
                  { num: '1', text: tgBotUsername ? `Open @${tgBotUsername} in Telegram` : 'Open the Tendon bot in Telegram' },
                  { num: '2', text: 'Send /connect — the bot replies with a link' },
                  { num: '3', text: 'Click the link — your chat is linked to this workspace' },
                ].map(({ num, text }) => (
                  <div key={num} className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-soft)' }}>
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold"
                      style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.22)' }}
                    >
                      {num}
                    </span>
                    {text}
                  </div>
                ))}
              </div>

              {tgBotUsername && (
                <a
                  href={`https://t.me/${tgBotUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-accent w-full"
                >
                  Open @{tgBotUsername} →
                </a>
              )}

              <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
                For a team chat: add the bot to your group and send{' '}
                <code className="kbd">/connect</code> there.
              </p>
            </>
          )}
        </div>
      </section>

      {/* ── Workspaces ───────────────────────────────────── */}
      <section className="mb-10">
        <div className="mb-4">
          <p className="eyebrow mb-1.5">Spaces</p>
          <h2 className="heading text-base font-semibold">Your workspaces</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            Switch context or invite teammates to your team workspaces.
          </p>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="card h-14 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {workspaces.map((ws) => {
              const isTeam = ws.type === 'team';
              return (
                <div
                  key={ws.id}
                  className="card px-4 py-3.5 flex items-center gap-3"
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-xs font-display font-semibold"
                    style={{
                      background: isTeam
                        ? 'linear-gradient(135deg, #eab308 0%, #f59e0b 100%)'
                        : 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)',
                      color: '#fff',
                    }}
                  >
                    {ws.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{ws.name}</p>
                    <p className="text-xs mt-0.5 flex items-center gap-2" style={{ color: 'var(--muted)' }}>
                      <span
                        className="badge"
                        style={{
                          fontSize: 10,
                          padding: '2px 8px',
                          color: isTeam ? '#fcd34d' : 'var(--accent-light)',
                          borderColor: isTeam ? 'rgba(234,179,8,0.28)' : 'rgba(99,102,241,0.25)',
                          background: isTeam ? 'rgba(234,179,8,0.06)' : 'rgba(99,102,241,0.05)',
                        }}
                      >
                        {ws.type}
                      </span>
                      <span>·</span>
                      <span>{ws.role ?? 'member'}</span>
                    </p>
                  </div>
                  {isTeam && (ws.role === 'owner' || ws.role === 'admin') && (
                    <button
                      onClick={() => {
                        setInviteWsId(ws.id);
                        setInviteUrl('');
                        setInviteEmail('');
                        setInviteError('');
                      }}
                      className="btn-ghost text-xs shrink-0"
                      style={inviteWsId === ws.id ? { borderColor: 'rgba(99,102,241,0.5)', color: 'var(--accent-light)', background: 'rgba(99,102,241,0.08)' } : undefined}
                    >
                      + Invite
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Invite form */}
        {inviteWsId && (
          <div className="card-elev p-5 mb-4" style={{ borderColor: 'rgba(99,102,241,0.28)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="eyebrow mb-1">Team invite</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Invite teammate</p>
              </div>
              <button
                onClick={() => { setInviteWsId(''); setInviteUrl(''); }}
                className="text-xs w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                style={{ color: 'var(--muted)', background: 'var(--surface-2)' }}
                aria-label="Close"
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
                      className="flex-1 py-2 rounded-lg text-xs font-medium capitalize border transition-all"
                      style={{
                        borderColor: inviteRole === r ? 'rgba(99,102,241,0.55)' : 'var(--border)',
                        background: inviteRole === r ? 'rgba(99,102,241,0.08)' : 'transparent',
                        color: inviteRole === r ? 'var(--accent-light)' : 'var(--muted)',
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                {inviteError && <p className="text-xs" style={{ color: '#fca5a5' }}>{inviteError}</p>}
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="btn-accent w-full"
                >
                  {inviteLoading ? 'Creating…' : 'Create invite link'}
                </button>
              </form>
            ) : (
              <div className="space-y-3">
                <div
                  className="p-3 rounded-lg text-xs font-mono break-all leading-relaxed"
                  style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--accent-light)', border: '1px solid var(--border)' }}
                >
                  {inviteUrl}
                </div>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  Link expires in 7 days.
                </p>
                <button
                  onClick={copyInvite}
                  className="btn-primary w-full"
                >
                  {inviteCopied ? '✓ Copied!' : 'Copy link'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Create team workspace */}
        {!teamWorkspaces.length && (
          <div className="card-elev p-5">
            <div className="flex items-start gap-3 mb-4">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.28)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#fcd34d" strokeWidth="1.75" strokeLinecap="round" />
                  <circle cx="9" cy="7" r="4" stroke="#fcd34d" strokeWidth="1.75" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Create a team workspace</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  Invite teammates, share tasks, and get per-member daily reports.
                </p>
              </div>
            </div>
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
                className="btn-primary shrink-0"
                disabled={creating || !newTeamName.trim()}
              >
                {creating ? '…' : 'Create'}
              </button>
            </form>
            {createError && (
              <p className="text-xs mt-2" style={{ color: '#fca5a5' }}>{createError}</p>
            )}
          </div>
        )}

        {canInvite && teamWorkspaces.length > 0 && !inviteWsId && (
          <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
            Click &ldquo;+ Invite&rdquo; on a team workspace to generate an invite link.
          </p>
        )}
      </section>
      </div>
    </div>
  );
}
