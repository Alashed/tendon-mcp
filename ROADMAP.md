# Tendon — Roadmap & Architecture Improvement Plan

> Last updated: 2026-03-15
> Analyzed by: Claude Sonnet 4.6
> Status: Planning phase

---

## Context

Tendon is an MCP-native SaaS task tracker. It exposes 12 tools + 4 prompts to Claude Code via OAuth 2.1 (RFC 9728). The current architecture works but has technical debt and architectural gaps compared to 2026 MCP SaaS standards.

---

## Current Architecture

```
Claude Code
    │  HTTP POST (polling, no streaming)
    ▼
mcp.tendon.alashed.kz  (Express, port 3002)  ← separate process
    │  Bearer token → POST /oauth/introspect
    ▼
api.tendon.alashed.kz  (Fastify, port 3001)  ← business logic + OAuth server
    │
    ▼
RDS PostgreSQL  (no RLS, manual workspace_id filters everywhere)

tendon.alashed.kz  (Next.js 15, port 3030)  ← Clerk auth (separate from API auth)
    │
    ▼
api.tendon.alashed.kz
```

### Known Issues

| # | Issue | Severity | Location |
|---|-------|----------|----------|
| 1 | SHA256 password hashing (not argon2) | Critical | `packages/api/migrations` |
| 2 | Dual auth: Clerk JWT + OAuth token, different code paths | High | `packages/api/src/middleware/auth.ts` |
| 3 | MCP uses old HTTP polling, not Streamable HTTP | High | `packages/mcp/src/index.ts` |
| 4 | MCP is a separate Express service (port 3002) — redundant hop | Medium | `packages/mcp` |
| 5 | No Row-Level Security in Postgres | Medium | All migrations |
| 6 | No per-user rate limiting | Medium | `packages/api` |
| 7 | No Redis — token validation hits DB on every MCP call | Medium | `packages/mcp/src/auth.ts` |
| 8 | No granular OAuth scopes, one token = all permissions | Low | `packages/api/src/routes/oauth.ts` |
| 9 | No resource subscriptions (live task updates in Claude) | Low | `packages/mcp/src/tools.ts` |

---

## Improvement Plan

### P0 — Security (do immediately)

#### P0.1 — Replace SHA256 with argon2id
- **File:** `packages/api/src/routes/auth.ts`, new migration
- **What:** Replace `crypto.createHash('sha256')` with `argon2.hash()`
- **Why:** SHA256 is not a password hashing algorithm. No salt, no cost factor. Trivially crackable with rainbow tables.
- **Steps:**
  1. Add `npm install argon2` to `packages/api`
  2. Write migration `009_argon2_passwords.sql` — add `password_hash_v2` column
  3. On login: if old hash matches SHA256, re-hash with argon2 and store in v2
  4. On register: use argon2 directly
  5. After migration period (90 days), drop SHA256 column

#### P0.2 — Unify authentication
- **File:** `packages/api/src/middleware/auth.ts`
- **What:** Single auth middleware that handles both Clerk JWT and OAuth tokens uniformly
- **Why:** Two code paths = twice the bugs. Clerk tokens and OAuth tokens are checked differently, leading to inconsistent behavior.
- **Steps:**
  1. Extract token type detection into `detectTokenType(token): 'clerk' | 'oauth'`
  2. Both paths must resolve to same `{ sub, email, workspace_id, scopes }` shape
  3. Add unit tests for both paths

---

### P1 — Architecture (next sprint)

#### P1.1 — Migrate MCP to Streamable HTTP transport
- **File:** `packages/mcp/src/index.ts`
- **What:** Replace current HTTP handler with `StreamableHTTPServerTransport` from `@modelcontextprotocol/sdk`
- **Why:** Old HTTP polling transport is deprecated in MCP SDK 1.10+. Streamable HTTP enables tool progress, streaming responses, and proper session management.
- **Current code pattern:**
  ```typescript
  // OLD — polling, no streaming
  app.post('/mcp', async (req, res) => {
    const server = new McpServer(...)
    const transport = new HttpServerTransport(req, res)
    await server.connect(transport)
  })
  ```
