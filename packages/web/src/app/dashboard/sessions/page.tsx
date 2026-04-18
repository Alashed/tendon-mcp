'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getActivities, getTasks, type Activity, type Task } from '@/lib/api';
import { EmptyState } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.tendon.alashed.kz';
const HEATMAP_DAYS = 91; // ~13 weeks, GitHub-like

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

function formatDurationShort(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isoDay(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

const RECENT_DATES = [0, 1, 2, 3, 4, 5, 6].map((d) => {
  const date = new Date();
  date.setDate(date.getDate() - d);
  return isoDay(date);
});

// Build a flat array of last N day ISO-strings, newest last
function buildHeatmapDates(days: number): string[] {
  const arr: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    arr.push(isoDay(d));
  }
  return arr;
}

// Concurrency-limited parallel fetch
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const result: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      result[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return result;
}

interface Workspace {
  id: string;
  name: string;
  type: 'personal' | 'team';
}

type TabKey = 'overview' | 'timeline' | 'by_task';

export default function SessionsPage() {
  const { getToken } = useAuth();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(RECENT_DATES[0]!);
  const [tab, setTab] = useState<TabKey>('overview');

  // Heatmap data: day → total focus seconds
  const [heatmap, setHeatmap] = useState<Record<string, number>>({});
  const [heatmapLoading, setHeatmapLoading] = useState(false);

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

  const fetchData = useCallback(async (wsId: string, date: string) => {
    const token = await getToken();
    if (!token || !wsId) return;
    setLoading(true);
    try {
      const [taskList, acts] = await Promise.all([
        getTasks(wsId, token),
        getActivities(wsId, token, date),
      ]);
      setTasks(taskList);
      setActivities(acts);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [getToken]);

  // Load heatmap (91 days) in background, once per workspace
  const fetchHeatmap = useCallback(async (wsId: string) => {
    const token = await getToken();
    if (!token || !wsId) return;
    setHeatmapLoading(true);
    const dates = buildHeatmapDates(HEATMAP_DAYS);
    try {
      const results = await mapWithConcurrency(dates, 6, async (d) => {
        try {
          const acts = await getActivities(wsId, token, d);
          const totalSec = acts.reduce((acc, a) => {
            if (!a.end_time) return acc;
            return acc + (new Date(a.end_time).getTime() - new Date(a.start_time).getTime()) / 1000;
          }, 0);
          return [d, totalSec] as const;
        } catch {
          return [d, 0] as const;
        }
      });
      const map: Record<string, number> = {};
      for (const [d, s] of results) map[d] = s;
      setHeatmap(map);
    } finally {
      setHeatmapLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (workspaceId) fetchData(workspaceId, selectedDate);
  }, [workspaceId, selectedDate, fetchData]);

  useEffect(() => {
    if (workspaceId) fetchHeatmap(workspaceId);
  }, [workspaceId, fetchHeatmap]);

  const switchWorkspace = (id: string) => {
    if (id === workspaceId) return;
    setActivities([]);
    setHeatmap({});
    setWorkspaceId(id);
  };

  const completed = activities.filter((a) => a.end_time);
  const totalSec = completed.reduce((acc, a) => {
    return acc + (new Date(a.end_time!).getTime() - new Date(a.start_time).getTime()) / 1000;
  }, 0);

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const byTask = useMemo(() => {
    const m = new Map<string, { label: string; seconds: number; count: number }>();
    for (const act of completed) {
      const key = act.task_id ?? '__general__';
      const label = act.task_id ? (taskMap.get(act.task_id)?.title ?? 'Unknown task') : 'General focus';
      const dur = (new Date(act.end_time!).getTime() - new Date(act.start_time).getTime()) / 1000;
      const existing = m.get(key);
      if (existing) {
        existing.seconds += dur;
        existing.count += 1;
      } else {
        m.set(key, { label, seconds: dur, count: 1 });
      }
    }
    return m;
  }, [completed, taskMap]);

  const taskBreakdown = useMemo(() => [...byTask.values()].sort((a, b) => b.seconds - a.seconds), [byTask]);

  // Heatmap aggregates
  const heatmapStats = useMemo(() => {
    const entries = Object.entries(heatmap);
    const totalAll = entries.reduce((acc, [, s]) => acc + s, 0);
    const activeDays = entries.filter(([, s]) => s > 0).length;
    const maxDay = Math.max(0, ...entries.map(([, s]) => s));
    // current streak (from today backwards while s > 0)
    let streak = 0;
    const today = isoDay(new Date());
    const todayIdx = entries.findIndex(([d]) => d === today);
    if (todayIdx !== -1) {
      for (let i = todayIdx; i >= 0; i--) {
        if ((entries[i]?.[1] ?? 0) > 0) streak++;
        else break;
      }
    }
    // average per active day
    const avgPerActive = activeDays > 0 ? totalAll / activeDays : 0;
    return { totalAll, activeDays, maxDay, streak, avgPerActive };
  }, [heatmap]);

  // Build weeks grid for heatmap (columns = weeks, rows = weekdays)
  const heatmapGrid = useMemo(() => {
    const dates = buildHeatmapDates(HEATMAP_DAYS);
    // Pad beginning so first column starts on Sunday (weekday 0)
    const first = new Date(dates[0]! + 'T12:00:00');
    const pad = first.getDay(); // 0..6
    const cells: (string | null)[] = [];
    for (let i = 0; i < pad; i++) cells.push(null);
    for (const d of dates) cells.push(d);
    const weeks: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return weeks;
  }, []);

  const heatColor = (seconds: number) => {
    if (seconds <= 0) return 'var(--surface-2)';
    const max = Math.max(heatmapStats.maxDay, 3600); // cap at min 1h so early users still see scale
    const ratio = Math.min(1, seconds / max);
    if (ratio < 0.15) return 'rgba(99,102,241,0.18)';
    if (ratio < 0.35) return 'rgba(99,102,241,0.35)';
    if (ratio < 0.6) return 'rgba(99,102,241,0.58)';
    if (ratio < 0.85) return 'rgba(129,140,248,0.82)';
    return 'rgba(165,180,252,1)';
  };

  const firstLoading = loading && activities.length === 0 && Object.keys(heatmap).length === 0;

  return (
    <div>
      {/* ── Sticky page header ─────────────────────────── */}
      <header
        className="sticky top-0 z-20 pt-6 pb-0 border-b backdrop-blur-md"
        style={{ borderColor: 'var(--border)', background: 'rgba(8, 8, 11, 0.78)' }}
      >
        <div className="container-app">
          <div className="flex items-start justify-between gap-6 flex-wrap mb-5">
            <div className="min-w-0">
              <p className="eyebrow mb-1.5">Focus</p>
              <h1 className="heading text-2xl leading-tight tracking-tight flex items-center gap-3">
                Sessions
                <span
                  className="badge"
                  style={{ fontSize: 10, fontWeight: 500, color: 'var(--muted)' }}
                >
                  {heatmapLoading ? 'syncing…' : `${heatmapStats.activeDays} active days`}
                </span>
              </h1>
              <p className="text-sm mt-1.5" style={{ color: 'var(--muted)' }}>
                Where your time actually went. Sync comes from Claude Code &amp; the web.
              </p>
            </div>
            {workspaces.length > 1 && (
              <div className="inline-flex gap-1 p-1 rounded-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => switchWorkspace(ws.id)}
                    className="px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5"
                    style={{
                      background: workspaceId === ws.id ? 'var(--surface-2)' : 'transparent',
                      color: workspaceId === ws.id ? 'var(--text)' : 'var(--muted)',
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: workspaceId === ws.id ? 'var(--accent-light)' : 'var(--dim)' }} />
                    {ws.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* GitHub-style tabs (Issues / PRs / Discussions) */}
          <nav className="flex items-center gap-0 -mb-px">
            {([
              { key: 'overview', label: 'Overview', count: heatmapStats.activeDays },
              { key: 'timeline', label: 'Timeline', count: completed.length },
              { key: 'by_task', label: 'By task', count: byTask.size },
            ] as const).map(({ key, label, count }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className="relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors"
                  style={{
                    color: active ? 'var(--text)' : 'var(--muted)',
                  }}
                >
                  {label}
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[10px] font-mono"
                    style={{
                      background: active ? 'rgba(99,102,241,0.15)' : 'var(--surface-2)',
                      color: active ? 'var(--accent-light)' : 'var(--subtle)',
                      minWidth: 20,
                      textAlign: 'center',
                    }}
                  >
                    {count}
                  </span>
                  {active && (
                    <span
                      className="absolute left-0 right-0 bottom-0 h-0.5"
                      style={{ background: 'var(--accent)' }}
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <div className="container-app py-8">

        {/* ── GitHub-style contribution heatmap (always visible on top) ── */}
        <section className="mb-8">
          <div
            className="rounded-lg overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            {/* Card header */}
            <div
              className="flex items-center justify-between px-5 py-3 border-b"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
            >
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  {formatDurationShort(heatmapStats.totalAll)} of focus
                </h2>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>
                  in the last {HEATMAP_DAYS} days
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--muted)' }}>
                <span className="flex items-center gap-1.5">
                  <span className="font-mono" style={{ color: 'var(--text-soft)' }}>{heatmapStats.streak}</span>
                  day streak
                </span>
                <span className="hidden sm:flex items-center gap-1.5">
                  <span className="font-mono" style={{ color: 'var(--text-soft)' }}>
                    {formatDurationShort(Math.floor(heatmapStats.avgPerActive))}
                  </span>
                  avg/day
                </span>
              </div>
            </div>

            {/* Heatmap grid — fluid, stretches to full card width */}
            <div className="p-5">
              <div
                className="grid w-full"
                style={{
                  gridTemplateColumns: `repeat(${heatmapGrid.length}, minmax(0, 1fr))`,
                  gridAutoRows: '1fr',
                  gap: 'clamp(2px, 0.35vw, 4px)',
                }}
              >
                {heatmapGrid.map((week, wi) => (
                  <div
                    key={wi}
                    className="grid"
                    style={{
                      gridTemplateRows: 'repeat(7, minmax(0, 1fr))',
                      gap: 'clamp(2px, 0.35vw, 4px)',
                    }}
                  >
                    {week.map((day, di) => {
                      if (!day) {
                        return (
                          <div key={di} style={{ aspectRatio: '1 / 1' }} />
                        );
                      }
                      const seconds = heatmap[day] ?? 0;
                      const active = selectedDate === day;
                      const title = `${formatDate(day + 'T12:00:00')} — ${seconds > 0 ? formatDurationShort(Math.floor(seconds)) : 'no focus'}`;
                      return (
                        <button
                          key={di}
                          onClick={() => setSelectedDate(day)}
                          title={title}
                          className="w-full rounded-[2px] transition-all hover:scale-125"
                          style={{
                            aspectRatio: '1 / 1',
                            background: heatColor(seconds),
                            outline: active ? '1.5px solid var(--accent-light)' : '1px solid rgba(255,255,255,0.04)',
                            outlineOffset: active ? 1 : 0,
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                  <span>Less</span>
                  {[0, 900, 3600, 7200, 14400].map((s) => (
                    <span
                      key={s}
                      className="w-[11px] h-[11px] rounded-[2px]"
                      style={{ background: heatColor(s), border: '1px solid rgba(255,255,255,0.04)' }}
                    />
                  ))}
                  <span>More</span>
                </div>
                <span className="text-xs font-mono hidden sm:inline" style={{ color: 'var(--subtle)' }}>
                  {buildHeatmapDates(HEATMAP_DAYS)[0]} → {buildHeatmapDates(HEATMAP_DAYS)[HEATMAP_DAYS - 1]}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Subnav: quick-day picker + selected day label ─────────── */}
        <div
          className="flex items-center justify-between gap-4 mb-5 flex-wrap"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="eyebrow" style={{ marginBottom: 0 }}>Viewing</span>
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {formatDate(selectedDate + 'T12:00:00')}
            </span>
            {selectedDate !== RECENT_DATES[0] && (
              <button
                onClick={() => setSelectedDate(RECENT_DATES[0]!)}
                className="text-xs hover:underline"
                style={{ color: 'var(--accent-light)' }}
              >
                · jump to today
              </button>
            )}
          </div>
          <div
            className="inline-flex gap-1 p-1 rounded-lg overflow-x-auto"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            {RECENT_DATES.map((date, i) => {
              const d = new Date(date + 'T12:00:00');
              const isToday = i === 0;
              const active = selectedDate === date;
              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium transition-all shrink-0"
                  style={{
                    background: active ? 'var(--surface-2)' : 'transparent',
                    color: active ? 'var(--text)' : 'var(--muted)',
                  }}
                >
                  {isToday ? 'Today' : d.toLocaleDateString([], { weekday: 'short', day: 'numeric' })}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Summary stat strip (GitHub-style compact) ─────────────── */}
        <section
          className="grid grid-cols-2 sm:grid-cols-4 gap-0 mb-6 rounded-lg overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {[
            { label: 'Focus time', value: formatDurationShort(Math.floor(totalSec)), tint: 'var(--accent-light)' },
            { label: 'Sessions', value: completed.length, tint: 'var(--text)' },
            { label: 'Tasks touched', value: byTask.size, tint: 'var(--text)' },
            { label: 'Longest block', value: (() => {
              const longest = Math.max(0, ...completed.map((a) =>
                (new Date(a.end_time!).getTime() - new Date(a.start_time).getTime()) / 1000
              ));
              return longest > 0 ? formatDurationShort(Math.floor(longest)) : '—';
            })(), tint: 'var(--text)' },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className="px-5 py-4"
              style={{
                borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
              }}
            >
              <p className="eyebrow mb-2" style={{ fontSize: 10 }}>{stat.label}</p>
              <p
                className="font-display leading-none"
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  color: stat.tint,
                }}
              >
                {stat.value}
              </p>
            </div>
          ))}
        </section>

        {/* ── Tab contents ──────────────────────────────────────────── */}
        {firstLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-14 rounded-lg animate-pulse"
                style={{ animationDelay: `${i * 80}ms`, background: 'var(--surface)', border: '1px solid var(--border)' }}
              />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <EmptyState
            icon={<span style={{ fontSize: 14 }}>⏱</span>}
            title="No sessions on this day"
            description="Pick another square above, or start a focus block from the Overview."
          />
        ) : (
          <>
            {tab === 'overview' && (
              <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Left: timeline table (2/3) */}
                <div className="lg:col-span-2">
                  <TimelineTable
                    activities={activities}
                    taskMap={taskMap}
                    formatTime={formatTime}
                    formatDuration={formatDuration}
                  />
                </div>

                {/* Right: top tasks panel (1/3) */}
                <aside>
                  <div
                    className="rounded-lg overflow-hidden"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                  >
                    <div
                      className="px-4 py-3 border-b flex items-center justify-between"
                      style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
                    >
                      <h3 className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Top tasks</h3>
                      <span className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>
                        {taskBreakdown.length}
                      </span>
                    </div>
                    {taskBreakdown.length === 0 ? (
                      <p className="text-xs px-4 py-5 text-center" style={{ color: 'var(--muted)' }}>
                        No completed sessions yet.
                      </p>
                    ) : (
                      <ul>
                        {taskBreakdown.slice(0, 6).map(({ label, seconds, count }, idx) => {
                          const pct = totalSec > 0 ? Math.round((seconds / totalSec) * 100) : 0;
                          return (
                            <li
                              key={label}
                              className="px-4 py-3"
                              style={{ borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}
                            >
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="text-xs truncate" style={{ color: 'var(--text-soft)' }}>
                                  {label}
                                </span>
                                <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--accent-light)' }}>
                                  {formatDurationShort(Math.floor(seconds))}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${pct}%`,
                                      background: 'linear-gradient(90deg, var(--accent) 0%, var(--accent-2) 100%)',
                                    }}
                                  />
                                </div>
                                <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--muted)' }}>
                                  {pct}% · {count}
                                </span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </aside>
              </section>
            )}

            {tab === 'timeline' && (
              <TimelineTable
                activities={activities}
                taskMap={taskMap}
                formatTime={formatTime}
                formatDuration={formatDuration}
              />
            )}

            {tab === 'by_task' && (
              <div
                className="rounded-lg overflow-hidden"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div
                  className="grid px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider border-b"
                  style={{
                    gridTemplateColumns: '1fr 80px 100px 80px',
                    gap: 12,
                    color: 'var(--subtle)',
                    background: 'var(--surface-2)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <span>Task</span>
                  <span className="text-right">Sessions</span>
                  <span className="text-right">Total</span>
                  <span className="text-right">Share</span>
                </div>
                {taskBreakdown.map(({ label, seconds, count }, idx) => {
                  const pct = totalSec > 0 ? Math.round((seconds / totalSec) * 100) : 0;
                  return (
                    <div
                      key={label}
                      className="grid px-4 py-3 items-center hover:bg-white/[0.02] transition-colors"
                      style={{
                        gridTemplateColumns: '1fr 80px 100px 80px',
                        gap: 12,
                        borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      <span className="text-sm truncate" style={{ color: 'var(--text)' }}>
                        {label}
                      </span>
                      <span className="text-xs font-mono text-right" style={{ color: 'var(--muted)' }}>
                        {count}
                      </span>
                      <span className="text-xs font-mono text-right" style={{ color: 'var(--accent-light)' }}>
                        {formatDurationShort(Math.floor(seconds))}
                      </span>
                      <span className="text-xs font-mono text-right" style={{ color: 'var(--text-soft)' }}>
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Timeline table (GitHub-commit-list style) ──────────────────────
function TimelineTable({
  activities,
  taskMap,
  formatTime,
  formatDuration,
}: {
  activities: Activity[];
  taskMap: Map<string, Task>;
  formatTime: (iso: string) => string;
  formatDuration: (seconds: number) => string;
}) {
  const sorted = [...activities].sort(
    (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
  );

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div
        className="grid px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider border-b"
        style={{
          gridTemplateColumns: '70px 12px 1fr 90px 80px',
          gap: 12,
          color: 'var(--subtle)',
          background: 'var(--surface-2)',
          borderColor: 'var(--border)',
        }}
      >
        <span>Time</span>
        <span />
        <span>Task</span>
        <span className="text-right">Duration</span>
        <span className="text-right">Source</span>
      </div>
      {sorted.map((act, idx) => {
        const task = act.task_id ? taskMap.get(act.task_id) : null;
        const dur = act.end_time
          ? Math.floor((new Date(act.end_time).getTime() - new Date(act.start_time).getTime()) / 1000)
          : null;
        const ongoing = !act.end_time;
        const source = (act as unknown as { source?: string }).source ?? 'web';
        return (
          <div
            key={act.id}
            className="grid px-4 py-3 items-center hover:bg-white/[0.02] transition-colors group"
            style={{
              gridTemplateColumns: '70px 12px 1fr 90px 80px',
              gap: 12,
              borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
            }}
          >
            <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
              {formatTime(act.start_time)}
            </span>
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: ongoing ? 'var(--accent-light)' : 'var(--success)',
                boxShadow: ongoing ? '0 0 6px var(--accent-light)' : undefined,
              }}
            />
            <span className="text-sm truncate" style={{ color: 'var(--text)' }}>
              {task?.title ?? 'General focus'}
            </span>
            <span className="text-xs font-mono text-right" style={{ color: ongoing ? 'var(--accent-light)' : 'var(--text-soft)' }}>
              {ongoing ? '● live' : dur !== null ? formatDuration(dur) : '—'}
            </span>
            <span
              className="text-[10px] font-mono text-right uppercase tracking-wider"
              style={{ color: 'var(--subtle)' }}
            >
              {source}
            </span>
          </div>
        );
      })}
    </div>
  );
}
