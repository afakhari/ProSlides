ALTER TABLE live_sessions
    ADD COLUMN IF NOT EXISTS request_id UUID,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS live_sessions_host_request_uidx
    ON live_sessions(host_id, request_id) WHERE request_id IS NOT NULL;

ALTER TABLE participants
    ADD COLUMN IF NOT EXISTS request_id UUID,
    ADD COLUMN IF NOT EXISTS token_hash BYTEA;

CREATE UNIQUE INDEX IF NOT EXISTS participants_session_request_uidx
    ON participants(session_id, request_id) WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS participants_token_hash_uidx
    ON participants(token_hash) WHERE token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS live_commands (
    session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    action TEXT NOT NULL,
    result_state TEXT NOT NULL,
    result_state_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (session_id, request_id)
);

CREATE TABLE IF NOT EXISTS live_events (
    event_id BIGSERIAL PRIMARY KEY,
    schema_version INTEGER NOT NULL DEFAULT 1,
    session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    state_version BIGINT NOT NULL,
    name TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS live_events_session_event_idx
    ON live_events(session_id, event_id);
