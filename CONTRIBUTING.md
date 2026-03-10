# Contributing to Tendon

Thanks for your interest! This document covers how to get started.

## Project structure

```
packages/
├── api/      Fastify API — routes, domains, OAuth, migrations
├── mcp/      MCP server — tools, prompts, auth
├── web/      Next.js — dashboard, onboarding, OAuth consent
└── shared/   TypeScript types shared across packages
```

## Setup

```bash
git clone https://github.com/Alashed/tendon-mcp.git
cd tendon-mcp
npm install

cp packages/api/.env.example packages/api/.env
cp packages/mcp/.env.example packages/mcp/.env
cp packages/web/.env.example packages/web/.env.local
# Fill in your Clerk keys and database URL

cd packages/api && npm run migrate
```

Start all services:
```bash
npm run dev:api   # localhost:3001
npm run dev:mcp   # localhost:3002
npm run dev:web   # localhost:3000
```

## How to contribute

1. **Fork** the repo and create a branch from `main`
2. Make your changes
3. Run `npm run typecheck` to check types
4. Open a PR with a clear description of what you changed and why

## Adding a new MCP tool

1. Add the tool in `packages/mcp/src/tools.ts` using `server.tool()`
2. If it needs a new API endpoint, add it in `packages/api/src/http/routes/`
3. Register the route in `packages/api/src/http/routes/index.ts`
4. Update the README tools table

## Adding a database migration

Create a new file in `packages/api/migrations/` with the next number:
```
packages/api/migrations/006_my_change.sql
```

The migration runner applies files in numeric order and skips already-applied ones.

## Code style

- TypeScript everywhere, no `any` unless necessary
- Async/await over `.then()`
- Routes validate input with Zod schemas
- All DB queries go through repository classes, not inline in routes
- Error handling via `AppError` subclasses

## Good first issues

- **Timezone-aware nightly reports** — `telegram_chats.report_hour` is UTC; use `workspace.timezone` to fire at the right local time
- **Docker Compose** — one-command local setup
- **`/dashboard/tasks` workspace switcher** — currently hardcoded to personal workspace
- **Week-over-week trend in `week_summary`** — compare this week vs last
- **Local agent package** — watch terminal history, auto-create tasks from `git commit` messages

## Questions?

Open an issue or start a discussion on GitHub.
