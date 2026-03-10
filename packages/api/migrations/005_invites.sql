CREATE TABLE workspace_invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         VARCHAR(64) UNIQUE NOT NULL,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invited_by   UUID NOT NULL REFERENCES users(id),
  email        VARCHAR(255),
  role         VARCHAR(10) NOT NULL DEFAULT 'member'
                 CHECK (role IN ('admin', 'member', 'guest')),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  used         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invites_code ON workspace_invites(code) WHERE used = FALSE;
