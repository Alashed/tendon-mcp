'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useUser, useAuth } from '@clerk/nextjs';
import {
  getTasks, createTask, updateTask,
  getActivities, startActivity, stopActivity,
  type Task, type Activity,
} from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.tendon.alashed.kz';

const STATUS_DOT: Record<Task['status'], string> = {
  planned: '#52525B',
  in_progress: '#3B82F6',
  done: '#22C55E',
  archived: '#3F3F46',
};

const PRIORITY_BADGE: Record<NonNullable<Task['priority']>, { bg: string; color: string }> = {
  high: { bg: 'rgba(239,68,68,0.12)', color: '#FCA5A5' },
  medium: { bg: 'rgba(59,130,246,0.12)', color: '#93C5FD' },
  low: { bg: 'rgba(82,82,91,0.4)', color: '#71717A' },
};

interface Workspace {
  id: string;
  name: string;
  type: 'personal' | 'team';
  role?: string;
}

type Filter = 'active' | 'done' | 'all';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function totalSeconds(activities: Activity[], ongoingStart?: string): number {
  const completed = activities
    .filter((a) => a.end_time)
    .reduce((acc, a) => {
      const s = (new Date(a.end_time!).getTime() - new Date(a.start_time).getTime()) / 1000;
      return acc + s;
    }, 0);
  const ongoing = ongoingStart
    ? (Date.now() - new Date(ongoingStart).getTime()) / 1000
    : 0;
  return Math.floor(completed + ongoing);
}

// ── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({
  workspaceId,
  onClose,
}: {
  workspaceId: string;
  onClose: () => void;
}) {
  const { getToken } = useAuth();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [inviteUrl, setInviteUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/workspaces/${workspaceId}/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: email.trim() || undefined, role }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? 'Failed to create invite');
        return;
      }
      const { data } = await res.json();
      setInviteUrl(data.invite_url);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-base">Invite teammate</h2>
          <button
            onClick={onClose}
            className="text-xs px-2 py-1 rounded"
            style={{ color: 'var(--muted)' }}
          >
            ✕
          </button>
        </div>

        {!inviteUrl ? (
          <form onSubmit={create} className="space-y-3">
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: 'var(--muted)' }}>
                Email (optional)
              </label>
              <input
                type="email"
                className="input w-full"
                placeholder="colleague@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs mb-1.5 block" style={{ color: 'var(--muted)' }}>
                Role
              </label>
              <div className="flex gap-2">
                {(['member', 'admin'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className="flex-1 py-2 rounded-lg text-xs border transition-all"
                    style={{
                      borderColor: role === r ? 'rgba(59,130,246,0.5)' : 'var(--border)',
                      background: role === r ? 'rgba(59,130,246,0.08)' : 'transparent',
                      color: role === r ? 'var(--accent)' : 'var(--muted)',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-xs" style={{ color: '#FCA5A5' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="amber-btn w-full py-2.5 rounded-lg text-sm mt-1"
            >
              {loading ? 'Creating…' : 'Create invite link'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div
              className="p-3 rounded-lg text-xs font-mono break-all leading-relaxed"
              style={{ background: 'var(--surface-2)', color: 'var(--accent-light)' }}
            >
              {inviteUrl}
            </div>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Link expires in 7 days. Share it with your teammate.
            </p>
            <button
              onClick={copy}
              className="w-full py-2.5 rounded-lg text-sm border transition-all"
              style={{
                borderColor: copied ? 'rgba(59,130,246,0.4)' : 'rgba(59,130,246,0.15)',
                color: copied ? 'var(--accent)' : 'var(--muted)',
                background: copied ? 'rgba(59,130,246,0.06)' : 'transparent',
              }}
            >
              {copied ? '✓ Copied!' : 'Copy link'}
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 text-xs"
              style={{ color: 'var(--subtle)' }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Activity Heatmap ─────────────────────────────────────────────────────────

interface HeatDay {
  day: string;
  focus_minutes: number;
  session_count: number;
  tasks_done: number;
}

function ActivityHeatmap({ workspaceId, token }: { workspaceId: string; token: string }) {
  const [days, setDays] = useState<HeatDay[]>([]);
  const [tooltip, setTooltip] = useState<{
    day: string; focus_minutes: number; tasks_done: number; session_count: number;
    x: number; y: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Fixed GitHub-like cell size; weeks count is derived from container width
  const CELL = 11;
  const GAP = 2;
  const LABEL_W = 28;
  const MAX_WEEKS = 52;
  const [weeks, setWeeks] = useState(24);

  // Recompute weeks count when container resizes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = Math.floor((el.offsetWidth - LABEL_W + GAP) / (CELL + GAP));
      setWeeks(Math.min(MAX_WEEKS, Math.max(12, w)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!workspaceId || !token || weeks < 1) return;
    fetch(`${API_URL}/reports/heatmap?workspace_id=${workspaceId}&weeks=${weeks}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((body) => { if (body?.data?.days) setDays(body.data.days); })
      .catch(() => {});
  }, [workspaceId, token, weeks]);

  const byDay = new Map<string, HeatDay>();
  for (const d of days) byDay.set(d.day, d);

  const totalMinutes = days.reduce((s, d) => s + d.focus_minutes, 0);
  const totalDone = days.reduce((s, d) => s + d.tasks_done, 0);
  const activeDays = days.filter((d) => d.focus_minutes > 0 || d.tasks_done > 0).length;

  // Longest streak
  const longestStreak = (() => {
    let best = 0, cur = 0;
    const sorted = [...days].sort((a, b) => a.day.localeCompare(b.day));
    for (const d of sorted) {
      if (d.focus_minutes > 0 || d.tasks_done > 0) { cur++; best = Math.max(best, cur); }
      else cur = 0;
    }
    return best;
  })();

  // Stat block color — one blue hue, 5 levels of intensity
  const statColor = (value: number, max: number) => {
    const ratio = Math.min(value / Math.max(max, 1), 1);
    if (ratio === 0)  return { bg: 'rgba(59,130,246,0.06)',  text: 'rgba(255,255,255,0.25)' };
    if (ratio < 0.2)  return { bg: 'rgba(59,130,246,0.12)', text: 'rgba(147,197,253,0.7)' };
    if (ratio < 0.45) return { bg: 'rgba(59,130,246,0.22)', text: '#93C5FD' };
    if (ratio < 0.75) return { bg: 'rgba(59,130,246,0.38)', text: '#60A5FA' };
    return { bg: 'rgba(59,130,246,0.55)', text: '#3B82F6' };
  };

  // Build grid: col = week, row = Mon(0)..Sun(6)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - weeks * 7);
  const dow = startDate.getDay();
  startDate.setDate(startDate.getDate() + (dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow));

  const grid: Array<Array<{ date: string; inRange: boolean }>> = [];
  const cur = new Date(startDate);
  while (cur <= today) {
    const col: Array<{ date: string; inRange: boolean }> = [];
    for (let r = 0; r < 7; r++) {
      col.push(cur <= today
        ? { date: cur.toISOString().split('T')[0]!, inRange: true }
        : { date: '', inRange: false },
      );
      cur.setDate(cur.getDate() + 1);
    }
    grid.push(col);
  }

  // Month labels
  const monthLabels: Array<{ col: number; label: string }> = [];
  let lastMonth = -1;
  for (let c = 0; c < grid.length; c++) {
    const cell = grid[c]?.[0];
    if (cell?.inRange && cell.date) {
      const m = new Date(cell.date + 'T12:00:00').getMonth();
      if (m !== lastMonth) {
        monthLabels.push({ col: c, label: new Date(cell.date + 'T12:00:00').toLocaleString('en', { month: 'short' }) });
        lastMonth = m;
      }
    }
  }

  const color = (mins: number, done: number) => {
    if (mins === 0 && done === 0) return 'rgba(255,255,255,0.06)';
    if (mins < 15) return 'rgba(59,130,246,0.22)';
    if (mins < 45) return 'rgba(59,130,246,0.45)';
    if (mins < 90) return 'rgba(59,130,246,0.7)';
    return '#3B82F6';
  };

  const fmtDate = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });

  const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

  return (
    <div className="card p-5 mb-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-sm font-medium">
            {totalMinutes > 0
              ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m focused`
              : 'No focus sessions yet'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            {activeDays > 0 ? `${activeDays} active day${activeDays !== 1 ? 's' : ''} · ` : ''}Last {weeks} weeks
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs shrink-0" style={{ color: 'var(--subtle)' }}>
          <span>Less</span>
          {[0, 14, 44, 89, 120].map((m) => (
            <div key={m} style={{ width: 11, height: 11, borderRadius: 2, background: color(m, m > 0 ? 1 : 0) }} />
          ))}
          <span>More</span>
        </div>
      </div>

      {/* Grid */}
      <div ref={containerRef} style={{ width: '100%' }}>
        {/* Month labels */}
        <div style={{ display: 'flex', marginLeft: LABEL_W, marginBottom: 4 }}>
          {grid.map((_, c) => {
            const lbl = monthLabels.find((l) => l.col === c);
            return (
              <div
                key={c}
                style={{ width: CELL + GAP, flexShrink: 0, fontSize: 10, color: 'var(--subtle)', overflow: 'hidden', whiteSpace: 'nowrap' }}
              >
                {lbl?.label ?? ''}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          {/* Day labels */}
          <div style={{ width: LABEL_W, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: GAP }}>
            {DAY_LABELS.map((lbl, i) => (
              <div
                key={i}
                style={{
                  height: CELL, width: LABEL_W,
                  fontSize: 9, color: 'var(--subtle)',
                  textAlign: 'right', paddingRight: 5,
                  lineHeight: `${CELL}px`,
                }}
              >
                {lbl}
              </div>
            ))}
          </div>

          {/* Week columns — fixed CELL size, perfectly square */}
          <div style={{ display: 'flex', gap: GAP }}>
            {grid.map((col, c) => (
              <div key={c} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
                {col.map((cell, r) => {
                  const data = cell.inRange ? byDay.get(cell.date) : undefined;
                  const mins = data?.focus_minutes ?? 0;
                  const done = data?.tasks_done ?? 0;
                  return (
                    <div
                      key={r}
                      style={{
                        width: CELL,
                        height: CELL,
                        borderRadius: 2,
                        background: cell.inRange ? color(mins, done) : 'transparent',
                        flexShrink: 0,
                      }}
                      onMouseEnter={cell.inRange ? (e) => {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setTooltip({
                          day: cell.date, focus_minutes: mins, tasks_done: done,
                          session_count: data?.session_count ?? 0,
                          x: rect.left + rect.width / 2, y: rect.top,
                        });
                      } : undefined}
                      onMouseLeave={cell.inRange ? () => setTooltip(null) : undefined}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y - 10,
            transform: 'translate(-50%, -100%)',
            background: '#1a1a1f',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 7,
            padding: '6px 10px',
            fontSize: 11,
            color: 'var(--text)',
            pointerEvents: 'none',
            zIndex: 1000,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ color: 'var(--muted)', marginBottom: 3 }}>{fmtDate(tooltip.day)}</div>
          {tooltip.focus_minutes === 0 && tooltip.tasks_done === 0 ? (
            <div style={{ color: 'var(--subtle)' }}>No activity</div>
          ) : (
            <>
              {tooltip.focus_minutes > 0 && (
                <div>
                  <span style={{ color: 'var(--accent)' }}>
                    {tooltip.focus_minutes >= 60
                      ? `${Math.floor(tooltip.focus_minutes / 60)}h ${tooltip.focus_minutes % 60}m`
                      : `${tooltip.focus_minutes}m`}
                  </span>
                  <span style={{ color: 'var(--subtle)' }}>
                    {' '}focus · {tooltip.session_count} session{tooltip.session_count !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
              {tooltip.tasks_done > 0 && (
                <div>
                  <span style={{ color: '#22C55E' }}>{tooltip.tasks_done} task{tooltip.tasks_done !== 1 ? 's' : ''}</span>
                  <span style={{ color: 'var(--subtle)' }}> completed</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Stats row ── */}
      <div className="grid grid-cols-4 gap-2 mt-5">
        {[
          {
            label: 'Focus time',
            value: totalMinutes >= 60
              ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
              : `${totalMinutes}m`,
            sub: `${weeks}w total`,
            c: statColor(totalMinutes, 3000),
          },
          {
            label: 'Tasks done',
            value: String(totalDone),
            sub: totalDone === 1 ? 'task' : 'tasks',
            c: statColor(totalDone, 100),
          },
          {
            label: 'Active days',
            value: String(activeDays),
            sub: `of ${weeks * 7} days`,
            c: statColor(activeDays, weeks * 7 * 0.5),
          },
          {
            label: 'Best streak',
            value: `${longestStreak}d`,
            sub: longestStreak > 0 ? 'in a row' : 'no streak yet',
            c: statColor(longestStreak, 14),
          },
        ].map(({ label, value, sub, c }) => (
          <div
            key={label}
            style={{
              background: c.bg,
              border: `1px solid ${c.bg.replace('0.06', '0.15').replace('0.12', '0.2').replace('0.22', '0.3').replace('0.38', '0.45').replace('0.55', '0.6')}`,
              borderRadius: 8,
              padding: '10px 12px',
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, color: c.text, lineHeight: 1, fontFamily: 'var(--font-syne)' }}>
              {value}
            </div>
            <div style={{ fontSize: 10, color: 'var(--subtle)', marginTop: 4 }}>{label}</div>
            <div style={{ fontSize: 9, color: 'var(--subtle)', opacity: 0.6, marginTop: 1 }}>{sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useUser();
  const { getToken } = useAuth();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [cachedToken, setCachedToken] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activeSession, setActiveSession] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('active');
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [focusLoading, setFocusLoading] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [showInvite, setShowInvite] = useState(false);
  const [claudeConnected, setClaudeConnected] = useState<boolean | null>(null);
  const [plan, setPlan] = useState<string>('free');
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live timer tick
  useEffect(() => {
    if (activeSession) {
      timerRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeSession]);

  // Load workspaces + Claude connection status once
  useEffect(() => {
    const load = async () => {
      const token = await getToken();
      if (!token) { setLoading(false); return; }
      try {
        const [meRes, claudeRes] = await Promise.all([
          fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/auth/claude-status`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        setCachedToken(token);
        if (meRes.ok) {
          const { data } = await meRes.json();
          const list: Workspace[] = data.workspaces ?? [];
          setWorkspaces(list);
          const personal = list.find((w) => w.type === 'personal') ?? list[0];
          if (personal) setWorkspaceId(personal.id);
          else setLoading(false); // no workspace → stop skeleton
        } else {
          setLoading(false); // API error → stop skeleton
        }
        if (claudeRes.ok) {
          const { data } = await claudeRes.json();
          setClaudeConnected(data.connected);
          setPlan(data.plan ?? 'free');
        }
      } catch {
        setLoading(false); // network error (SSL, offline) → stop skeleton
      }
    };
    load();
  }, [getToken]);

  const fetchWorkspaceData = useCallback(async (wsId: string) => {
    const token = await getToken();
    if (!token || !wsId) return;
    setLoading(true);
    try {
      const [list, acts, projs] = await Promise.all([
        getTasks(wsId, token),
        getActivities(wsId, token),
        fetch(`${API_URL}/projects?workspace_id=${wsId}`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.ok ? r.json() : { data: [] })
          .then(b => b.data),
      ]);
      setTasks(list);
      setActivities(acts);
      setProjects(projs);
      const ongoing = acts.find((a) => !a.end_time) ?? null;
      setActiveSession(ongoing);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (workspaceId) fetchWorkspaceData(workspaceId);
  }, [workspaceId, fetchWorkspaceData]);

  const switchWorkspace = (id: string) => {
    if (id === workspaceId) return;
    setTasks([]);
    setActivities([]);
    setActiveSession(null);
    setFilter('active');
    setWorkspaceId(id);
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const token = await getToken();
    if (!token) return;
    setCreating(true);
    try {
      const task = await createTask(workspaceId, newTitle.trim(), token);
      setTasks((prev) => [task, ...prev]);
      setNewTitle('');
    } catch { /* ignore */ } finally { setCreating(false); }
  };

  const cycleStatus = async (task: Task) => {
    const next: Record<Task['status'], Task['status']> = {
      planned: 'in_progress', in_progress: 'done', done: 'planned', archived: 'planned',
    };
    const newStatus = next[task.status];
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
    const token = await getToken();
    if (!token) return;
    try {
      await updateTask(task.id, { status: newStatus }, token);
    } catch {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)));
    }
  };

  const handleStartFocus = async (taskId: string) => {
    const token = await getToken();
    if (!token || !workspaceId) return;
    setFocusLoading(taskId);
    try {
      if (activeSession) await stopActivity(workspaceId, token, activeSession.id);
      const act = await startActivity(workspaceId, token, taskId);
      setActiveSession(act);
      setActivities((prev) => [act, ...prev.filter((a) => a.end_time)]);
    } catch { /* ignore */ } finally { setFocusLoading(null); }
  };

  const handleStopFocus = async () => {
    const token = await getToken();
    if (!token || !workspaceId || !activeSession) return;
    setFocusLoading('stop');
    try {
      const stopped = await stopActivity(workspaceId, token, activeSession.id);
      setActiveSession(null);
      if (stopped) {
        setActivities((prev) => prev.map((a) => a.id === stopped.id ? stopped : a));
      }
    } catch { /* ignore */ } finally { setFocusLoading(null); }
  };

  const filtered = tasks.filter((t) => {
    const matchesFilter = filter === 'active'
      ? t.status !== 'done' && t.status !== 'archived'
      : filter === 'done'
      ? t.status === 'done'
      : t.status !== 'archived';
    const matchesProject = projectFilter === null || (t as any).project_id === projectFilter;
    return matchesFilter && matchesProject;
  });

  const counts = {
    total: tasks.filter((t) => t.status !== 'archived').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    done: tasks.filter((t) => t.status === 'done').length,
  };

  const trackedSeconds = totalSeconds(activities, activeSession?.start_time);
  const activeTask = activeSession?.task_id ? tasks.find((t) => t.id === activeSession.task_id) : null;
  const lastActivity = activities.filter((a) => a.end_time).sort((a, b) =>
    new Date(b.end_time!).getTime() - new Date(a.end_time!).getTime()
  )[0];

  const displayName = user?.firstName || user?.emailAddresses[0]?.emailAddress?.split('@')[0] || 'there';
  const sessionSeconds = activeSession
    ? Math.floor((Date.now() - new Date(activeSession.start_time).getTime()) / 1000)
    : 0;
  void tick;

  const currentWorkspace = workspaces.find((w) => w.id === workspaceId);
  const isTeam = currentWorkspace?.type === 'team';
  const canInvite = isTeam && (currentWorkspace?.role === 'owner' || currentWorkspace?.role === 'admin');

  return (
    <div style={{ background: 'var(--bg)' }}>
      {showInvite && (
        <InviteModal workspaceId={workspaceId} onClose={() => setShowInvite(false)} />
      )}

      <div className="max-w-3xl mx-auto px-8 py-8">

        {/* ── Workspace switcher ────────────────── */}
        {workspaces.length > 1 && (
          <div className="flex items-center gap-2 mb-6">
            <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--surface)' }}>
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => switchWorkspace(ws.id)}
                  className="px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5"
                  style={{
                    background: workspaceId === ws.id ? 'var(--surface-2)' : 'transparent',
                    color: workspaceId === ws.id ? 'var(--text)' : 'var(--muted)',
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: workspaceId === ws.id ? 'var(--accent)' : 'var(--subtle)' }}
                  />
                  {ws.name}
                </button>
              ))}
            </div>

            {isTeam && (
              <Link
                href="/dashboard/team"
                className="text-xs px-3 py-1.5 rounded-lg border transition-all"
                style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
              >
                Team view →
              </Link>
            )}

            {canInvite && (
              <button
                onClick={() => setShowInvite(true)}
                className="text-xs px-3 py-1.5 rounded-lg border transition-all ml-auto"
                style={{ borderColor: 'rgba(59,130,246,0.3)', color: 'var(--accent)', background: 'rgba(59,130,246,0.05)' }}
              >
                + Invite
              </button>
            )}
          </div>
        )}

        {/* When only one workspace but it's a team — still show Invite and Team view */}
        {workspaces.length === 1 && isTeam && (
          <div className="flex items-center gap-2 mb-6 justify-end">
            <Link
              href="/dashboard/team"
              className="text-xs px-3 py-1.5 rounded-lg border transition-all"
              style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
            >
              Team view →
            </Link>
            {canInvite && (
              <button
                onClick={() => setShowInvite(true)}
                className="text-xs px-3 py-1.5 rounded-lg border transition-all"
                style={{ borderColor: 'rgba(59,130,246,0.3)', color: 'var(--accent)', background: 'rgba(59,130,246,0.05)' }}
              >
                + Invite
              </button>
            )}
          </div>
        )}

        {/* ── Greeting + meta ───────────────────── */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <h1 className="font-display text-2xl font-bold">Good work, {displayName}.</h1>

            {/* Claude connection badge */}
            {claudeConnected === true && (
              <span
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.2)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#22C55E' }} />
                Claude connected
              </span>
            )}
            {claudeConnected === false && (
              <Link
                href="/onboarding"
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-all"
                style={{ background: 'rgba(59,130,246,0.07)', color: 'var(--accent)', border: '1px solid rgba(59,130,246,0.2)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)', opacity: 0.5 }} />
                Connect Claude →
              </Link>
            )}

            {/* Plan badge */}
            {plan === 'free' && (
              <a
                href="/#pricing"
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--subtle)', border: '1px solid rgba(255,255,255,0.07)' }}
                title="Upgrade to Pro for unlimited tasks"
              >
                Free
              </a>
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
          <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--muted)' }}>
            <span>
              Tracked today:{' '}
              <span style={{ color: trackedSeconds > 0 ? 'var(--text)' : 'var(--muted)' }}>
                {loading ? '—' : trackedSeconds > 0 ? formatDuration(trackedSeconds) : '0m'}
              </span>
            </span>
            {lastActivity && (
              <span>
                Last activity:{' '}
                <span style={{ color: 'var(--text)' }}>{formatTime(lastActivity.end_time!)}</span>
              </span>
            )}
          </div>
        </div>

        {/* ── Today's Focus ─────────────────────── */}
        <div
          className="card px-4 py-4 mb-6 flex items-center gap-4"
          style={{
            borderColor: activeSession ? 'rgba(59,130,246,0.3)' : 'var(--border)',
            background: activeSession ? 'rgba(59,130,246,0.04)' : 'var(--surface)',
          }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: activeSession ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)' }}
          >
            {activeSession ? (
              <span style={{ color: '#3B82F6', fontSize: 16 }}>⏱</span>
            ) : (
              <span style={{ color: 'var(--subtle)', fontSize: 14 }}>◎</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {activeSession ? (
              <>
                <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--accent)' }}>
                  Focus session active
                </p>
                <p className="text-sm truncate" style={{ color: 'var(--text)' }}>
                  {activeTask?.title ?? 'General focus'}
                  <span className="ml-2 font-mono text-xs" style={{ color: 'var(--muted)' }}>
                    {formatDuration(sessionSeconds)}
                  </span>
                </p>
              </>
            ) : (
              <>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>No active focus session</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>
                  Hit ▶ on a task to start tracking
                </p>
              </>
            )}
          </div>

          {activeSession && (
            <button
              onClick={handleStopFocus}
              disabled={focusLoading === 'stop'}
              className="shrink-0 text-xs px-3 py-1.5 rounded-lg border transition-all"
              style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#FCA5A5', background: 'rgba(239,68,68,0.07)' }}
            >
              {focusLoading === 'stop' ? '…' : '■ Stop'}
            </button>
          )}
        </div>

        {/* ── Stats ─────────────────────────────── */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total', value: counts.total },
            { label: 'In progress', value: counts.inProgress, highlight: true },
            { label: 'Completed', value: counts.done },
            { label: 'Time today', value: loading ? '—' : trackedSeconds > 0 ? formatDuration(trackedSeconds) : '—', small: true },
          ].map(({ label, value, highlight, small }) => (
            <div key={label} className="card px-3 py-3">
              <div
                className={`font-display font-bold mb-0.5 ${small ? 'text-lg' : 'text-2xl'}`}
                style={{ color: highlight ? 'var(--accent)' : 'var(--text)' }}
              >
                {loading ? '—' : value}
              </div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Activity heatmap ──────────────────── */}
        {workspaceId && cachedToken && (
          <ActivityHeatmap workspaceId={workspaceId} token={cachedToken} />
        )}

        {/* ── Free tier limit warning ───────────── */}
        {plan === 'free' && counts.total >= 45 && (
          <div
            className="rounded-xl px-4 py-3 mb-5 flex items-center justify-between"
            style={{ background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)' }}
          >
            <div className="text-xs" style={{ color: '#EAB308' }}>
              {counts.total >= 50
                ? '⚠ Task limit reached (50/50). Upgrade to add more.'
                : `⚠ Approaching free limit (${counts.total}/50 tasks).`}
            </div>
            <a
              href="mailto:hello@tendon.alashed.kz?subject=Pro plan"
              className="text-xs px-3 py-1 rounded-lg ml-4 shrink-0"
              style={{ background: 'rgba(234,179,8,0.15)', color: '#EAB308' }}
            >
              Upgrade →
            </a>
          </div>
        )}

        {/* ── Connect Claude / Claude tip ───────── */}
        {!loading && tasks.length === 0 ? (
          <div
            className="rounded-xl p-5 mb-6 flex items-start gap-4"
            style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: 'rgba(59,130,246,0.15)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>Connect Claude Code to get started</p>
              <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
                Run one command and Claude will create tasks, track your time, and help you stay focused.
              </p>
              <Link href="/onboarding" className="amber-btn text-xs px-4 py-2 rounded-lg inline-flex">
                See setup instructions →
              </Link>
            </div>
          </div>
        ) : (
          <div
            className="flex items-start gap-3 px-4 py-3 rounded-lg text-sm mb-6"
            style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.1)' }}
          >
            <span style={{ color: 'var(--accent)' }} className="mt-0.5 shrink-0">✦</span>
            <div style={{ color: 'var(--muted)' }} className="text-xs">
              Ask Claude:{' '}
              <span style={{ color: 'var(--text)' }}>&ldquo;What should I focus on today?&rdquo;</span>
              {' '}·{' '}
              <span style={{ color: 'var(--text)' }}>&ldquo;Start a focus session on the auth bug&rdquo;</span>
            </div>
          </div>
        )}

        {/* ── Add task ──────────────────────────── */}
        <form onSubmit={addTask} className="flex gap-2 mb-5">
          <input
            type="text"
            className="input flex-1"
            placeholder="Quick add a task…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <button
            type="submit"
            className="amber-btn px-5 py-2.5 rounded-lg text-sm shrink-0"
            disabled={creating || !newTitle.trim()}
          >
            {creating ? '…' : '+ Add'}
          </button>
        </form>

        {/* ── Filter tabs ───────────────────────── */}
        <div className="flex gap-1 mb-4 p-1 rounded-lg w-fit" style={{ background: 'var(--surface)' }}>
          {(['active', 'done', 'all'] as Filter[]).map((val) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className="px-4 py-1.5 rounded text-xs font-medium transition-all"
              style={{
                background: filter === val ? 'var(--surface-2)' : 'transparent',
                color: filter === val ? 'var(--text)' : 'var(--muted)',
              }}
            >
              {val === 'active' ? 'Active' : val === 'done' ? 'Completed' : 'All'}
            </button>
          ))}
        </div>

        {/* ── Project filter ────────────────────── */}
        {projects.length > 0 && (
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            <button
              onClick={() => setProjectFilter(null)}
              className="px-2.5 py-1 rounded text-xs transition-all"
              style={{
                background: projectFilter === null ? 'var(--surface-2)' : 'transparent',
                color: projectFilter === null ? 'var(--text)' : 'var(--subtle)',
                border: '1px solid',
                borderColor: projectFilter === null ? 'rgba(59,130,246,0.3)' : 'transparent',
              }}
            >
              All
            </button>
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => setProjectFilter(p.id === projectFilter ? null : p.id)}
                className="px-2.5 py-1 rounded text-xs transition-all"
                style={{
                  background: projectFilter === p.id ? 'rgba(59,130,246,0.1)' : 'transparent',
                  color: projectFilter === p.id ? 'var(--accent)' : 'var(--subtle)',
                  border: '1px solid',
                  borderColor: projectFilter === p.id ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.06)',
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {/* ── Task list ─────────────────────────── */}
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card h-[52px] animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14" style={{ color: 'var(--muted)' }}>
            <div className="text-3xl mb-3" style={{ opacity: 0.2 }}>◎</div>
            <p className="text-sm">
              {filter === 'done' ? 'No completed tasks yet.' : 'No active tasks. Add one above or ask Claude.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((task) => {
              const isActive = activeSession?.task_id === task.id;
              return (
                <div
                  key={task.id}
                  className="card flex items-center gap-3 px-4 py-3 group"
                  style={{ borderColor: isActive ? 'rgba(59,130,246,0.3)' : undefined }}
                >
                  <button
                    onClick={() => cycleStatus(task)}
                    className="shrink-0 transition-transform hover:scale-125"
                    title={`${task.status} — click to advance`}
                  >
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_DOT[task.status] }} />
                  </button>

                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm truncate"
                      style={{
                        color: task.status === 'done' ? 'var(--muted)' : 'var(--text)',
                        textDecoration: task.status === 'done' ? 'line-through' : 'none',
                        textDecorationColor: 'var(--subtle)',
                      }}
                    >
                      {task.title}
                    </p>
                    {(task as any).project_name && (
                      <span className="text-xs mt-0.5 block" style={{ color: 'var(--subtle)' }}>
                        {(task as any).project_name}
                      </span>
                    )}
                  </div>

                  {task.priority && (
                    <span className="text-xs px-2 py-0.5 rounded shrink-0 font-medium" style={PRIORITY_BADGE[task.priority]}>
                      {task.priority}
                    </span>
                  )}

                  {task.status !== 'done' && task.status !== 'archived' && (
                    <button
                      onClick={() => isActive ? handleStopFocus() : handleStartFocus(task.id)}
                      disabled={focusLoading === task.id || focusLoading === 'stop'}
                      className="shrink-0 text-xs px-2.5 py-1 rounded-lg border transition-all opacity-0 group-hover:opacity-100"
                      style={isActive
                        ? { borderColor: 'rgba(239,68,68,0.3)', color: '#FCA5A5', background: 'rgba(239,68,68,0.07)' }
                        : { borderColor: 'rgba(59,130,246,0.25)', color: 'var(--accent)', background: 'rgba(59,130,246,0.06)' }
                      }
                    >
                      {focusLoading === task.id ? '…' : isActive ? '■' : '▶'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Today's log ───────────────────────── */}
        {activities.length > 0 && (
          <div className="mt-8">
            <p className="text-xs font-medium mb-3 uppercase tracking-wide" style={{ color: 'var(--subtle)' }}>
              Today&apos;s log
            </p>
            <div className="space-y-1">
              {[...activities]
                .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
                .slice(0, 8)
                .map((act) => {
                  const t = tasks.find((t) => t.id === act.task_id);
                  const dur = act.end_time
                    ? Math.floor((new Date(act.end_time).getTime() - new Date(act.start_time).getTime()) / 1000)
                    : null;
                  return (
                    <div key={act.id} className="flex items-center gap-3 py-1.5">
                      <span className="text-xs font-mono shrink-0 w-10" style={{ color: 'var(--subtle)' }}>
                        {formatTime(act.start_time)}
                      </span>
                      <div
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: act.end_time ? '#22C55E' : '#3B82F6' }}
                      />
                      <span className="text-xs flex-1 truncate" style={{ color: 'var(--muted)' }}>
                        {act.end_time ? 'Focused on' : 'Focusing on'}{' '}
                        <span style={{ color: 'var(--text)' }}>{t?.title ?? 'General'}</span>
                      </span>
                      {dur !== null && (
                        <span className="text-xs shrink-0 font-mono" style={{ color: 'var(--subtle)' }}>
                          {formatDuration(dur)}
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
