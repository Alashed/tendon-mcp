'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getTasks, createTask, updateTask, deleteTask, type Task } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.tendon.alashed.kz';

const STATUS_CYCLE: Record<Task['status'], Task['status']> = {
  planned: 'in_progress',
  in_progress: 'done',
  done: 'planned',
  archived: 'planned',
};

const STATUS_LABEL: Record<Task['status'], string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  done: 'Done',
  archived: 'Archived',
};

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

type FilterStatus = 'all' | Task['status'];

interface Workspace {
  id: string;
  name: string;
  type: 'personal' | 'team';
}

export default function TasksPage() {
  const { getToken } = useAuth();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [deleting, setDeleting] = useState<string | null>(null);

  // Load workspaces once
  useEffect(() => {
    const load = async () => {
      const token = await getToken();
      if (!token) { setLoading(false); return; }
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) { setLoading(false); return; }
        const { data } = await res.json();
        const list: Workspace[] = data.workspaces ?? [];
        setWorkspaces(list);
        const personal = list.find((w) => w.type === 'personal') ?? list[0];
        if (personal) setWorkspaceId(personal.id);
        else setLoading(false);
      } catch { setLoading(false); }
    };
    load();
  }, [getToken]);

  const fetchTasks = useCallback(async (wsId: string) => {
    const token = await getToken();
    if (!token || !wsId) return;
    setLoading(true);
    try {
      const list = await getTasks(wsId, token);
      setTasks(list);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [getToken]);

  useEffect(() => {
    if (workspaceId) fetchTasks(workspaceId);
  }, [workspaceId, fetchTasks]);

  const switchWorkspace = (id: string) => {
    if (id === workspaceId) return;
    setTasks([]);
    setFilter('all');
    setWorkspaceId(id);
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !workspaceId) return;
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
    const newStatus = STATUS_CYCLE[task.status];
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: newStatus } : t));
    const token = await getToken();
    if (!token) return;
    try {
      await updateTask(task.id, { status: newStatus }, token);
    } catch {
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: task.status } : t));
    }
  };

  const removeTask = async (taskId: string) => {
    const token = await getToken();
    if (!token) return;
    setDeleting(taskId);
    try {
      await deleteTask(taskId, token);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch { /* ignore */ } finally { setDeleting(null); }
  };

  const filtered = filter === 'all'
    ? tasks.filter((t) => t.status !== 'archived')
    : tasks.filter((t) => t.status === filter);

  const counts = {
    all: tasks.filter((t) => t.status !== 'archived').length,
    planned: tasks.filter((t) => t.status === 'planned').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    done: tasks.filter((t) => t.status === 'done').length,
  };

  const FILTERS: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: `All (${counts.all})` },
    { key: 'planned', label: `Planned (${counts.planned})` },
    { key: 'in_progress', label: `In Progress (${counts.in_progress})` },
    { key: 'done', label: `Done (${counts.done})` },
  ];

  return (
    <div className="max-w-3xl mx-auto px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold mb-1">Tasks</h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          All tasks across your workspace. Manage and track progress.
        </p>
      </div>

      {/* Workspace switcher */}
      {workspaces.length > 1 && (
        <div className="flex gap-1 p-1 rounded-lg w-fit mb-6" style={{ background: 'var(--surface)' }}>
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
      )}

      {/* Add task */}
      <form onSubmit={addTask} className="flex gap-2 mb-6">
        <input
          type="text"
          className="input flex-1"
          placeholder="Add a new task…"
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
      <div className="flex gap-1 mb-5 p-1 rounded-lg w-fit overflow-x-auto" style={{ background: 'var(--surface)' }}>
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className="px-3 py-1.5 rounded text-xs font-medium transition-all whitespace-nowrap"
            style={{
              background: filter === key ? 'var(--surface-2)' : 'transparent',
              color: filter === key ? 'var(--text)' : 'var(--muted)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Task list */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card h-[52px] animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--muted)' }}>
          <div className="text-4xl mb-3" style={{ opacity: 0.15 }}>◎</div>
          <p className="text-sm">No tasks yet. Add one above or ask Claude.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => (
            <div key={task.id} className="card flex items-center gap-3 px-4 py-3 group">
              {/* Status dot */}
              <button
                onClick={() => cycleStatus(task)}
                className="shrink-0 transition-transform hover:scale-125"
                title={`${STATUS_LABEL[task.status]} — click to advance`}
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_DOT[task.status] }} />
              </button>

              {/* Title */}
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
                <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>
                  {STATUS_LABEL[task.status]}
                  {task.source && task.source !== 'web' && (
                    <span className="ml-2">via {task.source}</span>
                  )}
                </p>
              </div>

              {/* Priority */}
              {task.priority && (
                <span
                  className="text-xs px-2 py-0.5 rounded shrink-0 font-medium"
                  style={PRIORITY_BADGE[task.priority]}
                >
                  {task.priority}
                </span>
              )}

              {/* Delete */}
              <button
                onClick={() => removeTask(task.id)}
                disabled={deleting === task.id}
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-all p-1 rounded"
                style={{ color: 'var(--subtle)' }}
                title="Delete task"
              >
                {deleting === task.id ? (
                  <span className="text-xs">…</span>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
