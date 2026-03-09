-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Workspaces
CREATE TABLE workspaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        VARCHAR(10) NOT NULL CHECK (type IN ('personal', 'team')),
  owner_id    UUID NOT NULL,
  name        VARCHAR(255) NOT NULL,
  timezone    VARCHAR(100) NOT NULL DEFAULT 'UTC',
  settings    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users
CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        VARCHAR(255) UNIQUE NOT NULL,
  name         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),
  telegram_id  VARCHAR(100) UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK after users table exists
ALTER TABLE workspaces
  ADD CONSTRAINT fk_workspace_owner FOREIGN KEY (owner_id) REFERENCES users(id);

-- Workspace Members
CREATE TABLE workspace_members (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         VARCHAR(10) NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'guest')),
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

-- Projects
CREATE TABLE projects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  status       VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tasks
CREATE TABLE tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  assignee_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by   UUID NOT NULL REFERENCES users(id),
  title        VARCHAR(500) NOT NULL,
  description  TEXT,
  status       VARCHAR(15) NOT NULL DEFAULT 'planned'
                 CHECK (status IN ('planned', 'in_progress', 'done', 'archived')),
  priority     VARCHAR(10) NOT NULL DEFAULT 'medium'
                 CHECK (priority IN ('low', 'medium', 'high')),
  source       VARCHAR(10) NOT NULL DEFAULT 'web'
                 CHECK (source IN ('claude', 'telegram', 'web', 'agent')),
  due_date     DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Activities (time entries)
CREATE TABLE activities (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id      UUID REFERENCES tasks(id) ON DELETE SET NULL,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_time   TIMESTAMPTZ NOT NULL,
  end_time     TIMESTAMPTZ,
  source       VARCHAR(10) NOT NULL DEFAULT 'web'
                 CHECK (source IN ('claude', 'agent', 'telegram', 'web')),
  client_id    VARCHAR(100), -- for offline agent sync dedup
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Standups
CREATE TABLE standups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  yesterday    TEXT,
  today        TEXT,
  blockers     TEXT,
  source       VARCHAR(10) NOT NULL DEFAULT 'web'
                 CHECK (source IN ('telegram', 'web', 'claude')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, user_id, date)
);

-- Daily Plans
CREATE TABLE daily_plans (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  items        JSONB NOT NULL DEFAULT '[]',
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, user_id, date)
);

-- Telegram Chats
CREATE TABLE telegram_chats (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  chat_id      VARCHAR(100) NOT NULL,
  thread_id    VARCHAR(100),
  type         VARCHAR(20) NOT NULL CHECK (type IN ('standup', 'daily_report', 'both')),
  settings     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, chat_id)
);

-- Reports
CREATE TABLE reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type         VARCHAR(10) NOT NULL CHECK (type IN ('daily', 'weekly')),
  date         DATE NOT NULL,
  payload      JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, type, date)
);

-- Subscriptions
CREATE TABLE subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID UNIQUE NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  plan                VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'personal', 'team')),
  status              VARCHAR(20) NOT NULL DEFAULT 'active',
  seats               INT NOT NULL DEFAULT 1,
  current_period_end  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tasks_workspace_status ON tasks(workspace_id, status);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_activities_workspace_user_date ON activities(workspace_id, user_id, start_time);
CREATE INDEX idx_activities_ongoing ON activities(workspace_id, user_id) WHERE end_time IS NULL;
CREATE INDEX idx_standups_workspace_date ON standups(workspace_id, date);
CREATE INDEX idx_reports_workspace_date ON reports(workspace_id, type, date);
