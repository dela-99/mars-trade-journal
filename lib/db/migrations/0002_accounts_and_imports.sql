BEGIN;
CREATE TABLE IF NOT EXISTS journal_users (
 id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE, email_verified boolean NOT NULL DEFAULT false,
 image text, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS journal_sessions (
 id text PRIMARY KEY, user_id text NOT NULL REFERENCES journal_users(id) ON DELETE CASCADE,
 token text NOT NULL UNIQUE, expires_at timestamp NOT NULL, ip_address text, user_agent text,
 created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS journal_accounts (
 id text PRIMARY KEY, user_id text NOT NULL REFERENCES journal_users(id) ON DELETE CASCADE,
 account_id text NOT NULL, provider_id text NOT NULL, password text, access_token text, refresh_token text, id_token text, scope text,
 access_token_expires_at timestamp, refresh_token_expires_at timestamp,
 created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS journal_verifications (
 id text PRIMARY KEY, identifier text NOT NULL, value text NOT NULL, expires_at timestamp NOT NULL,
 created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS journal_rate_limits (
 id text PRIMARY KEY, key text NOT NULL UNIQUE, count integer NOT NULL, last_request bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS journal_import_records (
 id text PRIMARY KEY, user_id text NOT NULL REFERENCES journal_users(id) ON DELETE CASCADE,
 source_key text NOT NULL, entity_id integer NOT NULL, kind text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS journal_import_owner_source ON journal_import_records(user_id, source_key);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS user_id text REFERENCES journal_users(id) ON DELETE CASCADE;
ALTER TABLE journal_notes ADD COLUMN IF NOT EXISTS user_id text REFERENCES journal_users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS trades_owner ON trades(user_id);
CREATE INDEX IF NOT EXISTS notes_owner ON journal_notes(user_id);
COMMIT;
-- Existing rows remain unowned until the operator explicitly assigns them.
-- Never claim legacy records automatically on signup.