- **Target pattern:**
  ```typescript
  // NEW — Streamable HTTP, session-based
  import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'

  app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined
    let transport: StreamableHTTPServerTransport

    if (sessionId && sessions.has(sessionId)) {
      transport = sessions.get(sessionId)!
    } else {
      transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() })
      const server = buildMcpServer()
      await server.connect(transport)
      sessions.set(transport.sessionId!, transport)
    }
    await transport.handleRequest(req, res, req.body)
  })

  // GET for SSE stream
  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string
    const transport = sessions.get(sessionId)
    await transport!.handleRequest(req, res)
  })
  ```
- **Steps:**
  1. Update `@modelcontextprotocol/sdk` to latest
  2. Implement `StreamableHTTPServerTransport` with in-memory session store
  3. Add `GET /mcp` for SSE (server→client notifications)
  4. Add `DELETE /mcp` for session cleanup
  5. Test with Claude Code — verify tools still work

#### P1.2 — Merge MCP into API (single service)
- **What:** Move MCP logic from `packages/mcp` into `packages/api` as a `/mcp` route
- **Why:** Two separate processes (ports 3001 + 3002) mean:
  - Double deploys
  - Extra network hop on every tool call (MCP → API introspect)
  - Two PM2 processes to manage
  - More complex Nginx config
- **Steps:**
  1. Add `@modelcontextprotocol/sdk` to `packages/api` dependencies
  2. Move `packages/mcp/src/tools.ts` → `packages/api/src/mcp/tools.ts`
  3. Move `packages/mcp/src/prompts.ts` → `packages/api/src/mcp/prompts.ts`
  4. Register MCP transport on Fastify via `fastify.register()` for `/mcp`
  5. Auth middleware reads Bearer token directly from DB (no introspect HTTP call)
  6. Update Nginx: remove `mcp.tendon.alashed.kz`, add `/mcp` to `api.tendon.alashed.kz`
  7. Update `.well-known/oauth-protected-resource` URL
  8. Remove `packages/mcp` from CI/CD pipeline
  9. Update README

#### P1.3 — PostgreSQL Row-Level Security
- **What:** Add RLS policies on `tasks`, `activities`, `projects` tables
- **Why:** Manual `WHERE workspace_id = $1` in every query is error-prone. One missing filter = data leak.
- **Migration:**
  ```sql
  -- 009_rls.sql
  ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
  ALTER TABLE tasks FORCE ROW LEVEL SECURITY;

  CREATE POLICY tasks_workspace_isolation ON tasks
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

  -- Set context at start of each request
  -- In API middleware: SET LOCAL app.workspace_id = '<uuid>'
  ```
- **Steps:**
  1. Write migration for tasks, activities, projects
  2. Add `SET LOCAL app.workspace_id` in API request middleware
  3. Remove explicit `WHERE workspace_id = $1` from queries (verify via audit)
  4. Add integration test: user A cannot read user B's tasks even without WHERE clause

---

### P2 — Scalability (next month)

#### P2.1 — Redis for token cache
- **What:** Cache OAuth token introspection results in Redis (TTL = token expiry)
- **Why:** Currently every MCP tool call hits the DB for token validation. At 100 active users, that's 100 × 12 tools = 1200 DB queries per minute just for auth.
- **Architecture:**
  ```
  MCP tool call
      │
      ▼
  Check Redis: token:<hash> → { user_id, workspace_id }
      │ miss
      ▼
  DB query → cache result in Redis (TTL 3600s)
  ```
- **Steps:**
  1. Add `ioredis` to dependencies
  2. Add `REDIS_URL` env var
  3. Wrap token introspection in `getOrSetCache(key, ttl, fn)`
  4. On token revocation, invalidate Redis key
  5. Add Redis to Docker Compose for local dev

#### P2.2 — Per-user rate limiting
- **What:** Rate limit API calls per user_id, not per IP
- **Why:** Behind Nginx, all requests come from same IP. IP-based limiting is useless.
- **Implementation:**
  ```typescript
  // packages/api/src/plugins/rate-limit.ts
  await fastify.register(import('@fastify/rate-limit'), {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.user?.sub ?? req.ip,
    errorResponseBuilder: () => ({ error: 'Too many requests', retryAfter: 60 })
  })
  ```

