-- OAuth Refresh Tokens (RFC 6749 §6, token rotation on every use)
CREATE TABLE oauth_refresh_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token        VARCHAR(255) UNIQUE NOT NULL,
  client_id    VARCHAR(255) NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  scope        TEXT,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  used         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oauth_refresh_token ON oauth_refresh_tokens(token) WHERE used = FALSE;

-- Extend existing access token TTL from 1h to 24h for better UX
ALTER TABLE oauth_access_tokens
  ALTER COLUMN expires_at SET DEFAULT NOW() + INTERVAL '24 hours';
