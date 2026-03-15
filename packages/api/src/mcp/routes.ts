import { randomUUID } from 'crypto';
import type { FastifyInstance } from 'fastify';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { getContainer } from '../di/container.js';
import { config } from '../config/index.js';
import { registerTools } from './tools.js';
import { registerPrompts } from './prompts.js';
import { appEvents } from '../events.js';

// ── Internal HTTP client (loopback to same process) ───────────────────────────
// `token` is intentionally mutable — updated when the OAuth token is refreshed
// or when the session receives its first authenticated tools/call after a
// handshake-only initialize (anon → auth upgrade path).
export class InternalApiClient {
  constructor(public token: string) {}

  private async request<T>(method: string, path: string, body?: unknown, attempt = 0): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`http://127.0.0.1:${config.port}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (networkErr) {
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 100 * 2 ** attempt));
        return this.request<T>(method, path, body, attempt + 1);
      }
      throw networkErr;
    }

    if (!res.ok) {
      if (res.status >= 500 && res.status !== 501 && attempt < 3) {
        await new Promise((r) => setTimeout(r, 100 * 2 ** attempt));
        return this.request<T>(method, path, body, attempt + 1);
      }
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(`API ${method} ${path} (${res.status}): ${JSON.stringify(err)}`);
    }
    const json = await res.json() as { data: T };
    return json.data;
  }

  get<T>(path: string): Promise<T> { return this.request<T>('GET', path); }
  post<T>(path: string, body: unknown): Promise<T> { return this.request<T>('POST', path, body); }
  patch<T>(path: string, body: unknown): Promise<T> { return this.request<T>('PATCH', path, body); }
}

// ── Token validation (direct DB — no HTTP round-trip) ─────────────────────────
async function validateToken(token: string) {
  const { oauthService } = getContainer();
  const info = await oauthService.introspect(token);
  if (!info.active || !info.sub || !info.workspace_id) throw new Error('inactive');
  return { sub: info.sub, email: info.email ?? '', workspace_id: info.workspace_id };
}

// ── Session-scoped auth ref — passed by reference into tool handlers ──────────
// Mutable so tools always read the latest token/workspace without re-registration.
export interface SessionAuth {
  token: string;
  workspaceId: string;
  userId: string;
  email: string;
}

// ── Session store ─────────────────────────────────────────────────────────────
interface Session {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  api: InternalApiClient;
  auth: SessionAuth;
  tokenInfo: { sub: string; email: string; workspace_id: string } | null;
}

const sessions = new Map<string, Session>();

function buildInstructions(email: string, workspaceId: string): string {
  const today = new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' });
  return `You are connected to Tendon — a personal work tracker for developers.
Today is ${today}.
User: ${email} | Workspace: ${workspaceId}

## When to call tools (without being asked)
- START OF SESSION → call get_today_plan automatically
- "что делал вчера" / "yesterday" → get_daily_summary(date="yesterday")
- "начинаю / working on X" → start_focus_session after create_task if needed
- "готово / done" → update_task_status(done) + stop_focus_session
- "заблокирован / blocked by" → log_blocker

## Rules
- Always use task IDs from get_today_plan or list_tasks — never invent them
- "срочно/urgent" → high | default → medium | "потом/someday" → low
- Only one focus session at a time — start_focus_session auto-stops the previous one

## Project/repo detection (IMPORTANT)
When creating a task, ALWAYS auto-detect the current project first:
1. Run: git remote get-url origin 2>/dev/null || basename "$PWD"
2. Extract the repo name: strip the host and .git suffix (e.g. "git@github.com:user/my-app.git" → "my-app")
3. Pass it as the \`project\` parameter to create_task
4. Tell the user which project was detected, e.g. "Detected project: my-app"`;
}

const RESOURCE_METADATA_URL = `${config.apiBaseUrl}/.well-known/oauth-protected-resource`;

