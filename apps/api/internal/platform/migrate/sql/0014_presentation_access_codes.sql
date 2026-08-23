ALTER TABLE presentations
    ADD COLUMN access_code TEXT;

ALTER TABLE presentations
    ADD CONSTRAINT presentations_access_code_format
    CHECK (access_code IS NULL OR access_code ~ '^[A-Z0-9]{5,12}$');

CREATE UNIQUE INDEX presentations_access_code_unique_idx
    ON presentations (upper(access_code))
    WHERE access_code IS NOT NULL;

ALTER TABLE live_sessions
    DROP CONSTRAINT live_sessions_join_code_key;

CREATE UNIQUE INDEX live_sessions_active_join_code_unique_idx
    ON live_sessions (upper(join_code))
    WHERE state <> 'ended';
