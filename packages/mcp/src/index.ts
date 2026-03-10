import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import 'dotenv/config';
import { ApiClient } from './api-client.js';
import { validateBearerToken } from './auth.js';
import { registerTools } from './tools.js';
import { registerPrompts } from './prompts.js';

const PORT = parseInt(process.env['PORT'] ?? '3002', 10);
const API_URL = process.env['ALASHED_API_URL'] ?? 'http://localhost:3001';
const RESOURCE_METADATA_URL =
  process.env['RESOURCE_METADATA_URL'] ?? 'https://tendon.alashed.kz/.well-known/oauth-protected-resource';

const app = express();
app.use(express.json());

// ── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'tendon-mcp', ts: new Date().toISOString() });
});

// ── MCP endpoint (resource server only — no /authorize, /token) ───────────────
app.post('/mcp', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401)
      .set('WWW-Authenticate', `Bearer realm="tendon", resource_metadata="${RESOURCE_METADATA_URL}"`)
      .json({ error: 'missing_token', error_description: 'Authorization header required' });
    return;
  }

  let tokenInfo: Awaited<ReturnType<typeof validateBearerToken>>;
  try {
    tokenInfo = await validateBearerToken(token);
  } catch {
    res.status(401)
      .set('WWW-Authenticate', `Bearer realm="tendon", resource_metadata="${RESOURCE_METADATA_URL}", error="invalid_token"`)
      .json({ error: 'invalid_token', error_description: 'Token invalid or expired' });
    return;
  }

  const workspaceId = (req.headers['x-workspace-id'] as string) ?? tokenInfo.workspace_id;
  const userId = tokenInfo.sub;
  const userEmail = tokenInfo.email;
  const api = new ApiClient(API_URL, token);

  const instructions = buildInstructions(userEmail, workspaceId);

  const server = new McpServer(
    { name: 'tendon', version: '1.0.0' },
    { instructions },
  );

  registerTools(server, api, workspaceId, userId);
  registerPrompts(server, workspaceId);

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  res.on('close', () => { transport.close(); server.close(); });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('MCP error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Server instructions ───────────────────────────────────────────────────────
function buildInstructions(email: string, workspaceId: string): string {
  const today = new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' });
  return `\
You are connected to Tendon — a personal work tracker for developers.
Today is ${today}.
User: ${email} | Workspace: ${workspaceId}

## Authentication

- When user says "tendon whoami" or "проверь tendon" and is not yet authenticated, Claude Code opens a browser for OAuth. Tell the user: "Opening the login page — complete authorization in the browser, then I'll retry."

## When to call tools (without being asked)

- START OF SESSION → call get_today_plan automatically to show current state
- User says "что делал вчера" / "what did I do yesterday" → get_daily_summary(date="yesterday")
- User says "что делаю сегодня" / "plan for today" → get_today_plan
- User says "начинаю / working on X" → start_focus_session(task_id) if task exists, else create_task first
- User says "готово / done / закончил X" → update_task_status(done) + stop_focus_session
- User says "создай задачи / create tasks" → create_task for each, then start_focus_session on first
- User says "заблокирован / blocked by" → log_blocker

## Task IDs

Always use IDs returned from get_today_plan or list_tasks.
Never guess or invent task IDs.

## Priority mapping

When user says:
- "срочно / urgent / critical" → high
- default → medium
- "потом / someday / low" → low

## Focus sessions

Only one focus session runs at a time — start_focus_session auto-stops the previous one.
Always stop the session when the user switches tasks or says they're done.`;
}

app.listen(PORT, () => {
  console.log(`Tendon MCP server on port ${PORT}`);
  console.log(`API: ${API_URL} | resource_metadata: ${RESOURCE_METADATA_URL}`);
});
