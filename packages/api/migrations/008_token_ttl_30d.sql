-- Extend access token TTL from 24h to 30 days so Claude Code users
-- don't need to re-authorize every day (browser opens automatically on first use)
ALTER TABLE oauth_access_tokens
  ALTER COLUMN expires_at SET DEFAULT NOW() + INTERVAL '30 days';
