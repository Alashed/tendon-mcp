-- OAuth Clients (RFC 7591 Dynamic Client Registration)
CREATE TABLE oauth_clients (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                   VARCHAR(255) UNIQUE NOT NULL,
  client_secret               VARCHAR(255),
  client_name                 VARCHAR(255),
  redirect_uris               TEXT[] NOT NULL,
  grant_types                 TEXT[] NOT NULL DEFAULT '{authorization_code}',
  response_types              TEXT[] NOT NULL DEFAULT '{code}',
  token_endpoint_auth_method  VARCHAR(50) NOT NULL DEFAULT 'none',
  scope                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Authorization Codes (short-lived, PKCE-bound, single-use)
CREATE TABLE oauth_codes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  VARCHAR(255) UNIQUE NOT NULL,
  client_id             VARCHAR(255) NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id          UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  redirect_uri          TEXT NOT NULL,
  scope                 TEXT,
  code_challenge        VARCHAR(255) NOT NULL,
  code_challenge_method VARCHAR(10) NOT NULL DEFAULT 'S256',
  expires_at            TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes',
  used                  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Access Tokens (opaque random tokens)
CREATE TABLE oauth_access_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token        VARCHAR(255) UNIQUE NOT NULL,
  client_id    VARCHAR(255) NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  scope        TEXT,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour',
  revoked      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oauth_codes_code ON oauth_codes(code) WHERE used = FALSE;
CREATE INDEX idx_oauth_tokens_token ON oauth_access_tokens(token) WHERE revoked = FALSE;
CREATE INDEX idx_oauth_tokens_user ON oauth_access_tokens(user_id);
