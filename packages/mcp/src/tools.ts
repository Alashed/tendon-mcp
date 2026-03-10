import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from './api-client.js';
import type { Task, Activity } from '@alashed/shared';

// ── ASCII helpers ─────────────────────────────────────────────────────────────

function fmtTime(minutes: number): string {
  if (minutes === 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}`.trim() : `${m}m`;
}

function bar(minutes: number, maxMinutes = 480, width = 12): string {
  const pct = Math.min(minutes / maxMinutes, 1);
  const filled = Math.round(pct * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function pad(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length);
}

const PRIO_ICON: Record<string, string> = { high: '!!', medium: ' !', low: '  ' };
const STATUS_ICON: Record<string, string> = {
  planned: '○', in_progress: '●', done: '✓', archived: '×',
};

function header(title: string): string {
  const line = '─'.repeat(title.length + 4);
  return `╭${line}╮\n│  ${title}  │\n╰${line}╯`;
}

function section(icon: string, label: string): string {
  return `\n${icon} ${label}`;
}

function taskLine(t: { title: string; priority: string }, prefix = '  ├─', isLast = false): string {
  const p = prefix.replace('├', isLast ? '└' : '├');
  const prio = PRIO_ICON[t.priority] ?? '  ';
  return `${p} ${pad(t.title, 36)} [${prio}]`;
}

// ── Tools ─────────────────────────────────────────────────────────────────────

export function registerTools(server: McpServer, api: ApiClient, workspaceId: string, userId: string): void {

  server.tool(
    'whoami',
    'Verify the connection to Tendon and show your current workspace, user info, and task counts. Call this first to confirm everything is working.',
    {},
    async () => {
      const me = await api.get<{
        user: { name: string; email: string };
        workspaces: Array<{ id: string; name: string; type: string; role: string }>;
      }>('/auth/me');

      const workspace = me.workspaces.find(w => w.id === workspaceId) ?? me.workspaces[0];

      const [inProgress, planned] = await Promise.all([
        api.get<unknown[]>(`/tasks?workspace_id=${workspaceId}&status=in_progress`),
        api.get<unknown[]>(`/tasks?workspace_id=${workspaceId}&status=planned`),
      ]);

      const lines = [
        header('✓ Connected to Tendon'),
        '',
        `  User      : ${me.user.name} <${me.user.email}>`,
        `  Workspace : ${workspace?.name ?? workspaceId}`,
        `  Role      : ${workspace?.role ?? 'member'}`,
        '',
        `  Tasks in progress : ${inProgress.length}`,
        `  Tasks planned     : ${planned.length}`,
        '',
        `  Say "start my day" or "get today's plan" to get started.`,
      ];

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );

  server.tool(
    'create_task',
    'Create a new task in your workspace',
    {
      title: z.string().min(1).describe('Task title'),
      description: z.string().optional().describe('Optional description'),
      priority: z.enum(['low', 'medium', 'high']).optional().describe('Priority (default: medium)'),
      due_date: z.string().optional().describe('Due date YYYY-MM-DD'),
      project_id: z.string().optional().describe('Project UUID'),
    },
    async ({ title, description, priority, due_date, project_id }) => {
      const task = await api.post<Task>('/tasks', {
        workspace_id: workspaceId,
        title, description, priority, due_date, project_id,
        source: 'claude',
      });
      const lines = [
        `✓  Task created`,
        `   ${task.title}`,
        `   Priority : ${task.priority}`,
        `   Status   : ${task.status}`,
        `   ID       : ${task.id}`,
      ];
      if (task.due_date) lines.push(`   Due      : ${task.due_date}`);
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );

  server.tool(
    'list_tasks',
    'List tasks in your workspace',
    {
      status: z.enum(['planned', 'in_progress', 'done']).optional().describe('Filter by status'),
    },
    async ({ status }) => {
      const tasks = await api.get<Task[]>(`/tasks?workspace_id=${workspaceId}${status ? `&status=${status}` : ''}`);
      if (!tasks.length) {
        return { content: [{ type: 'text' as const, text: '○  No tasks found.' }] };
      }

      const label = status ? `${STATUS_ICON[status] ?? '○'} ${status.toUpperCase().replace('_', ' ')} (${tasks.length})` : `Tasks  (${tasks.length})`;
      const lines = [header(label)];

      const grouped: Record<string, Task[]> = { in_progress: [], planned: [], done: [] };
      for (const t of tasks) {
        (grouped[t.status] ?? grouped['planned']!).push(t);
      }

      const order = status ? [status] : ['in_progress', 'planned', 'done'];
      for (const s of order) {
        const group = grouped[s] ?? [];
        if (!group.length) continue;
        if (!status) lines.push(section(STATUS_ICON[s] ?? '○', s.replace('_', ' ')));
        group.forEach((t, i) => lines.push(taskLine(t, '  ├─', i === group.length - 1)));
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );

  server.tool(
    'update_task_status',
    'Update the status of a task',
    {
      task_id: z.string().describe('Task UUID'),
      status: z.enum(['planned', 'in_progress', 'done']).describe('New status'),
    },
    async ({ task_id, status }) => {
      const task = await api.patch<Task>(`/tasks/${task_id}`, { status });
      const prev = Object.keys(STATUS_ICON).find(s => s !== status) ?? '?';
      void prev;
      return {
        content: [{
          type: 'text' as const,
          text: `✓  ${task.title}\n   → ${status.replace('_', ' ')}`,
        }],
      };
    },
  );

  server.tool(
    'start_focus_session',
    'Start a focus/time tracking session on a task (auto-stops any current session)',
    {
      task_id: z.string().optional().describe('Task UUID to focus on'),
    },
    async ({ task_id }) => {
      const activity = await api.post<Activity>('/activities/start', {
        workspace_id: workspaceId,
        task_id,
        source: 'claude',
      });

      let taskTitle = 'General focus';
      if (task_id) {
        try {
          const t = await api.get<Task>(`/tasks/${task_id}`);
          taskTitle = t.title;
        } catch { /* ignore */ }
      }

      const lines = [
        `▶  Focus started`,
        `   Task  : ${taskTitle}`,
        `   Since : ${new Date(activity.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        `   ID    : ${activity.id}`,
      ];
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );

  server.tool(
    'stop_focus_session',
    'Stop the current focus/time tracking session',
    {},
    async () => {
      const activity = await api.post<Activity | null>('/activities/stop', { workspace_id: workspaceId });
      if (!activity) {
        return { content: [{ type: 'text' as const, text: '○  No active session to stop.' }] };
      }

      const mins = activity.end_time
        ? Math.round((new Date(activity.end_time).getTime() - new Date(activity.start_time).getTime()) / 60000)
        : 0;

      const lines = [
        `■  Session stopped`,
        `   Duration : ${fmtTime(mins)}`,
        `   From     : ${new Date(activity.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        `   To       : ${activity.end_time ? new Date(activity.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'now'}`,
      ];
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );

  server.tool(
    'get_today_plan',
    'Get your tasks and time tracked today',
    {},
    async () => {
      const today = new Date().toISOString().split('T')[0]!;
      const dayLabel = new Date().toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });

      const [inProgress, planned, activities] = await Promise.all([
        api.get<Task[]>(`/tasks?workspace_id=${workspaceId}&status=in_progress`),
        api.get<Task[]>(`/tasks?workspace_id=${workspaceId}&status=planned`),
        api.get<Activity[]>(`/activities?workspace_id=${workspaceId}&date=${today}`),
      ]);

      const totalMins = activities.reduce((sum, a) => {
        const end = a.end_time ? new Date(a.end_time) : new Date();
        return sum + Math.round((end.getTime() - new Date(a.start_time).getTime()) / 60000);
      }, 0);

      const lines = [
        header(`📅 Today — ${dayLabel}`),
        '',
        `  ⏱  ${fmtTime(totalMins)}  ${bar(totalMins)}  ${activities.length} session${activities.length !== 1 ? 's' : ''}`,
      ];

      if (inProgress.length > 0) {
        lines.push(section('●', `IN PROGRESS  (${inProgress.length})`));
        inProgress.forEach((t, i) => lines.push(taskLine(t, '  ├─', i === inProgress.length - 1)));
      }

      if (planned.length > 0) {
        const shown = planned.slice(0, 7);
        const rest = planned.length - shown.length;
        lines.push(section('○', `PLANNED  (${planned.length})`));
        shown.forEach((t, i) => lines.push(taskLine(t, '  ├─', i === shown.length - 1 && rest === 0)));
        if (rest > 0) lines.push(`  └─ ... +${rest} more`);
      }

      if (inProgress.length === 0 && planned.length === 0) {
        lines.push('\n  No tasks yet. Ask me to create some!');
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );

  server.tool(
    'update_task',
    'Edit a task — change title, description, priority, or due date',
    {
      task_id: z.string().describe('Task UUID'),
      title: z.string().optional().describe('New title'),
      description: z.string().optional().describe('New description'),
      priority: z.enum(['low', 'medium', 'high']).optional().describe('New priority'),
      due_date: z.string().optional().describe('New due date YYYY-MM-DD'),
    },
    async ({ task_id, title, description, priority, due_date }) => {
      const updates: Record<string, unknown> = {};
      if (title !== undefined) updates['title'] = title;
      if (description !== undefined) updates['description'] = description;
      if (priority !== undefined) updates['priority'] = priority;
      if (due_date !== undefined) updates['due_date'] = due_date;

      const task = await api.patch<Task>(`/tasks/${task_id}`, updates);
      const changed = Object.keys(updates).join(', ');
      return {
        content: [{
          type: 'text' as const,
          text: `✓  Task updated\n   ${task.title}\n   Changed : ${changed}`,
        }],
      };
    },
  );

  server.tool(
    'archive_task',
    'Archive (delete) a task — removes it from your active list',
    {
      task_id: z.string().describe('Task UUID to archive'),
    },
    async ({ task_id }) => {
      const task = await api.get<Task>(`/tasks/${task_id}`);
      await api.patch<Task>(`/tasks/${task_id}`, { status: 'archived' });
      return {
        content: [{
          type: 'text' as const,
          text: `×  Task archived\n   ${task.title}`,
        }],
      };
    },
  );

  server.tool(
    'week_summary',
    'Get a summary of the last 7 days — focus time, tasks done, productivity patterns',
    {},
    async () => {
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0]!;
      });

      const results = await Promise.all(
        days.map(date =>
          api.get<{
            date: string;
            users: Array<{
              focus_minutes: number;
              session_count: number;
              tasks_done_today: Array<{ title: string }>;
              tasks_in_progress: Array<{ title: string }>;
            }>;
            totals: { total_focus_minutes: number; total_done_today: number };
          }>(`/reports/daily?workspace_id=${workspaceId}&date=${date}&user_id=${userId}`)
          .catch(() => null),
        ),
      );

      let totalMins = 0;
      let totalDone = 0;
      let bestDay = { date: '', minutes: 0 };
      const dayLines: string[] = [];

      for (let i = 0; i < days.length; i++) {
        const date = days[i]!;
        const r = results[i];
        const me = r?.users?.[0];
        const mins = me?.focus_minutes ?? 0;
        const done = r?.totals?.total_done_today ?? 0;

        totalMins += mins;
        totalDone += done;
        if (mins > bestDay.minutes) bestDay = { date, minutes: mins };

        const dayLabel = new Date(date + 'T12:00:00Z').toLocaleDateString('en', {
          weekday: 'short', month: 'short', day: 'numeric',
        });
        const b = bar(mins, 480, 8);
        const sessions = me?.session_count ?? 0;
        const doneStr = done > 0 ? `  ✓${done}` : '    ';
        dayLines.push(`  ${pad(dayLabel, 14)} ${b}  ${pad(fmtTime(mins), 7)} ${doneStr}  ${sessions}sess`);
      }

      const avgMins = Math.round(totalMins / 7);
      const bestLabel = bestDay.date
        ? new Date(bestDay.date + 'T12:00:00Z').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })
        : '—';

      const lines = [
        header('Weekly Summary — last 7 days'),
        '',
        `  ⏱  Total   ${fmtTime(totalMins)}   avg ${fmtTime(avgMins)}/day`,
        `  ✓  Done    ${totalDone} tasks`,
        `  ★  Best    ${bestLabel}  (${fmtTime(bestDay.minutes)})`,
        '',
        `  ${'Day           '}  Focus           Time     Done Sess`,
        `  ${'─'.repeat(56)}`,
        ...dayLines,
      ];

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );

  server.tool(
    'log_blocker',
    'Log a blocker or note for a task',
    {
      task_id: z.string().describe('Task UUID'),
      text: z.string().describe('Blocker description'),
    },
    async ({ task_id, text }) => {
      const task = await api.get<Task>(`/tasks/${task_id}`);
      const existing = task.description ? task.description + '\n' : '';
      await api.patch<Task>(`/tasks/${task_id}`, { description: `${existing}[BLOCKER] ${text}` });
      return {
        content: [{
          type: 'text' as const,
          text: `⚠  Blocker logged\n   Task : ${task.title}\n   Note : ${text}`,
        }],
      };
    },
  );

  server.tool(
    'get_daily_summary',
    'Get a summary of work done on a specific date (default: today). Use date="yesterday" or YYYY-MM-DD.',
    {
      date: z.string().optional().describe('Date as YYYY-MM-DD or "yesterday" (default: today)'),
    },
    async ({ date }) => {
      let resolvedDate: string;
      if (!date || date === 'today') {
        resolvedDate = new Date().toISOString().split('T')[0]!;
      } else if (date === 'yesterday') {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        resolvedDate = d.toISOString().split('T')[0]!;
      } else {
        resolvedDate = date;
      }

      const report = await api.get<{
        date: string;
        users: Array<{
          user_name: string;
          focus_minutes: number;
          session_count: number;
          tasks_done_today: Array<{ id: string; title: string; priority: string }>;
          tasks_in_progress: Array<{ id: string; title: string; priority: string }>;
          tasks_planned: Array<{ id: string; title: string; priority: string }>;
        }>;
      }>(`/reports/daily?workspace_id=${workspaceId}&date=${resolvedDate}&user_id=${userId}`);

      const me = report.users[0];
      if (!me) {
        return {
          content: [{ type: 'text' as const, text: `○  No activity recorded on ${resolvedDate}.` }],
        };
      }

      const dayLabel = new Date(resolvedDate + 'T12:00:00Z').toLocaleDateString('en', {
        weekday: 'short', month: 'short', day: 'numeric',
      });

      const lines = [
        header(`Daily Summary — ${dayLabel}`),
        '',
        `  ⏱  ${pad(fmtTime(me.focus_minutes), 8)} ${bar(me.focus_minutes)}  ${me.session_count} session${me.session_count !== 1 ? 's' : ''}`,
        `  ✓  ${me.tasks_done_today.length} done today`,
        `  ●  ${me.tasks_in_progress.length} in progress`,
        `  ○  ${me.tasks_planned.length} planned`,
      ];

      if (me.tasks_done_today.length > 0) {
        lines.push(section('✓', `COMPLETED TODAY  (${me.tasks_done_today.length})`));
        me.tasks_done_today.forEach((t, i) =>
          lines.push(taskLine(t, '  ├─', i === me.tasks_done_today.length - 1)));
      }

      if (me.tasks_in_progress.length > 0) {
        lines.push(section('●', `IN PROGRESS  (${me.tasks_in_progress.length})`));
        me.tasks_in_progress.forEach((t, i) =>
          lines.push(taskLine(t, '  ├─', i === me.tasks_in_progress.length - 1)));
      }

      if (me.tasks_planned.length > 0) {
        const shown = me.tasks_planned.slice(0, 5);
        const rest = me.tasks_planned.length - shown.length;
        lines.push(section('○', `STILL PLANNED  (${me.tasks_planned.length})`));
        shown.forEach((t, i) => lines.push(taskLine(t, '  ├─', i === shown.length - 1 && rest === 0)));
        if (rest > 0) lines.push(`  └─ ... +${rest} more`);
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );
}
