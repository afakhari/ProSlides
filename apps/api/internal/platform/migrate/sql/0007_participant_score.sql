ALTER TABLE participants
    ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0;

ALTER TABLE live_sessions
    ADD COLUMN IF NOT EXISTS participant_count INTEGER NOT NULL DEFAULT 0;

UPDATE participants AS participant
SET score = totals.score
FROM (
    SELECT participant_id, COALESCE(sum(score_delta), 0)::integer AS score
    FROM answers
    GROUP BY participant_id
) AS totals
WHERE participant.id = totals.participant_id;

UPDATE live_sessions AS session
SET participant_count = totals.participant_count
FROM (
    SELECT session_id, count(*)::integer AS participant_count
    FROM participants
    GROUP BY session_id
) AS totals
WHERE session.id = totals.session_id;

CREATE INDEX IF NOT EXISTS participants_session_score_idx
    ON participants(session_id, score DESC, joined_at, id);
