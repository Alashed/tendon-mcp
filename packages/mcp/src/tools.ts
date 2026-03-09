import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from './api-client.js';
import type { Task, Activity } from '@alashed/shared';

export function registerTools(server: McpServer, api: ApiClient, workspaceId: string): void {

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
      return {
        content: [{ type: 'text' as const, text: `✅ Task created: "${task.title}" [${task.priority}] (ID: ${task.id})` }],
      };
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
      if (!tasks.length) return { content: [{ type: 'text' as const, text: 'No tasks found' }] };

      const lines = tasks.map(t => {
        const due = t.due_date ? ` (due: ${t.due_date})` : '';
        return `- [${t.status}] ${t.title} [${t.priority}]${due} — ID: ${t.id}`;
      });
      return { content: [{ type: 'text' as const, text: `Tasks (${tasks.length}):\n${lines.join('\n')}` }] };
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
      return { content: [{ type: 'text' as const, text: `✅ "${task.title}" → ${status}` }] };
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
      return {
        content: [{ type: 'text' as const, text: `⏱ Focus started${task_id ? ' on task' : ''}. Session ID: ${activity.id}` }],
      };
    },
  );

  server.tool(
    'stop_focus_session',
    'Stop the current focus/time tracking session',
    {},
    async () => {
      const activity = await api.post<Activity | null>('/activities/stop', { workspace_id: workspaceId });
      if (!activity) return { content: [{ type: 'text' as const, text: 'No active session' }] };

      const mins = activity.end_time
        ? Math.round((new Date(activity.end_time).getTime() - new Date(activity.start_time).getTime()) / 60000)
        : 0;
      return { content: [{ type: 'text' as const, text: `⏹ Session stopped. Duration: ${mins} min` }] };
    },
  );

  server.tool(
    'get_today_plan',
    'Get your tasks and time tracked today',
    {},
    async () => {
      const today = new Date().toISOString().split('T')[0]!;
      const [inProgress, planned, activities] = await Promise.all([
        api.get<Task[]>(`/tasks?workspace_id=${workspaceId}&status=in_progress`),
        api.get<Task[]>(`/tasks?workspace_id=${workspaceId}&status=planned`),
        api.get<Activity[]>(`/activities?workspace_id=${workspaceId}&date=${today}`),
      ]);

      const totalMins = activities.reduce((sum, a) => {
        const end = a.end_time ? new Date(a.end_time) : new Date();
        return sum + Math.round((end.getTime() - new Date(a.start_time).getTime()) / 60000);
      }, 0);

      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;

      const lines = [
        `📅 Today (${today})`,
        '',
        `🔥 In Progress (${inProgress.length}):`,
        ...inProgress.map(t => `  • ${t.title} [${t.priority}]`),
        '',
        `📋 Planned (${planned.length}):`,
        ...planned.slice(0, 5).map(t => `  • ${t.title} [${t.priority}]`),
        '',
        `⏱ Time tracked: ${timeStr} across ${activities.length} session(s)`,
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
      await api.patch<Task>(`/tasks/${task_id}`, { description: `[BLOCKER] ${text}` });
      return { content: [{ type: 'text' as const, text: `🚧 Blocker logged: "${text}"` }] };
    },
  );
}
