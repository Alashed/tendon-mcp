-- Migrate password hashing from SHA256 to argon2id.
-- Strategy: add new column, re-hash on next login, drop SHA256 column after ~90 days.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_argon2 TEXT;
