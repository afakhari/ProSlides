CREATE TABLE IF NOT EXISTS live_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    presentation_id UUID NOT NULL REFERENCES presentations(id),
    host_id UUID NOT NULL REFERENCES users(id),
    join_code TEXT NOT NULL UNIQUE,
    state TEXT NOT NULL CHECK (state IN ('draft','lobby','content','question_open','question_closed','leaderboard','ended')),
    state_version BIGINT NOT NULL DEFAULT 1,
    active_slide_id UUID REFERENCES slides(id),
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    avatar TEXT,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (session_id, display_name)
);

CREATE TABLE IF NOT EXISTS answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    question_slide_id UUID NOT NULL REFERENCES slides(id),
    request_id UUID NOT NULL,
    answer JSONB NOT NULL,
    score_delta INTEGER NOT NULL DEFAULT 0,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (session_id, participant_id, question_slide_id),
    UNIQUE (session_id, request_id)
);

CREATE INDEX IF NOT EXISTS participants_session_idx ON participants(session_id);
CREATE INDEX IF NOT EXISTS answers_session_question_idx ON answers(session_id, question_slide_id);
