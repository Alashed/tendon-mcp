# Tendon

**Task tracking and time logging that lives inside Claude Code.**

Connect your workspace in one command — no config files, no manual token copying. Ask Claude to create tasks, track focus time, run daily standups, and review your week — all from inside your editor.

[![Deploy](https://github.com/Alashed/tendon-mcp/actions/workflows/deploy.yml/badge.svg)](https://github.com/Alashed/tendon-mcp/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Two ways to get started

### Option 1 — Hosted (easiest, full dashboard)

```bash
claude mcp add --transport http tendon https://mcp.tendon.alashed.kz/mcp
```

1. [Create a free account →](https://tendon.alashed.kz/register)
2. Run the command above in your terminal
3. Open Claude Code → type `tendon whoami` → browser opens → click **Allow**
4. Done. Just talk: "Create tasks…", "What did I do yesterday?"

Full web dashboard, team features, Telegram reports, analytics.

---

### Option 2 — Self-hosted CLI (one command, no account needed)

```bash
npx tendon-cli
```

Interactive setup wizard — starts PostgreSQL + API + MCP via Docker, creates your account, prints the Claude command. No external accounts required.

---

## What you can do

```
"Start my day"                          → /morning prompt
"What did I do yesterday?"              → get_daily_summary
"Create tasks for today's sprint"       → create_task × N
"Start a focus session on the auth bug" → start_focus_session
"Mark the login refactor as done"       → update_task_status
"I'm blocked — can't reproduce in prod" → log_blocker
"Wrap up for today"                     → /wrap_up prompt
"Show me my week"                       → week_summary
```

---

## MCP Tools

| Tool | Description |
|------|-------------|
| `create_task` | Create a task with title, priority, due date |
| `list_tasks` | List tasks filtered by status |
| `update_task` | Edit title, description, priority, or due date |
| `update_task_status` | Move a task to `planned` / `in_progress` / `done` |
| `archive_task` | Remove a task from your active list |
| `start_focus_session` | Begin a timed work session, auto-stops the previous |
| `stop_focus_session` | End the session and log duration |
| `get_today_plan` | Prioritized view of today: in-progress, planned, time tracked |
| `get_daily_summary` | Summary for any date — supports `"yesterday"` |
| `week_summary` | 7-day breakdown: focus time, tasks done, best day |
| `log_blocker` | Append a blocker note to a task |

## Built-in Prompts (slash-commands)

| Prompt | What it does |
|--------|-------------|
| `/morning` | Show today's plan, suggest first task, start focus session |
| `/wrap_up` | Stop tracking, recap day, suggest tomorrow's top 3 |
| `/standup` | Generate Yesterday / Today / Blockers in standup format |
| `/review` | Weekly review with productivity patterns and suggestions |

---

## Architecture

```
tendon.alashed.kz       →  Next.js web app     (port 3030)
api.tendon.alashed.kz   →  Fastify API          (port 3001)
mcp.tendon.alashed.kz   →  MCP Server           (port 3002)
```

### Stack

| Layer | Technology |
|-------|-----------|
| Web | Next.js 15, React 19, Tailwind CSS, Clerk |
| API | Fastify v5, TypeScript, PostgreSQL |
| MCP | `@modelcontextprotocol/sdk` v1, StreamableHTTP |
| Auth | Clerk (web) + OAuth 2.1 + PKCE (Claude Code) |
| Infra | AWS EC2, RDS PostgreSQL, S3, SSM |

### OAuth flow (RFC 9728 — MCP = resource server only)

```
Claude Code              MCP (mcp.*)          Web (tendon.*)         API (api.*)
    │                        │                        │                        │
    ├─ POST /mcp ────────────►│                        │                        │
    │◄─ 401 WWW-Authenticate ─┤   resource_metadata=   │                        │
    │    (points to tendon.*) │   tendon.../oauth-     │                        │
    │                         │   protected-resource   │                        │
    ├─ GET /.well-known/oauth-protected-resource ─────►│                        │
    │◄─ { resource, authorization_servers } ───────────┤                        │
    │                         │                        │                        │
    ├─ GET /.well-known/oauth-authorization-server ───────────────────────────►│
    │◄─ { authorization_endpoint, token_endpoint } ───────────────────────────┤
    │                         │                        │                        │
    ├─ browser: /oauth/authorize ─────────────────────►│  (Clerk + consent)     │
    │◄─ redirect with code ────────────────────────────┤                        │
    │                         │                        │                        │
    ├─ POST /oauth/token ──────────────────────────────┼───────────────────────►│
    │◄─ access_token ─────────────────────────────────┼────────────────────────┤
    │                         │                        │                        │
    ├─ POST /mcp (Bearer) ───►│                        │                        │
    │                         ├─ POST /oauth/introspect───────────────────────►│
    │                         │◄─ { user_id, workspace }───────────────────────┤
    │◄─ tool result ──────────┤                        │                        │
```

---

## Monorepo structure

```
tendon/
├── packages/
│   ├── api/        Fastify REST API + OAuth 2.1 server
│   ├── mcp/        MCP server (OAuth-protected resource)
│   ├── web/        Next.js dashboard + OAuth consent UI
│   └── shared/     TypeScript types (no runtime)
├── .github/
│   └── workflows/  CI/CD — deploys API, MCP, Web on push to main
└── infra/          Nginx configs
```

---

## Self-hosting

### Option A — Docker (recommended, no external accounts needed)

```bash
git clone https://github.com/Alashed/tendon-mcp.git
cd tendon-mcp
docker compose up
```

That's it. PostgreSQL, the API, and the MCP server all start automatically.

Then add to Claude Code:

```bash
claude mcp add --transport http tendon http://localhost:3002/mcp
```

Claude opens `http://localhost:3001/oauth/authorize` — create an account with email/password and click **Allow**. No Clerk, no external services.

To create your first account:

```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","name":"You","password":"yourpassword"}'
```

---

### Option B — npm (no Docker)

#### Prerequisites

- Node.js ≥ 20
- PostgreSQL 14+ running locally

#### Steps

```bash
git clone https://github.com/Alashed/tendon-mcp.git
cd tendon-mcp
npm install

# Copy and fill in env files
cp packages/api/.env.example packages/api/.env
cp packages/mcp/.env.example packages/mcp/.env
# Edit packages/api/.env — set DATABASE_URL and JWT_SECRET at minimum

# Run migrations
cd packages/api && node -e "import('./dist/scripts/migrate.js')" || npm run build && node dist/scripts/migrate.js
cd ../..

# Start services
npm run dev:api   # http://localhost:3001
npm run dev:mcp   # http://localhost:3002
```

```bash
claude mcp add --transport http tendon http://localhost:3002/mcp
```

---

### Option C — with web dashboard (requires Clerk)

If you want the full web dashboard (task list, sessions, team view):

1. Create a project at [clerk.com](https://clerk.com) (free)
2. Copy keys into env files — see [Environment variables](#environment-variables)
3. Add redirect URLs in Clerk dashboard:
   - `http://localhost:3000/login/sso-callback`
   - `http://localhost:3000/register/sso-callback`
4. `npm run dev:web` — http://localhost:3000

---

## Environment variables

### `packages/api/.env`

```env
PORT=3001
NODE_ENV=development

# Database — use one or the other
DATABASE_URL=postgresql://user:pass@localhost:5432/tendon
# or individual vars:
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=tendon
# DB_USER=postgres
# DB_PASSWORD=postgres
# DB_SSL=false

JWT_SECRET=your-random-secret-min-32-chars

# Clerk
CLERK_SECRET_KEY=sk_test_...

# Service URLs (must match where each service is running)
API_BASE_URL=http://localhost:3001
WEB_BASE_URL=http://localhost:3000
MCP_BASE_URL=http://localhost:3002
CORS_ORIGINS=http://localhost:3000

# Optional
TELEGRAM_BOT_TOKEN=
```

### `packages/mcp/.env`

```env
PORT=3002
ALASHED_API_URL=http://localhost:3001
MCP_BASE_URL=http://localhost:3002
```

### `packages/web/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/register
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
```

---

## API Reference

Base URL: `https://api.tendon.alashed.kz` (or your local `http://localhost:3001`)

All endpoints except `/auth/*`, `GET /invites/:code`, and `/oauth/*` require:
```
Authorization: Bearer <token>
```
Accepts both **Clerk JWT** (from the web app) and **OAuth access token** (from Claude Code).

### Auth

```
POST /auth/register    { name, email, password }
POST /auth/login       { email, password }
GET  /auth/me          → current user + workspaces (with role)
```

### Tasks

```
GET    /tasks?workspace_id=&status=&assignee_id=
POST   /tasks          { workspace_id, title, priority?, due_date?, source? }
GET    /tasks/:id
PATCH  /tasks/:id      { status?, title?, description?, priority?, due_date? }
DELETE /tasks/:id      → archives the task (204)
```

### Activities (Focus Sessions)

```
POST /activities/start   { workspace_id, task_id?, source? }
POST /activities/stop    { workspace_id, activity_id? }
GET  /activities?workspace_id=&date=YYYY-MM-DD&user_id=
POST /sync               batch sync for offline agents
```

### Reports

```
GET /reports/daily?workspace_id=&date=YYYY-MM-DD&user_id=
  → { date, workspace_id, users: [{ user_name, focus_minutes, tasks_done_today, ... }], totals }
```

### Workspaces

```
GET  /workspaces
POST /workspaces         { name, type: "personal"|"team" }
GET  /workspaces/:id
POST /workspaces/:id/members   { user_id, role }
POST /workspaces/:id/invites   { email?, role? }  → invite link
GET  /invites/:code
POST /invites/:code/accept
```

### Telegram

```
POST /telegram/webhook          Telegram Bot webhook
GET  /telegram/link?code=       verify link code
POST /telegram/link/confirm     { code, workspace_id }
```

### OAuth 2.1

```
GET  /.well-known/oauth-authorization-server   RFC 8414 metadata
POST /oauth/register                           RFC 7591 dynamic client registration
GET  /oauth/authorize                          redirects to web consent page
POST /oauth/consent                            { ...params, workspace_id }
POST /oauth/token                              { grant_type, code, code_verifier, ... }
POST /oauth/introspect                         { token }
```

---

## Telegram Bot (optional)

1. Create a bot via [@BotFather](https://t.me/BotFather), copy the token
2. Add `TELEGRAM_BOT_TOKEN=...` to `packages/api/.env`
3. The API registers the webhook automatically on startup
4. In Telegram, send `/connect` to the bot to link a chat to your workspace
5. The bot sends daily reports at the hour set in `telegram_chats.report_hour` (UTC)

Bot commands:
- `/connect` — link this chat to a workspace
- `/today` — show today's summary
- `/help` — list commands

---

## Pricing

Self-hosted is always free and unlimited (MIT license).

| | Free | Pro | Team |
|---|---|---|---|
| **Price** | $0 | $9/mo | $19/mo |
| Workspaces | 1 | 1 | Unlimited |
| Tasks | 50 | Unlimited | Unlimited |
| History | 7 days | Unlimited | Unlimited |
| MCP tools | All | All | All |
| Telegram reports | — | ✓ | ✓ |
| Team members | — | — | Up to 10 |
| Team dashboard | — | — | ✓ |
| Self-hosted | ✓ unlimited | — | — |

**Pro / Team:** email [hello@tendon.alashed.kz](mailto:hello@tendon.alashed.kz)

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Good first issues:**
- [ ] Timezone-aware nightly reports (use `workspace.timezone` for cron)
- [ ] `/dashboard/tasks` and `/dashboard/sessions` workspace switcher
- [ ] Local agent (`packages/agent`) for terminal history tracking
- [ ] Docker Compose for one-command local setup
- [ ] Week-over-week trend in `week_summary`

---

## License

[MIT](LICENSE)
