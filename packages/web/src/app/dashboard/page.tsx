'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useUser, useAuth, UserButton } from '@clerk/nextjs';
import {
  getTasks, createTask, updateTask,
  getActivities, startActivity, stopActivity,
  type Task, type Activity,
} from '@/lib/api';

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

export default function DashboardPage() {
  const { user } = useUser();
  const { getToken } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activeSession, setActiveSession] = useState<Activity | null>(null);
  const [workspaceId, setWorkspaceId] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('active');
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [focusLoading, setFocusLoading] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
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

  const fetchData = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const { data } = await res.json();
      const personal = data.workspaces?.find((w: { type: string }) => w.type === 'personal') ?? data.workspaces?.[0];
      if (!personal) return;

      setWorkspaceId(personal.id);
      const [list, acts] = await Promise.all([
        getTasks(personal.id, token),
        getActivities(personal.id, token),
      ]);
      setTasks(list);
      setActivities(acts);
      const ongoing = acts.find((a) => !a.end_time) ?? null;
      setActiveSession(ongoing);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
  void tick; // used to trigger re-render

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* ── Header ───────────────────────────── */}
      <header
        className="border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10"
        style={{ borderColor: 'var(--border)', background: 'rgba(9,9,11,0.92)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-center gap-6">
          <Link href="/" className="font-display font-bold text-base">
            <span style={{ color: 'var(--accent)' }}>tendon</span>
            <span style={{ color: 'var(--muted)' }}>.</span>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/onboarding"
            className="text-xs px-3 py-1.5 rounded border transition-colors hidden sm:flex items-center gap-1.5"
            style={{ borderColor: 'rgba(59,130,246,0.2)', color: 'var(--accent)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Connect Claude
          </Link>
          <UserButton appearance={{ elements: { avatarBox: { width: 32, height: 32 } } }} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">

        {/* ── Greeting + meta ───────────────── */}
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold mb-1">Good work, {displayName}.</h1>
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

        {/* ── Today's Focus ─────────────────── */}
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

        {/* ── Stats ─────────────────────────── */}
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

        {/* ── Connect Claude / Claude tip ───── */}
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

        {/* ── Add task ──────────────────────── */}
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

        {/* ── Filter tabs ───────────────────── */}
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

        {/* ── Task list ─────────────────────── */}
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

                  {/* Focus button */}
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

        {/* ── Today's log ───────────────────── */}
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
      </main>
    </div>
  );
}
