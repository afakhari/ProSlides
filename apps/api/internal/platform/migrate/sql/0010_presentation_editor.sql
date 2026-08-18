ALTER TABLE presentations
    ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS presentations_owner_updated_idx
    ON presentations(owner_id, updated_at DESC, id DESC);
