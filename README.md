# Alashed Tracker

**Task tracking that lives inside Claude Code.**

Connect your workspace to Claude Code in one command — no config files, no tokens, no tab-switching. Ask Claude to manage your tasks, log time, and plan your day, all from inside your editor.

---

## Quick start

```bash
claude mcp add --transport http alashed-tracker https://mcp.tracker.alashed.kz
```

1. [Create a free account](https://tracker.alashed.kz/register)
2. Run the command above in your terminal
3. Open Claude Code and ask anything

---

## What you can do

Once connected, just talk to Claude:

```
"What should I focus on today?"
"Create a task: fix the auth bug, high priority"
"Start a focus session on the login refactor"
"List all in-progress tasks"
"Mark task #5 as done"
"Log a blocker: waiting for design review"
```

Claude has full access to your workspace — tasks, time tracking, priorities, and team members.

---

## Architecture

```
tracker.alashed.kz   →  Next.js web app   (port 3030)
api.tracker.alashed.kz  →  Fastify API       (port 3001)
mcp.tracker.alashed.kz  →  MCP Server        (port 3002)
```

### Stack

| Layer | Technology |
|-------|-----------|
| Web   | Next.js 15, React 19, Tailwind CSS |
| API   | Fastify v5, TypeScript, PostgreSQL |
| MCP   | `@modelcontextprotocol/sdk` v1.27, StreamableHTTP |
| Auth  | OAuth 2.1 + PKCE (RFC 7636, 8414, 9728, 7591, 7662) |
| Infra | AWS EC2 (eu-north-1), RDS PostgreSQL, S3, SSM |
| Process | PM2, Nginx, Let's Encrypt |

### OAuth flow

```
Claude Code                 MCP Server                    API
    │                           │                           │
    │── GET /.well-known ───────►│                           │
    │◄─ authorization_servers ──│                           │
    │                           │                           │
    │── POST /mcp ──────────────►│                           │
    │◄─ 401 WWW-Authenticate ───│                           │
    │                           │                           │
    │── browser opens login ────────────────────────────────►│
    │◄─ redirect with code ─────────────────────────────────│
    │                           │                           │
    │── POST /oauth/token ──────────────────────────────────►│
    │◄─ access_token ───────────────────────────────────────│
    │                           │                           │
    │── POST /mcp (Bearer) ─────►│                           │
    │                           │── POST /oauth/introspect ─►│
    │                           │◄─ { active, workspace_id }│
    │◄─ MCP response ───────────│                           │
```

---

## MCP Tools

| Tool | Description |
|------|-------------|
| `create_task` | Create a task with title, priority, due date |
| `list_tasks` | List tasks filtered by status or assignee |
| `update_task_status` | Move a task to planned / in_progress / done |
| `start_focus_session` | Begin a timed work session on a task |
| `stop_focus_session` | End the session and log time |
| `get_today_plan` | Get a prioritized view of today's work |
| `log_blocker` | Record a blocker against a task |

---

## API Reference

Base URL: `https://api.tracker.alashed.kz`

### Auth

```
POST /auth/register    { name, email, password }
POST /auth/login       { email, password }
GET  /auth/me          → current user + workspaces
```

### Tasks

```
GET    /tasks?workspace_id=<id>   list tasks
POST   /tasks                     create task
PATCH  /tasks/:id                 update task
DELETE /tasks/:id                 archive task
```

### OAuth 2.1

```
GET  /.well-known/oauth-authorization-server   RFC 8414 metadata
POST /oauth/register                           RFC 7591 dynamic client registration
GET  /oauth/authorize                          PKCE login page
POST /oauth/authorize                          process consent
POST /oauth/token                              exchange code for token
POST /oauth/introspect                         RFC 7662 token introspection
```

---

## Monorepo structure

```
alashed-tracker/
├── packages/
│   ├── api/         Fastify REST API + OAuth server
│   ├── mcp/         MCP server (OAuth protected resource)
│   ├── web/         Next.js web app
│   └── shared/      TypeScript types (no runtime)
├── migrations/      PostgreSQL migrations
├── infra/           Nginx configs
└── scripts/         Deploy scripts
```

---

## Deploy

### Prerequisites

- AWS CLI configured
- EC2 instance with PM2, Nginx, Certbot
- RDS PostgreSQL database
- S3 bucket for deployment artifacts

### Deploy web

```bash
./scripts/deploy-web.sh
```

### Deploy API / MCP

```bash
# Build
npm run build:api
npm run build:mcp

# Package and upload (same pattern as web)
tar -czf /tmp/api.tar.gz -C packages/api dist package.json
aws s3 cp /tmp/api.tar.gz s3://<bucket>/deployments/api.tar.gz
```

---

## Local development

```bash
# Install
npm install

# Run API
npm run dev:api      # http://localhost:3001

# Run MCP
npm run dev:mcp      # http://localhost:3002

# Run web
npm run dev:web      # http://localhost:3000

# Run migrations
cd packages/api && npm run migrate
```

---

## Environment variables

### API (packages/api/.env)

```
PORT=3001
DATABASE_URL=postgresql://user:pass@host:5432/dbname
DB_SSL=true
JWT_SECRET=<secret>
API_BASE_URL=https://api.tracker.alashed.kz
MCP_BASE_URL=https://mcp.tracker.alashed.kz
CORS_ORIGINS=https://tracker.alashed.kz
```

### MCP (packages/mcp/.env)

```
PORT=3002
ALASHED_API_URL=https://api.tracker.alashed.kz
MCP_BASE_URL=https://mcp.tracker.alashed.kz
```

### Web (packages/web/.env.local)

```
NEXT_PUBLIC_API_URL=https://api.tracker.alashed.kz
```

---

## Add to Claude Code

```bash
claude mcp add --transport http alashed-tracker https://mcp.tracker.alashed.kz
```

This uses OAuth 2.1 + PKCE — Claude Code will open a browser for you to sign in. No manual token copying required.

---

## License

MIT
