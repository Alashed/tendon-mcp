CREATE TABLE onboarding_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_name VARCHAR(80) NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_onboarding_events_user_created
  ON onboarding_events(user_id, created_at DESC);

CREATE INDEX idx_onboarding_events_name_created
  ON onboarding_events(event_name, created_at DESC);
