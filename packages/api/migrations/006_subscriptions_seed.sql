-- Ensure every workspace has a subscription row (default: free)
INSERT INTO subscriptions (workspace_id, plan, status, seats)
SELECT id, 'free', 'active', 1
FROM workspaces
WHERE id NOT IN (SELECT workspace_id FROM subscriptions)
ON CONFLICT DO NOTHING;
