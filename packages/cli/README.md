# tendon-cli

**Task tracking that lives inside Claude Code.**

Set up [Tendon](https://tendon.alashed.kz) in one command — no manual config, no JSON files, no account required.

```bash
npx tendon-cli
```

---

## What it does

Tendon connects Claude Code to a task tracker. Once set up, you can talk to Claude naturally:

```
"What should I focus on today?"
"Create a task: fix the auth bug, high priority"
"Start a focus session on the login refactor"
"What did I do yesterday?"
"/wrap_up"
```

Claude creates tasks, tracks time, runs standups, and gives you daily summaries — all from inside your editor.

---

## Quick start

```bash
npx tendon-cli
```

The wizard will ask:

```
How do you want to run Tendon?
▸ Docker  (recommended — PostgreSQL included)
  Manual  (bring your own PostgreSQL)
  Cloud   (tendon.alashed.kz — free account)
```

**Docker (recommended)** — starts everything automatically:
- PostgreSQL
- API server
- MCP server

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop) to be running.

**Manual** — if you already have PostgreSQL running somewhere.

**Cloud** — no install. Use the hosted version at [tendon.alashed.kz](https://tendon.alashed.kz).

---

## After setup

The wizard prints the command to connect Claude Code:

```bash
claude mcp add --transport http tendon http://localhost:3002
```

Run it, then open **Claude Code** and in the chat type:

```
tendon whoami
```

A browser will open automatically → click **Allow** → connection confirmed.

---

## First things to say

Natural language works everywhere (Claude Code, Cursor):

```
"Show today's plan and start focus on first task"
"create 3 tasks for today"
"start focus on [task]"
"what did I do yesterday?"
"wrap up — stop tracking and summarize"
```

Claude Code also has slash prompts: `/morning`, `/wrap_up`, `/standup`, `/review`.

---

## MCP tools available

| Tool | Description |
|------|-------------|
| `whoami` | Verify connection, show user + workspace |
| `create_task` | Create task with title, priority, due date |
| `list_tasks` | List tasks filtered by status |
| `update_task` | Edit title, description, priority |
| `update_task_status` | Move to planned / in_progress / done |
| `archive_task` | Remove from active list |
| `start_focus_session` | Start timer (auto-stops previous) |
| `stop_focus_session` | Stop and log duration |
| `get_today_plan` | In-progress + planned + time tracked |
| `get_daily_summary` | Summary for any date, supports "yesterday" |
| `week_summary` | 7-day breakdown with focus bars |
| `log_blocker` | Append blocker note to a task |

---

## Requirements

- Node.js ≥ 20
- Docker Desktop (for Docker mode)
- [Claude Code](https://claude.ai/code)

---

## Use the hosted version instead

If you don't want to self-host:

```bash
claude mcp add --transport http tendon https://mcp.tendon.alashed.kz
```

1. [Create a free account](https://tendon.alashed.kz/register)
2. Run the command above
3. Claude opens a browser — click Allow

Full web dashboard, team features, Telegram daily reports.

---

## Links

- **Website**: [tendon.alashed.kz](https://tendon.alashed.kz)
- **GitHub**: [github.com/Alashed/tendon-mcp](https://github.com/Alashed/tendon-mcp)
- **npm**: [npmjs.com/package/tendon-cli](https://www.npmjs.com/package/tendon-cli)

---

## License

MIT
