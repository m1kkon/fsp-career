ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS verified_at bigint;
CREATE TABLE IF NOT EXISTS auth_email_tokens (
 token_hash text PRIMARY KEY,
 user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
 purpose text NOT NULL CHECK (purpose IN ('verify', 'reset')),
 expires bigint NOT NULL,
 created bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_email_tokens_user ON auth_email_tokens(user_id, purpose);
CREATE INDEX IF NOT EXISTS auth_email_tokens_expiry ON auth_email_tokens(expires);
CREATE TABLE IF NOT EXISTS auth_mail_outbox (
 id text PRIMARY KEY,
 token_hash text NOT NULL UNIQUE REFERENCES auth_email_tokens(token_hash) ON DELETE CASCADE,
 payload text NOT NULL,
 attempts integer NOT NULL DEFAULT 0,
 next_attempt bigint NOT NULL,
 last_error text
);
CREATE INDEX IF NOT EXISTS auth_mail_outbox_due ON auth_mail_outbox(next_attempt);
-- Existing addresses were never verified. Preserve accounts, require ownership proof.
DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM auth_users WHERE verified_at IS NULL);
