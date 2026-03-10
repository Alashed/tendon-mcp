'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getActivities, getTasks, type Activity, type Task } from '@/lib/api';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const DATES = [0, 1, 2, 3, 4, 5, 6].map((d) => {
  const date = new Date();
  date.setDate(date.getDate() - d);
  return date.toISOString().split('T')[0];
});

export default function SessionsPage() {
  const { getToken } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(DATES[0]);

  const fetchBase = useCallback(async () => {
    const token = await getToken();
    if (!token) { setLoading(false); return null; }
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.tendon.alashed.kz';
      const res = await fetch(`${apiUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setLoading(false); return null; }
      const { data } = await res.json();
      const ws = data.workspaces?.find((w: { type: string }) => w.type === 'personal') ?? data.workspaces?.[0];
      if (!ws) { setLoading(false); return null; }
      setWorkspaceId(ws.id);
      const list = await getTasks(ws.id, token);
      setTasks(list);
      return { ws, token };
    } catch { setLoading(false); return null; }
  }, [getToken]);

  const fetchActivities = useCallback(async (wsId: string, token: string, date: string) => {
    try {
      const acts = await getActivities(wsId, token, date);
      setActivities(acts);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const base = await fetchBase();
      if (!base || cancelled) return;
      await fetchActivities(base.ws.id, base.token, selectedDate);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [fetchBase, fetchActivities, selectedDate]);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const token = await getToken();
      if (!token || cancelled) return;
      await fetchActivities(workspaceId, token, selectedDate);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [selectedDate, workspaceId, getToken, fetchActivities]);

  const completed = activities.filter((a) => a.end_time);
  const totalSec = completed.reduce((acc, a) => {
    return acc + (new Date(a.end_time!).getTime() - new Date(a.start_time).getTime()) / 1000;
  }, 0);

  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  // Group by task
  const byTask = new Map<string, { label: string; seconds: number; count: number }>();
  for (const act of completed) {
    const key = act.task_id ?? '__general__';
    const label = act.task_id ? (taskMap.get(act.task_id)?.title ?? 'Unknown task') : 'General focus';
    const dur = (new Date(act.end_time!).getTime() - new Date(act.start_time).getTime()) / 1000;
    const existing = byTask.get(key);
    if (existing) {
      existing.seconds += dur;
      existing.count += 1;
    } else {
      byTask.set(key, { label, seconds: dur, count: 1 });
    }
  }
  const taskBreakdown = [...byTask.values()].sort((a, b) => b.seconds - a.seconds);

  return (
    <div className="max-w-3xl mx-auto px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold mb-1">Sessions</h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Your focus session history. See where your time goes.
        </p>
      </div>

      {/* Date picker */}
      <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
        {DATES.map((date, i) => {
          const d = new Date(date + 'T12:00:00');
          const isToday = i === 0;
          const active = selectedDate === date;
          return (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
              className="shrink-0 flex flex-col items-center px-3 py-2 rounded-lg border transition-all text-xs"
              style={{
                borderColor: active ? 'rgba(59,130,246,0.4)' : 'var(--border)',
                background: active ? 'rgba(59,130,246,0.08)' : 'var(--surface)',
                color: active ? 'var(--accent)' : 'var(--muted)',
              }}
            >
              <span className="font-medium">{isToday ? 'Today' : d.toLocaleDateString([], { weekday: 'short' })}</span>
              <span style={{ color: active ? 'var(--accent-light)' : 'var(--subtle)', fontSize: 10 }}>
                {d.toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card h-[60px] animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--muted)' }}>
          <div className="text-4xl mb-3" style={{ opacity: 0.15 }}>⏱</div>
          <p className="text-sm">No sessions recorded for this day.</p>
          <p className="text-xs mt-1" style={{ color: 'var(--subtle)' }}>
            Start a focus session from the Overview or via Claude.
          </p>
        </div>
      ) : (
        <>
          {/* Summary bar */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Total time', value: formatDuration(Math.floor(totalSec)) },
              { label: 'Sessions', value: completed.length },
              { label: 'Tasks touched', value: byTask.size },
            ].map(({ label, value }) => (
              <div key={label} className="card px-3 py-3">
                <div className="font-display font-bold text-xl mb-0.5" style={{ color: 'var(--text)' }}>
                  {value}
                </div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Task breakdown */}
          {taskBreakdown.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-medium mb-3 uppercase tracking-wide" style={{ color: 'var(--subtle)' }}>
                Time by task
              </p>
              <div className="space-y-2">
                {taskBreakdown.map(({ label, seconds, count }) => {
                  const pct = Math.round((seconds / totalSec) * 100);
                  return (
                    <div key={label} className="card px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm truncate flex-1 mr-4" style={{ color: 'var(--text)' }}>{label}</span>
                        <span className="text-xs shrink-0 font-mono" style={{ color: 'var(--muted)' }}>
                          {formatDuration(Math.floor(seconds))}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: 'var(--accent)', opacity: 0.7 }}
                          />
                        </div>
                        <span className="text-xs shrink-0" style={{ color: 'var(--subtle)' }}>
                          {count} session{count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Session log */}
          <div>
            <p className="text-xs font-medium mb-3 uppercase tracking-wide" style={{ color: 'var(--subtle)' }}>
              Session log · {formatDate(selectedDate + 'T12:00:00')}
            </p>
            <div className="space-y-1">
              {[...activities]
                .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
                .map((act) => {
                  const task = act.task_id ? taskMap.get(act.task_id) : null;
                  const dur = act.end_time
                    ? Math.floor((new Date(act.end_time).getTime() - new Date(act.start_time).getTime()) / 1000)
                    : null;
                  const ongoing = !act.end_time;
                  return (
                    <div key={act.id} className="flex items-center gap-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-xs font-mono shrink-0 w-10" style={{ color: 'var(--subtle)' }}>
                        {formatTime(act.start_time)}
                      </span>
                      <div
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: ongoing ? '#3B82F6' : '#22C55E' }}
                      />
                      <span className="text-xs flex-1 truncate" style={{ color: 'var(--muted)' }}>
                        {task?.title ?? 'General focus'}
                      </span>
                      {ongoing ? (
                        <span className="text-xs shrink-0 px-2 py-0.5 rounded" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent)' }}>
                          active
                        </span>
                      ) : dur !== null ? (
                        <span className="text-xs font-mono shrink-0" style={{ color: 'var(--subtle)' }}>
                          {formatDuration(dur)}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
