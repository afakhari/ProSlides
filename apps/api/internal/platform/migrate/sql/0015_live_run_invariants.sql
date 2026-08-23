-- Freeze the presentation definition used by each live run. Live reads and
-- scoring must never observe editor changes made after the run was created.
CREATE TABLE live_session_slides (
    session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    slide_id UUID NOT NULL,
    revision BIGINT NOT NULL CHECK (revision > 0),
    position INTEGER NOT NULL CHECK (position >= 0),
    kind TEXT NOT NULL,
    content JSONB NOT NULL,
    PRIMARY KEY (session_id, slide_id),
    UNIQUE (session_id, position)
);

INSERT INTO live_session_slides(session_id, slide_id, revision, position, kind, content)
SELECT ls.id, sl.id, sl.revision, sl.position, sl.kind, sl.content
FROM live_sessions ls
JOIN slides sl ON sl.presentation_id = ls.presentation_id;

-- A presentation has one resumable live run. The application uses an
-- advisory lock as the friendly conflict path; this index is the final guard.
CREATE UNIQUE INDEX live_sessions_one_active_presentation_uidx
    ON live_sessions(presentation_id)
    WHERE state <> 'ended';

-- ends_at is meaningful only while answers are accepted.
UPDATE live_sessions SET ends_at = NULL WHERE state <> 'question_open';
ALTER TABLE live_sessions
    ADD CONSTRAINT live_sessions_state_version_positive CHECK (state_version > 0),
    ADD CONSTRAINT live_sessions_deadline_state_check CHECK (
        (state = 'question_open' AND ends_at IS NOT NULL)
        OR (state <> 'question_open' AND ends_at IS NULL)
    );

ALTER TABLE participants
    ADD CONSTRAINT participants_score_nonnegative CHECK (score >= 0);

CREATE INDEX live_session_slides_session_position_idx
    ON live_session_slides(session_id, position);

-- Idempotency belongs to the authenticated participant. A request UUID used
-- by a different participant must not collide with or disclose another
-- participant's command result.
ALTER TABLE answers DROP CONSTRAINT answers_session_id_request_id_key;
ALTER TABLE answers
    ADD CONSTRAINT answers_participant_request_unique
    UNIQUE (session_id, participant_id, request_id);
