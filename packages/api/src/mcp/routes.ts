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
class InternalApiClient {
  constructor(private readonly token: string) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`http://127.0.0.1:${config.port}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
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

// ── Session store ─────────────────────────────────────────────────────────────
interface Session {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
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
- Only one focus session at a time — start_focus_session auto-stops the previous one`;
}

const RESOURCE_METADATA_URL = `${config.apiBaseUrl}/.well-known/oauth-protected-resource`;

// ── Fastify plugin ─────────────────────────────────────────────────────────────
export async function mcpRoutes(app: FastifyInstance): Promise<void> {

  // RFC 9728: Protected Resource Metadata (served from API, not separate MCP service)
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

    // Resume existing session
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
          session.tokenInfo = await validateToken(token);
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

    // New session
    const isHandshake = body?.method === 'initialize'
      || body?.method === 'notifications/initialized'
      || body?.method === 'tools/list'
      || body?.method === 'prompts/list';

    let tokenInfo: Session['tokenInfo'] = null;
    let token = '';

    if (!isHandshake) {
      token = (request.headers['authorization'] as string | undefined)?.slice(7) ?? '';
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
    }

    const workspaceId = tokenInfo?.workspace_id ?? '';
    const userId = tokenInfo?.sub ?? '';
    const userEmail = tokenInfo?.email ?? '';

    const server = new McpServer(
      { name: 'tendon', version: '1.0.0' },
      { instructions: tokenInfo ? buildInstructions(userEmail, workspaceId) : undefined },
    );

    const api = new InternalApiClient(token);
    registerTools(server, api, workspaceId, userId);
    registerPrompts(server);

    // ── Resource: tasks://today ────────────────────────────────────────────────
    // Claude can read this resource directly and subscribes to live updates.
    // When any task mutates, appEvents emits 'task:changed' → we push
    // notifications/resources/updated → Claude re-reads → always fresh data.
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
        sessions.set(sid, { transport, server, tokenInfo });
        app.log.info({ sid, user: userEmail || 'anon' }, 'mcp session created');
      },
    });

    // ── Subscribe to task changes → push resource update notification ──────────
    const onTaskChanged = (workspace_id: string) => {
      const info = sessions.get(transport.sessionId ?? '')?.tokenInfo;
      if (!info || info.workspace_id !== workspace_id) return;
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
      return reply.status(404).send({ error: 'Session not found' });
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
