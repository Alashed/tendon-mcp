import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import 'dotenv/config';
import { ApiClient } from './api-client.js';
import type { Task, Activity } from '@alashed/shared';

const API_URL = process.env['ALASHED_API_URL'] ?? 'http://localhost:3001';
const API_TOKEN = process.env['ALASHED_API_TOKEN'] ?? '';
const WORKSPACE_ID = process.env['ALASHED_WORKSPACE_ID'] ?? '';

const api = new ApiClient(API_URL, API_TOKEN);
const server = new McpServer({
  name: 'alashed-tracker',
  version: '1.0.0',
});

// --- create_task ---
server.tool(
  'create_task',
  'Create a new task in your workspace',
  {
    title: z.string().min(1).describe('Task title'),
    description: z.string().optional().describe('Optional description'),
    priority: z.enum(['low', 'medium', 'high']).optional().describe('Task priority (default: medium)'),
    due_date: z.string().optional().describe('Due date in YYYY-MM-DD format'),
    project_id: z.string().optional().describe('Project UUID to assign task to'),
  },
  async ({ title, description, priority, due_date, project_id }) => {
    const task = await api.post<Task>('/tasks', {
      workspace_id: WORKSPACE_ID,
      title,
      description,
      priority,
      due_date,
      project_id,
      source: 'claude',
    });
    return {
      content: [{ type: 'text' as const, text: `Task created: "${task.title}" (ID: ${task.id}, priority: ${task.priority})` }],
    };
  },
);

// --- update_task_status ---
server.tool(
  'update_task_status',
  'Update the status of a task',
  {
    task_id: z.string().describe('Task UUID'),
    status: z.enum(['planned', 'in_progress', 'done']).describe('New status'),
  },
  async ({ task_id, status }) => {
    const task = await api.patch<Task>(`/tasks/${task_id}`, { status });
    return {
      content: [{ type: 'text' as const, text: `Task "${task.title}" is now ${status}` }],
    };
  },
);

// --- list_tasks ---
server.tool(
  'list_tasks',
  'List tasks in your workspace',
  {
    status: z.enum(['planned', 'in_progress', 'done']).optional().describe('Filter by status'),
  },
  async ({ status }) => {
    const tasks = await api.get<Task[]>(`/tasks?workspace_id=${WORKSPACE_ID}${status ? `&status=${status}` : ''}`);
    if (!tasks.length) {
      return { content: [{ type: 'text' as const, text: 'No tasks found' }] };
    }
    const lines = tasks.map((t) => `- [${t.status}] ${t.title} (${t.priority}) [ID: ${t.id}]`);
    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
  },
);

// --- start_focus_session ---
server.tool(
  'start_focus_session',
  'Start a focus session on a task (stops any current session)',
  {
    task_id: z.string().optional().describe('Task UUID to focus on'),
  },
  async ({ task_id }) => {
    const activity = await api.post<Activity>('/activities/start', {
      workspace_id: WORKSPACE_ID,
      task_id,
      source: 'claude',
    });
    const msg = task_id
      ? `Focus session started on task. Activity ID: ${activity.id}`
      : `Focus session started (no specific task). Activity ID: ${activity.id}`;
    return { content: [{ type: 'text' as const, text: msg }] };
  },
);

// --- stop_focus_session ---
server.tool(
  'stop_focus_session',
  'Stop the current focus session',
  {},
  async () => {
    const activity = await api.post<Activity | null>('/activities/stop', { workspace_id: WORKSPACE_ID });
    if (!activity) return { content: [{ type: 'text' as const, text: 'No active session found' }] };
    const start = new Date(activity.start_time);
    const end = new Date(activity.end_time ?? Date.now());
    const mins = Math.round((end.getTime() - start.getTime()) / 60000);
    return { content: [{ type: 'text' as const, text: `Focus session stopped. Duration: ${mins} minutes` }] };
  },
);

// --- get_today_plan ---
server.tool(
  'get_today_plan',
  'Get your tasks and activities plan for today',
  {},
  async () => {
    const today = new Date().toISOString().split('T')[0]!;
    const [inProgress, activities, planned] = await Promise.all([
      api.get<Task[]>(`/tasks?workspace_id=${WORKSPACE_ID}&status=in_progress`),
      api.get<Activity[]>(`/activities?workspace_id=${WORKSPACE_ID}&date=${today}`),
      api.get<Task[]>(`/tasks?workspace_id=${WORKSPACE_ID}&status=planned`),
    ]);

    const totalMins = activities.reduce((sum, a) => {
      const start = new Date(a.start_time);
      const end = a.end_time ? new Date(a.end_time) : new Date();
      return sum + Math.round((end.getTime() - start.getTime()) / 60000);
    }, 0);

    const lines = [
      `=== Today's Plan (${today}) ===`,
      '',
      `In Progress (${inProgress.length}):`,
      ...inProgress.map((t) => `  - ${t.title} [${t.priority}]`),
      '',
      `Planned (${planned.length}):`,
      ...planned.slice(0, 5).map((t) => `  - ${t.title} [${t.priority}]`),
      '',
      `Time tracked today: ${totalMins} min across ${activities.length} session(s)`,
    ];

    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
  },
);

// --- log_blocker ---
server.tool(
  'log_blocker',
  'Log a blocker for a task',
  {
    task_id: z.string().describe('Task UUID'),
    text: z.string().describe('Description of the blocker'),
  },
  async ({ task_id, text }) => {
    await api.patch<Task>(`/tasks/${task_id}`, { description: `[BLOCKER] ${text}` });
    return { content: [{ type: 'text' as const, text: `Blocker logged for task ${task_id}: "${text}"` }] };
  },
);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('Alashed MCP server running');
