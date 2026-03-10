-- Telegram chats linked to workspaces
CREATE TABLE telegram_chats (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id      BIGINT NOT NULL,
  thread_id    BIGINT,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  label        VARCHAR(255),
  report_hour  SMALLINT NOT NULL DEFAULT 22, -- hour in UTC to send daily report
  reports_on   BOOLEAN NOT NULL DEFAULT TRUE,
  last_report_date DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chat_id, COALESCE(thread_id, 0))
);

-- Short-lived codes for /connect flow (bot generates, web confirms)
CREATE TABLE telegram_link_codes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         VARCHAR(64) UNIQUE NOT NULL,
  chat_id      BIGINT NOT NULL,
  thread_id    BIGINT,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
  used         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tg_chats_workspace ON telegram_chats(workspace_id);
CREATE INDEX idx_tg_codes_code ON telegram_link_codes(code) WHERE used = FALSE;
