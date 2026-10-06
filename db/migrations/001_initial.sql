CREATE TABLE IF NOT EXISTS accounts (
 id text PRIMARY KEY,
 email text NOT NULL,
 data jsonb NOT NULL,
 created bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS records (
 id text PRIMARY KEY,
 kind text NOT NULL,
 owner text NOT NULL,
 recipient text,
 data jsonb NOT NULL,
 created bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS records_kind_created ON records(kind, created DESC);
CREATE INDEX IF NOT EXISTS records_kind_owner ON records(kind, owner);
CREATE INDEX IF NOT EXISTS records_kind_recipient ON records(kind, recipient);
CREATE TABLE IF NOT EXISTS auth_users (
 id text PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
 email text NOT NULL UNIQUE,
 password_hash text NOT NULL,
 created bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_sessions (
 token_hash text PRIMARY KEY,
 user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
 expires bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions(expires);
CREATE TABLE IF NOT EXISTS auth_rate_limits (
 key text PRIMARY KEY,
 attempts integer NOT NULL,
 expires bigint NOT NULL
);