#### P2.3 — Webhook system
- **What:** Push notifications when tasks/sessions change
- **Why:** Currently Telegram bot polls. Webhook would enable Slack, email, custom integrations.
- **Schema:**
  ```sql
  CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id),
    url TEXT NOT NULL,
    events TEXT[] NOT NULL,  -- ['task.created', 'task.done', 'session.stopped']
    secret TEXT NOT NULL,    -- HMAC-SHA256 signing key
    created_at TIMESTAMPTZ DEFAULT now()
  );
  ```
- **Events:** `task.created`, `task.updated`, `task.done`, `session.started`, `session.stopped`

---

### P3 — Product (next quarter)

#### P3.1 — Granular OAuth scopes
- **What:** Enforce scopes on MCP tools
- **Scopes:**
  ```
  tasks:read       — list_tasks, get_today_plan, get_daily_summary, week_summary
  tasks:write      — create_task, update_task, update_task_status, archive_task, log_blocker
  sessions:write   — start_focus_session, stop_focus_session
  reports:read     — get_daily_summary, week_summary
  ```
- **Why:** Third-party integrations should request minimal scope. A read-only Claude session shouldn't be able to create tasks.

#### P3.2 — MCP Resource Subscriptions
- **What:** Claude gets notified when tasks change (without polling)
- **Why:** Currently Claude only sees task state at call time. With subscriptions, Claude can say "task X just changed to done" proactively.
- **Implementation:** MCP `resources/subscribe` + SSE push via Streamable HTTP (requires P1.1)

#### P3.3 — Offline sync for MCP
- **What:** MCP tool `sync_offline` that accepts batched operations
- **Why:** `/sync` REST endpoint already exists but no MCP tool exposes it. Useful for agents that work offline.

---

## Implementation Order

```
Week 1-2 (P0 — Security)
├── P0.1: argon2 passwords
└── P0.2: unified auth middleware

Week 3-4 (P1 — Architecture)
├── P1.1: Streamable HTTP MCP
├── P1.2: Merge MCP into API
└── P1.3: PostgreSQL RLS

Week 5-6 (P2 — Scalability)
├── P2.1: Redis token cache
├── P2.2: Per-user rate limiting
└── P2.3: Webhook system

Week 7-8 (P3 — Product)
├── P3.1: Granular OAuth scopes
├── P3.2: Resource subscriptions
└── P3.3: Offline sync MCP tool
```

---

## Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Auth DB queries per tool call | 1 (introspect) | 0 (Redis cache) |
| Services in production | 3 (api + mcp + web) | 2 (api+mcp merged + web) |
| Password security | SHA256 (broken) | argon2id |
| MCP transport | HTTP polling | Streamable HTTP |
| Data isolation enforcement | Manual WHERE clauses | PostgreSQL RLS |
| Max tool call latency (p99) | ~200ms | <100ms |

---

## Files to Change (Summary)

```
packages/api/
├── package.json                    ← add: argon2, ioredis, @modelcontextprotocol/sdk
├── src/
│   ├── middleware/auth.ts          ← P0.2: unified auth
│   ├── routes/auth.ts             ← P0.1: argon2 hashing
│   ├── plugins/rate-limit.ts      ← P2.2: per-user rate limit (new file)
│   ├── plugins/redis.ts           ← P2.1: Redis client (new file)
│   └── mcp/                       ← P1.2: moved from packages/mcp (new dir)
│       ├── index.ts
│       ├── tools.ts
│       └── prompts.ts
├── migrations/
│   ├── 009_argon2_passwords.sql   ← P0.1
│   ├── 010_rls.sql               ← P1.3
│   └── 011_webhooks.sql          ← P2.3

packages/mcp/                       ← P1.2: DELETED after merge

infra/
├── nginx-api.conf                  ← P1.2: add /mcp location block
└── nginx-mcp.conf                  ← P1.2: DELETED

.github/workflows/deploy.yml        ← P1.2: remove deploy-mcp job
```
