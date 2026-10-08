CREATE TABLE IF NOT EXISTS api_keys (
 id text PRIMARY KEY,
 user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
 name text NOT NULL,
 token_hash text NOT NULL UNIQUE,
 prefix text NOT NULL,
 scopes text[] NOT NULL CHECK (scopes <@ ARRAY['read','write']::text[] AND 'read' = ANY(scopes)),
 created bigint NOT NULL,
 expires bigint NOT NULL,
 last_used bigint,
 revoked_at bigint
);
CREATE INDEX IF NOT EXISTS api_keys_user ON api_keys(user_id, created DESC);