// ── Fastify plugin ─────────────────────────────────────────────────────────────
export async function mcpRoutes(app: FastifyInstance): Promise<void> {

  // RFC 9728: Protected Resource Metadata
  app.get('/.well-known/oauth-protected-resource', async (_req, reply) => {
    return reply.send({
      resource: config.apiBaseUrl,
      authorization_servers: [config.apiBaseUrl],
    });
  });

  // ── POST /mcp — create or resume session ───────────────────────────────────
  app.post('/mcp', async (request, reply) => {
    const sessionId = request.headers['mcp-session-id'] as string | undefined;
    const body = request.body as { method?: string } | undefined;

    // Stale session ID → tell client to reinitialize
    if (sessionId && !sessions.has(sessionId)) {
      return reply.status(410).send({ error: 'Session expired — please reinitialize' });
    }

    // ── Resume existing session ───────────────────────────────────────────────
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      const token = (request.headers['authorization'] as string | undefined)?.slice(7);

      if (body?.method === 'tools/call') {
        if (!token) {
          return reply.status(401)
            .header('WWW-Authenticate', `Bearer realm="tendon", resource_metadata="${RESOURCE_METADATA_URL}"`)
            .send({ error: 'missing_token' });
        }
        try {
          const info = await validateToken(token);
          // Update the mutable auth ref — tool handlers pick up the new values
          // without needing to be re-registered.
          session.tokenInfo = info;
          session.auth.token = token;
          session.auth.workspaceId = info.workspace_id;
          session.auth.userId = info.sub;
          session.auth.email = info.email;
          session.api.token = token;
        } catch {
          return reply.status(401)
            .header('WWW-Authenticate', `Bearer realm="tendon", resource_metadata="${RESOURCE_METADATA_URL}", error="invalid_token"`)
            .send({ error: 'invalid_token' });
        }
      }

      reply.hijack();
      await session.transport.handleRequest(request.raw, reply.raw, request.body);
      return;
    }

    // ── New session ───────────────────────────────────────────────────────────
    const isHandshake = body?.method === 'initialize'
      || body?.method === 'notifications/initialized'
      || body?.method === 'tools/list'
      || body?.method === 'prompts/list';

    let tokenInfo: Session['tokenInfo'] = null;
    let token = (request.headers['authorization'] as string | undefined)?.slice(7) ?? '';

    if (!isHandshake) {
      // Non-handshake methods always require auth
      if (!token) {
        return reply.status(401)
          .header('WWW-Authenticate', `Bearer realm="tendon", resource_metadata="${RESOURCE_METADATA_URL}"`)
          .send({ error: 'missing_token' });
      }
      try {
        tokenInfo = await validateToken(token);
      } catch {
        return reply.status(401)
          .header('WWW-Authenticate', `Bearer realm="tendon", resource_metadata="${RESOURCE_METADATA_URL}", error="invalid_token"`)
          .send({ error: 'invalid_token' });
      }
    } else if (token) {
      // Handshake + token present (Claude Code sends token on all requests after OAuth).
      // Use it so tools are registered with real credentials immediately.
      try { tokenInfo = await validateToken(token); } catch { token = ''; }
    }

    // Mutable auth ref — shared with all tool handlers via closure.
    // When the first authenticated tools/call arrives on an anon session,
    // we mutate this object and tools instantly see the updated values.
    const auth: SessionAuth = {
      token,
      workspaceId: tokenInfo?.workspace_id ?? '',
      userId: tokenInfo?.sub ?? '',
      email: tokenInfo?.email ?? '',
    };

    const server = new McpServer(
      { name: 'tendon', version: '1.0.0' },
      { instructions: tokenInfo ? buildInstructions(auth.email, auth.workspaceId) : undefined },
    );

    const api = new InternalApiClient(token);
    registerTools(server, api, auth);
    registerPrompts(server);

    // ── Resource: tasks://today ────────────────────────────────────────────────
    server.resource(
      'tasks-today',
      'tasks://today',
      async (uri) => {
        const session = sessions.get(transport.sessionId ?? '');
        const info = session?.tokenInfo;
        if (!info) return { contents: [] };

        const today = new Date().toISOString().split('T')[0]!;
        const [inProgress, planned, activities] = await Promise.all([
          api.get<unknown[]>(`/tasks?workspace_id=${info.workspace_id}&status=in_progress`),
          api.get<unknown[]>(`/tasks?workspace_id=${info.workspace_id}&status=planned`),
          api.get<unknown[]>(`/activities?workspace_id=${info.workspace_id}&date=${today}`),
        ]);

        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify({ inProgress, planned, activities, as_of: new Date().toISOString() }),
            mimeType: 'application/json',
          }],
        };
      },
    );

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        sessions.set(sid, { transport, server, api, auth, tokenInfo });
        app.log.info({ sid, user: auth.email || 'anon' }, 'mcp session created');
      },
    });

    // ── Subscribe to task changes → push resource update notification ──────────
    const onTaskChanged = (workspace_id: string) => {
      const session = sessions.get(transport.sessionId ?? '');
      if (!session?.tokenInfo || session.tokenInfo.workspace_id !== workspace_id) return;
      server.server.notification({
        method: 'notifications/resources/updated',
        params: { uri: 'tasks://today' },
      }).catch(() => {});
    };
    appEvents.on('task:changed', onTaskChanged);

    transport.onclose = () => {
      appEvents.off('task:changed', onTaskChanged);
      if (transport.sessionId) {
        sessions.delete(transport.sessionId);
        app.log.info({ sid: transport.sessionId }, 'mcp session closed');
      }
    };

    reply.hijack();
    try {
      await server.connect(transport);
      await transport.handleRequest(request.raw, reply.raw, request.body);
    } catch (err) {
      app.log.error(err, 'mcp request error');
      if (!reply.raw.headersSent) reply.raw.writeHead(500).end('Internal server error');
    }
  });

  // ── GET /mcp — SSE stream ──────────────────────────────────────────────────
  app.get('/mcp', async (request, reply) => {
    const sessionId = request.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !sessions.has(sessionId)) {
      return reply.status(410).send({ error: 'Session expired — please reinitialize' });
    }
    const { transport } = sessions.get(sessionId)!;
    reply.hijack();
    try {
      await transport.handleRequest(request.raw, reply.raw);
    } catch (err) {
      app.log.error(err, 'mcp sse error');
      if (!reply.raw.headersSent) reply.raw.end();
    }
  });

  // ── DELETE /mcp — cleanup session ─────────────────────────────────────────
  app.delete('/mcp', async (request, reply) => {
    const sessionId = request.headers['mcp-session-id'] as string | undefined;
    if (sessionId && sessions.has(sessionId)) {
      const { transport, server } = sessions.get(sessionId)!;
      sessions.delete(sessionId);
      await Promise.allSettled([transport.close(), server.close()]);
      app.log.info({ sessionId }, 'mcp session deleted');
    }
    return reply.status(204).send();
  });
}
