'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';

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
  medium: '#93C5FD',
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
        if (team) setWorkspaceId(team.id);
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

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-8 py-8">

        {/* ── Header ────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/dashboard"
            className="text-xs px-2.5 py-1.5 rounded-lg border transition-all shrink-0"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            ← Back
          </Link>
          <h1 className="font-display text-xl font-bold flex-1">Team view</h1>

          {/* Workspace picker */}
          {workspaces.length > 1 && (
            <select
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              className="input text-xs py-1.5"
              style={{ maxWidth: 160 }}
            >
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
            </select>
          )}

          {/* Date picker */}
          <div className="flex gap-1 p-1 rounded-lg shrink-0" style={{ background: 'var(--surface)' }}>
            {[
              { label: 'Yesterday', val: yesterday },
              { label: 'Today', val: today },
            ].map(({ label, val }) => (
              <button
                key={val}
                onClick={() => setDate(val)}
                className="px-3 py-1 rounded text-xs font-medium transition-all"
                style={{
                  background: date === val ? 'var(--surface-2)' : 'transparent',
                  color: date === val ? 'var(--text)' : 'var(--muted)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Totals ────────────────────────────── */}
        {report && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              {
                label: 'Total focus',
                value: fmtMinutes(report.totals.total_focus_minutes),
                highlight: false,
              },
              {
                label: 'Done today',
                value: report.totals.total_done_today,
                highlight: report.totals.total_done_today > 0,
              },
              {
                label: 'In progress',
                value: report.totals.total_in_progress,
                highlight: true,
              },
            ].map(({ label, value, highlight }) => (
              <div key={label} className="card px-4 py-3">
                <div
                  className="font-display font-bold text-2xl mb-0.5"
                  style={{ color: highlight ? 'var(--accent)' : 'var(--text)' }}
                >
                  {value}
                </div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>{label}</div>
              </div>
            ))}
          </div>
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
          <div className="text-center py-16" style={{ color: 'var(--muted)' }}>
            <div className="text-3xl mb-3" style={{ opacity: 0.2 }}>◎</div>
            <p className="text-sm">No activity recorded for this date.</p>
          </div>
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
                      {/* Avatar */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{
                          background: 'rgba(59,130,246,0.12)',
                          color: 'var(--accent)',
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
                            ? 'linear-gradient(90deg, rgba(59,130,246,0.6), rgba(59,130,246,0.9))'
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
                                <span style={{ color: '#3B82F6' }}>·</span>
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
