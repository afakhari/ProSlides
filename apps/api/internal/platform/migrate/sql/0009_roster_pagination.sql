CREATE INDEX IF NOT EXISTS participants_session_joined_idx
    ON participants(session_id, joined_at, id);
