'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { Stat, EmptyState } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.tendon.alashed.kz';

interface TaskItem {
  id: string;
  title: string;
  priority: string;
}

interface UserReport {
  user_id: string;
  user_name: string;
  focus_minutes: number;
  session_count: number;
  tasks_done_today: TaskItem[];
  tasks_in_progress: TaskItem[];
  tasks_planned: TaskItem[];
}

interface DailyReport {
  date: string;
  workspace_id: string;
  users: UserReport[];
  totals: {
    total_focus_minutes: number;
    total_done_today: number;
    total_in_progress: number;
  };
}

interface Workspace {
  id: string;
  name: string;
  type: string;
}

function fmtMinutes(m: number): string {
  if (m === 0) return '0m';
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h > 0) return `${h}h ${min > 0 ? `${min}m` : ''}`.trim();
  return `${min}m`;
}

function focusBar(minutes: number, maxMinutes: number): number {
  if (maxMinutes === 0) return 0;
  return Math.min(Math.round((minutes / maxMinutes) * 100), 100);
}

const PRIORITY_COLOR: Record<string, string> = {
  high: '#FCA5A5',
  medium: '#a5b4fc',
  low: '#71717A',
};

export default function TeamPage() {
  const { getToken } = useAuth();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]!);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [myRole, setMyRole] = useState<string>('');
  const [inviteLink, setInviteLink] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load workspaces
  useEffect(() => {
    const load = async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const { data } = await res.json();
        const list: Workspace[] = data.workspaces ?? [];
        setWorkspaces(list);
        const team = list.find((w) => w.type === 'team') ?? list[0];
        if (team) {
          setWorkspaceId(team.id);
          setMyRole((team as Workspace & { role?: string }).role ?? '');
        }
      } catch { /* ignore */ }
    };
    load();
  }, [getToken]);

  const fetchReport = useCallback(async (wsId: string, d: string) => {
    const token = await getToken();
    if (!token || !wsId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/reports/daily?workspace_id=${wsId}&date=${d}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return;
      const { data } = await res.json();
      setReport(data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (workspaceId) fetchReport(workspaceId, date);
  }, [workspaceId, date, fetchReport]);

  const maxFocus = Math.max(...(report?.users.map((u) => u.focus_minutes) ?? [0]), 1);

  const today = new Date().toISOString().split('T')[0]!;
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]!;

  const toggleExpand = (userId: string) =>
    setExpanded((prev) => ({ ...prev, [userId]: !prev[userId] }));

  const createInvite = async () => {
    setInviting(true);
    setInviteError('');
    try {
      const token = await getToken();
      if (!token || !workspaceId) return;
      const res = await fetch(`${API_URL}/workspaces/${workspaceId}/invites`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'member' }),
      });
      const body = await res.json();
      if (!res.ok) {
        setInviteError(body.message ?? body.error ?? 'Failed to generate invite');
        return;
      }
      setInviteLink(body.data.invite_url);
    } catch {
      setInviteError('Network error');
    } finally {
      setInviting(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <header
        className="sticky top-0 z-20 pt-6 pb-5 border-b backdrop-blur-md"
        style={{ borderColor: 'var(--border)', background: 'rgba(8, 8, 11, 0.78)' }}
      >
        <div className="container-app flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="eyebrow mb-1.5">Organization</p>
            <h1 className="heading text-2xl leading-tight tracking-tight">Team</h1>
            <p className="text-sm mt-1.5" style={{ color: 'var(--muted)' }}>
              See member activity, focus time, and invite new teammates.
            </p>
          </div>
          <Link href="/dashboard" className="btn-ghost text-xs">
            ← Back
          </Link>
        </div>
      </header>

      <div className="container-app py-8">

        {/* ── Controls row ────────────────────────── */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          {workspaces.length > 1 && (
            <select
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              className="input text-xs py-2"
              style={{ maxWidth: 200 }}
            >
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
            </select>
          )}

          <div className="inline-flex gap-1 p-1 rounded-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {[
              { label: 'Yesterday', val: yesterday },
              { label: 'Today', val: today },
            ].map(({ label, val }) => (
              <button
                key={val}
                onClick={() => setDate(val)}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={{
                  background: date === val ? 'var(--surface-2)' : 'transparent',
                  color: date === val ? 'var(--text)' : 'var(--muted)',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {['owner', 'admin'].includes(myRole) && (
            <button
              onClick={createInvite}
              disabled={inviting}
              className="btn-ghost text-xs ml-auto"
              style={{ borderColor: 'rgba(99,102,241,0.35)', color: 'var(--accent-light)', background: 'rgba(99,102,241,0.06)' }}
            >
              {inviting ? 'Generating…' : '+ Invite'}
            </button>
          )}
        </div>

        {inviteError && (
          <div
            className="text-xs px-3 py-2 rounded-lg mb-4"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            {inviteError}
          </div>
        )}

        {inviteLink && (
          <div
            className="flex items-center gap-2 mb-5 px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.22)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--accent-light)', flexShrink: 0 }}>
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="flex-1 text-xs font-mono truncate" style={{ color: 'var(--text-soft)' }}>
              {inviteLink}
            </span>
            <button
              onClick={copyLink}
              className="text-xs px-2.5 py-1 rounded-md shrink-0 transition-all font-medium"
              style={{
                background: copied ? 'rgba(16,185,129,0.12)' : 'rgba(99,102,241,0.15)',
                color: copied ? '#6ee7b7' : 'var(--accent-light)',
                border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.3)'}`,
              }}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
            <button
              onClick={() => setInviteLink('')}
              className="text-xs w-6 h-6 rounded shrink-0 flex items-center justify-center"
              style={{ color: 'var(--muted)' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Totals ────────────────────────────── */}
        {report && (
          <section className="grid grid-cols-3 gap-4 mb-6">
            <Stat label="Total focus" value={fmtMinutes(report.totals.total_focus_minutes)} accent />
            <Stat
              label="Done today"
              value={report.totals.total_done_today}
              sub={report.totals.total_done_today > 0 ? 'nice work' : 'no wins yet'}
            />
            <Stat label="In progress" value={report.totals.total_in_progress} />
          </section>
        )}

        {/* ── Member cards ──────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="card h-24 animate-pulse"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        ) : !report || report.users.length === 0 ? (
          <EmptyState
            icon={<span style={{ fontSize: 14 }}>◎</span>}
            title="No activity recorded"
            description="Nothing happened on this date — pick a different day, or ask a teammate to connect Claude."
          />
        ) : (
          <div className="space-y-3">
            {report.users.map((u) => {
              const isExpanded = expanded[u.user_id] ?? false;
              const hasTasks =
                u.tasks_done_today.length + u.tasks_in_progress.length + u.tasks_planned.length > 0;

              return (
                <div key={u.user_id} className="card overflow-hidden">
                  {/* Main row */}
                  <div className="px-4 py-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-display font-semibold"
                        style={{
                          background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)',
                          color: '#fff',
                          fontSize: 13,
                        }}
                      >
                        {u.user_name[0]?.toUpperCase() ?? '?'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.user_name}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                          {u.session_count} session{u.session_count !== 1 ? 's' : ''}
                          {' · '}
                          {u.tasks_done_today.length} done
                          {' · '}
                          {u.tasks_in_progress.length} in progress
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p
                          className="font-mono text-sm font-semibold"
                          style={{ color: u.focus_minutes > 0 ? 'var(--text)' : 'var(--subtle)' }}
                        >
                          {fmtMinutes(u.focus_minutes)}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--subtle)' }}>focus</p>
                      </div>
                    </div>

                    {/* Focus bar */}
                    <div
                      className="h-1 rounded-full overflow-hidden"
                      style={{ background: 'rgba(255,255,255,0.05)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${focusBar(u.focus_minutes, maxFocus)}%`,
                          background: u.focus_minutes > 0
                            ? 'linear-gradient(90deg, rgba(99,102,241,0.6), rgba(99,102,241,0.9))'
                            : 'transparent',
                        }}
                      />
                    </div>
                  </div>

                  {/* Expand button */}
                  {hasTasks && (
                    <button
                      onClick={() => toggleExpand(u.user_id)}
                      className="w-full px-4 py-2 text-xs flex items-center gap-1.5 transition-all border-t"
                      style={{
                        borderColor: 'var(--border)',
                        color: 'var(--subtle)',
                        background: isExpanded ? 'rgba(255,255,255,0.02)' : 'transparent',
                      }}
                    >
                      <span>{isExpanded ? '▲' : '▼'}</span>
                      <span>{isExpanded ? 'Hide tasks' : 'Show tasks'}</span>
                    </button>
                  )}

                  {/* Task lists */}
                  {isExpanded && hasTasks && (
                    <div
                      className="px-4 pb-4 pt-2 space-y-3"
                      style={{ borderTop: '1px solid var(--border)' }}
                    >
                      {u.tasks_done_today.length > 0 && (
                        <div>
                          <p className="text-xs font-medium mb-1.5" style={{ color: '#22C55E' }}>
                            ✅ Done today ({u.tasks_done_today.length})
                          </p>
                          <div className="space-y-1">
                            {u.tasks_done_today.map((t) => (
                              <div key={t.id} className="flex items-center gap-2 text-xs">
                                <span style={{ color: 'var(--subtle)' }}>·</span>
                                <span
                                  style={{
                                    color: 'var(--muted)',
                                    textDecoration: 'line-through',
                                    textDecorationColor: 'var(--subtle)',
                                  }}
                                >
                                  {t.title}
                                </span>
                                <span
                                  className="ml-auto shrink-0 text-xs"
                                  style={{ color: PRIORITY_COLOR[t.priority] ?? 'var(--subtle)' }}
                                >
                                  {t.priority}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {u.tasks_in_progress.length > 0 && (
                        <div>
                          <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--accent)' }}>
                            🔥 In progress ({u.tasks_in_progress.length})
                          </p>
                          <div className="space-y-1">
                            {u.tasks_in_progress.map((t) => (
                              <div key={t.id} className="flex items-center gap-2 text-xs">
                                <span style={{ color: '#6366f1' }}>·</span>
                                <span style={{ color: 'var(--text)' }}>{t.title}</span>
                                <span
                                  className="ml-auto shrink-0"
                                  style={{ color: PRIORITY_COLOR[t.priority] ?? 'var(--subtle)' }}
                                >
                                  {t.priority}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {u.tasks_planned.length > 0 && (
                        <div>
                          <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
                            📋 Planned ({u.tasks_planned.length})
                          </p>
                          <div className="space-y-1">
                            {u.tasks_planned.slice(0, 5).map((t) => (
                              <div key={t.id} className="flex items-center gap-2 text-xs">
                                <span style={{ color: 'var(--subtle)' }}>·</span>
                                <span style={{ color: 'var(--muted)' }}>{t.title}</span>
                              </div>
                            ))}
                            {u.tasks_planned.length > 5 && (
                              <p className="text-xs" style={{ color: 'var(--subtle)' }}>
                                +{u.tasks_planned.length - 5} more
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
