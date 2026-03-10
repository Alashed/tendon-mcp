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

// ── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useUser();
  const { getToken } = useAuth();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
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
      if (!token) return;
      try {
        const [meRes, claudeRes] = await Promise.all([
          fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/auth/claude-status`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (meRes.ok) {
          const { data } = await meRes.json();
          const list: Workspace[] = data.workspaces ?? [];
          setWorkspaces(list);
          const personal = list.find((w) => w.type === 'personal') ?? list[0];
          if (personal) setWorkspaceId(personal.id);
        }
        if (claudeRes.ok) {
          const { data } = await claudeRes.json();
          setClaudeConnected(data.connected);
        }
      } catch { /* ignore */ }
    };
    load();
  }, [getToken]);

  const fetchWorkspaceData = useCallback(async (wsId: string) => {
    const token = await getToken();
    if (!token || !wsId) return;
    setLoading(true);
    try {
      const [list, acts] = await Promise.all([
        getTasks(wsId, token),
        getActivities(wsId, token),
      ]);
      setTasks(list);
      setActivities(acts);
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
    if (filter === 'active') return t.status !== 'done' && t.status !== 'archived';
    if (filter === 'done') return t.status === 'done';
    return t.status !== 'archived';
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
              <a
                href="/onboarding"
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-all"
                style={{ background: 'rgba(59,130,246,0.07)', color: 'var(--accent)', border: '1px solid rgba(59,130,246,0.2)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)', opacity: 0.5 }} />
                Connect Claude →
              </a>
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
