'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useUser, useAuth, UserButton } from '@clerk/nextjs';
import { getTasks, createTask, updateTask, type Task } from '@/lib/api';

const STATUS_DOT: Record<Task['status'], string> = {
  planned: '#52525B',
  in_progress: '#F59E0B',
  done: '#22C55E',
  archived: '#3F3F46',
};

const PRIORITY_BADGE: Record<NonNullable<Task['priority']>, { bg: string; color: string }> = {
  high: { bg: 'rgba(239,68,68,0.12)', color: '#FCA5A5' },
  medium: { bg: 'rgba(245,158,11,0.12)', color: '#FCD34D' },
  low: { bg: 'rgba(82,82,91,0.4)', color: '#71717A' },
};

type Filter = 'active' | 'done' | 'all';

export default function DashboardPage() {
  const { user } = useUser();
  const { getToken } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('active');
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

    try {
      // /auth/me upserts the user in our DB and returns their workspace
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/me`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return;
      const { data } = await res.json();
      const personal =
        data.workspaces?.find((w: { type: string }) => w.type === 'personal') ??
        data.workspaces?.[0];
      if (!personal) return;

      setWorkspaceId(personal.id);
      const list = await getTasks(personal.id, token);
      setTasks(list);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const cycleStatus = async (task: Task) => {
    const next: Record<Task['status'], Task['status']> = {
      planned: 'in_progress',
      in_progress: 'done',
      done: 'planned',
      archived: 'planned',
    };
    const newStatus = next[task.status];
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)),
    );
    const token = await getToken();
    if (!token) return;
    try {
      await updateTask(task.id, { status: newStatus }, token);
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)),
      );
    }
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

  const displayName =
    user?.firstName || user?.emailAddresses[0]?.emailAddress?.split('@')[0] || 'there';

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* ── Header ───────────────────────────── */}
      <header
        className="border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10"
        style={{
          borderColor: 'var(--border)',
          background: 'rgba(9,9,11,0.92)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex items-center gap-6">
          <Link href="/" className="font-display font-bold text-base">
            <span style={{ color: 'var(--accent)' }}>alashed</span>
            <span style={{ color: 'var(--muted)' }}>.</span>
          </Link>
          <span className="text-sm hidden sm:block" style={{ color: 'var(--muted)' }}>
            {displayName}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/onboarding"
            className="text-xs px-3 py-1.5 rounded border transition-colors hidden sm:block"
            style={{ borderColor: 'rgba(245,158,11,0.2)', color: 'var(--accent)' }}
          >
            Connect Claude
          </Link>
          <UserButton
            appearance={{
              elements: {
                avatarBox: { width: 32, height: 32 },
              },
            }}
          />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Greeting */}
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold mb-1">
            Good work, {displayName}.
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Here&apos;s what&apos;s on your plate today.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: 'Total tasks', value: counts.total },
            { label: 'In progress', value: counts.inProgress, highlight: true },
            { label: 'Completed', value: counts.done },
          ].map(({ label, value, highlight }) => (
            <div key={label} className="card px-4 py-4">
              <div
                className="font-display text-3xl font-bold mb-1"
                style={{ color: highlight ? 'var(--accent)' : 'var(--text)' }}
              >
                {loading ? '—' : value}
              </div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Claude tip */}
        <div
          className="flex items-start gap-3 px-4 py-3.5 rounded-lg text-sm mb-6"
          style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.13)' }}
        >
          <span style={{ color: 'var(--accent)' }} className="mt-0.5">✦</span>
          <div style={{ color: 'var(--muted)' }}>
            Ask Claude:{' '}
            <span style={{ color: 'var(--text)' }}>&ldquo;What should I focus on today?&rdquo;</span>
            {' '}or{' '}
            <span style={{ color: 'var(--text)' }}>&ldquo;Create a task: fix the login bug, high priority&rdquo;</span>
          </div>
        </div>

        {/* Add task */}
        <form onSubmit={addTask} className="flex gap-2 mb-6">
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

        {/* Filter tabs */}
        <div className="flex gap-1 mb-4 p-1 rounded-lg w-fit" style={{ background: 'var(--surface)' }}>
          {(['active', 'done', 'all'] as Filter[]).map((val) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className="px-4 py-1.5 rounded text-xs font-medium capitalize transition-all"
              style={{
                background: filter === val ? 'var(--surface-2)' : 'transparent',
                color: filter === val ? 'var(--text)' : 'var(--muted)',
              }}
            >
              {val === 'active' ? 'Active' : val === 'done' ? 'Completed' : 'All'}
            </button>
          ))}
        </div>

        {/* Task list */}
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card h-[52px] animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--muted)' }}>
            <div className="text-4xl mb-3" style={{ opacity: 0.3 }}>✦</div>
            <p className="text-sm">
              {filter === 'done'
                ? 'No completed tasks yet.'
                : 'No tasks here. Add one above or ask Claude to create some.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((task) => (
              <div key={task.id} className="card flex items-center gap-3 px-4 py-3.5 group">
                <button
                  onClick={() => cycleStatus(task)}
                  className="shrink-0 transition-transform hover:scale-125"
                  title={`${task.status} — click to advance`}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: STATUS_DOT[task.status] }}
                  />
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
                  <span
                    className="text-xs px-2 py-0.5 rounded shrink-0 font-medium"
                    style={PRIORITY_BADGE[task.priority]}
                  >
                    {task.priority}
                  </span>
                )}

                <span
                  className="text-xs shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--subtle)' }}
                >
                  {task.source}
                </span>
              </div>
            ))}
          </div>
        )}

        {!loading && tasks.length > 0 && (
          <p className="text-xs text-center mt-6" style={{ color: 'var(--subtle)' }}>
            Click the dot to advance task status
          </p>
        )}
      </main>
    </div>
  );
}
