import express from 'express';
import { randomUUID } from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import 'dotenv/config';
import { ApiClient } from './api-client.js';
import { validateBearerToken, type TokenInfo } from './auth.js';
import { registerTools } from './tools.js';
import { registerPrompts } from './prompts.js';

const PORT = parseInt(process.env['PORT'] ?? '3002', 10);
const API_URL = process.env['ALASHED_API_URL'] ?? 'http://localhost:3001';
const MCP_BASE_URL = process.env['MCP_BASE_URL'] ?? `http://localhost:${PORT}`;
const RESOURCE_METADATA_URL = `${MCP_BASE_URL}/.well-known/oauth-protected-resource`;

// ── Session store ─────────────────────────────────────────────────────────────
// One session per Claude Code client. Sessions persist across requests so:
//  - auth is validated once, not on every tool call
//  - server-to-client SSE notifications work (GET /mcp)
//  - session cleanup is explicit (DELETE /mcp)
interface Session {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  tokenInfo: TokenInfo | null; // null = unauthenticated (handshake only)
}

const sessions = new Map<string, Session>();

// Cleanup sessions that were idle for >2h (safety valve for leaked sessions)
setInterval(() => {
  // Sessions clean themselves up via onclose; this is just a safety net
  // In production, add lastSeen timestamps for proper TTL
}, 60_000);

const app = express();
app.use(express.json());

// ── RFC 9728: Protected Resource Metadata ─────────────────────────────────────
app.get('/.well-known/oauth-protected-resource', (_req, res) => {
  res.json({
    resource: MCP_BASE_URL,
    authorization_servers: [API_URL],
  });
});

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'tendon-mcp',
    sessions: sessions.size,
    ts: new Date().toISOString(),
  });
});

// ── POST /mcp — create or resume session ──────────────────────────────────────
app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  const body = req.body as { method?: string } | undefined;

  // ── Resume existing session ──────────────────────────────────────────────
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!;

    // Validate auth on every tool call (token may have been refreshed)
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const isToolCall = body?.method === 'tools/call';

    if (isToolCall) {
      if (!token) {
        return void res.status(401)
          .set('WWW-Authenticate', `Bearer realm="tendon", resource_metadata="${RESOURCE_METADATA_URL}"`)
          .json({ error: 'missing_token' });
      }
      // Re-validate token (handles token refresh transparently)
      try {
        session.tokenInfo = await validateBearerToken(token);
      } catch {
        return void res.status(401)
          .set('WWW-Authenticate', `Bearer realm="tendon", resource_metadata="${RESOURCE_METADATA_URL}", error="invalid_token"`)
          .json({ error: 'invalid_token' });
      }
    }

    await session.transport.handleRequest(req, res, req.body);
    return;
  }

  // ── New session ───────────────────────────────────────────────────────────
  const isHandshake = body?.method === 'initialize'
    || body?.method === 'notifications/initialized'
    || body?.method === 'tools/list'
    || body?.method === 'prompts/list';

  let tokenInfo: TokenInfo | null = null;

  if (!isHandshake) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return void res.status(401)
        .set('WWW-Authenticate', `Bearer realm="tendon", resource_metadata="${RESOURCE_METADATA_URL}"`)
        .json({ error: 'missing_token' });
    }
    try {
      tokenInfo = await validateBearerToken(token);
    } catch {
      return void res.status(401)
        .set('WWW-Authenticate', `Bearer realm="tendon", resource_metadata="${RESOURCE_METADATA_URL}", error="invalid_token"`)
        .json({ error: 'invalid_token' });
    }
  }

  // Build server with whatever token we have (empty for handshake)
  const workspaceId = tokenInfo?.workspace_id ?? '';
  const userId = tokenInfo?.sub ?? '';
  const userEmail = tokenInfo?.email ?? '';
  const token = (req.headers['authorization'] as string | undefined)?.slice(7) ?? '';

  const server = new McpServer(
    { name: 'tendon', version: '1.0.0' },
    { instructions: tokenInfo ? buildInstructions(userEmail, workspaceId) : undefined },
  );

  registerTools(server, new ApiClient(API_URL, token), workspaceId, userId);
  registerPrompts(server);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sid) => {
      sessions.set(sid, { transport, server, tokenInfo });
      console.log(`[mcp] session created: ${sid} user=${userEmail || 'anon'}`);
    },
  });

  transport.onclose = () => {
    if (transport.sessionId) {
      sessions.delete(transport.sessionId);
      console.log(`[mcp] session closed: ${transport.sessionId}`);
    }
  };

  res.on('close', () => {
    // Only cleanup if session was never registered (failed handshake)
    if (!transport.sessionId) {
      transport.close();
      server.close();
    }
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('[mcp] request error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /mcp — SSE stream for server-to-client notifications ──────────────────
app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !sessions.has(sessionId)) {
    return void res.status(404).json({ error: 'Session not found' });
  }

  const { transport } = sessions.get(sessionId)!;

  res.on('close', () => {
    // Client disconnected — session stays alive for reconnect
  });

  try {
    await transport.handleRequest(req, res);
  } catch (err) {
    console.error('[mcp] SSE error:', err);
    if (!res.headersSent) res.status(500).end();
  }
});

// ── DELETE /mcp — explicit session cleanup ────────────────────────────────────
app.delete('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId && sessions.has(sessionId)) {
    const { transport, server } = sessions.get(sessionId)!;
    sessions.delete(sessionId);
    await Promise.allSettled([transport.close(), server.close()]);
    console.log(`[mcp] session deleted: ${sessionId}`);
  }

  res.status(204).end();
});

// ── Server instructions ───────────────────────────────────────────────────────
function buildInstructions(email: string, workspaceId: string): string {
  const today = new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' });
  return `\
You are connected to Tendon — a personal work tracker for developers.
Today is ${today}.
User: ${email} | Workspace: ${workspaceId}

## Authentication

- When user says "tendon whoami" or "start my day" for the first time — Claude Code handles OAuth automatically (browser opens). Tell the user: "Opening the login page — complete authorization in the browser, then I'll retry."

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
  console.log(`Session store: in-memory (${sessions.size} active)`);
});
