\set ON_ERROR_STOP on

WITH target AS (
    SELECT
        session.id,
        session.state,
        session.state_version,
        (SELECT count(*) FROM participants WHERE session_id = session.id) AS durable_participants,
        (SELECT count(*) FROM answers WHERE session_id = session.id) AS durable_answers,
        (SELECT count(DISTINCT participant_id) FROM answers WHERE session_id = session.id) AS answered_participants
    FROM live_sessions AS session
    WHERE session.id = :'session_id'::uuid
), score_mismatches AS (
    SELECT count(*) AS value
    FROM participants AS participant
    LEFT JOIN answers AS answer ON answer.participant_id = participant.id
    WHERE participant.session_id = :'session_id'::uuid
    GROUP BY participant.id, participant.score
    HAVING participant.score <> COALESCE(sum(answer.score_delta), 0)
), duplicate_answers AS (
    SELECT count(*) AS value
    FROM (
        SELECT participant_id, question_slide_id
        FROM answers
        WHERE session_id = :'session_id'::uuid
        GROUP BY participant_id, question_slide_id
        HAVING count(*) > 1
    ) AS duplicate
), duplicate_requests AS (
    SELECT count(*) AS value
    FROM (
        SELECT participant_id, request_id
        FROM answers
        WHERE session_id = :'session_id'::uuid
        GROUP BY participant_id, request_id
        HAVING count(*) > 1
    ) AS duplicate
), event_regressions AS (
    SELECT count(*) AS value
    FROM (
        SELECT state_version, lag(state_version) OVER (ORDER BY event_id) AS previous_version
        FROM live_events
        WHERE session_id = :'session_id'::uuid
    ) AS ordered_events
    WHERE state_version < previous_version
), invalid_events AS (
    SELECT count(*) AS value
    FROM live_events, target
    WHERE session_id = target.id
      AND (live_events.state_version <= 0 OR live_events.state_version > target.state_version)
), close_boundary AS (
    SELECT min(occurred_at) AS occurred_at
    FROM live_events
    WHERE session_id = :'session_id'::uuid
      AND name = 'session.state_changed'
      AND payload->>'state' = 'question_closed'
), late_answers AS (
    SELECT count(*) AS value
    FROM answers, close_boundary
    WHERE session_id = :'session_id'::uuid
      AND close_boundary.occurred_at IS NOT NULL
      AND submitted_at > close_boundary.occurred_at
), audit AS (
    SELECT
        target.*,
        COALESCE((SELECT sum(value) FROM score_mismatches), 0) AS score_mismatches,
        (SELECT value FROM duplicate_answers) AS duplicate_answers,
        (SELECT value FROM duplicate_requests) AS duplicate_requests,
        (SELECT value FROM event_regressions) AS event_regressions,
        (SELECT value FROM invalid_events) AS invalid_events,
        (SELECT value FROM late_answers) AS late_answers
    FROM target
)
SELECT
    jsonb_build_object(
        'session_id', id,
        'state', state,
        'state_version', state_version,
        'durable_participants', durable_participants,
        'durable_answers', durable_answers,
        'answered_participants', answered_participants,
        'score_mismatches', score_mismatches,
        'duplicate_answers', duplicate_answers,
        'duplicate_requests', duplicate_requests,
        'event_regressions', event_regressions,
        'invalid_events', invalid_events,
        'late_answers', late_answers
    )::text AS audit_json,
    state = 'ended'
        AND durable_participants = :expected_participants
        AND durable_answers = :expected_answers
        AND answered_participants = :expected_answers
        AND score_mismatches = 0
        AND duplicate_answers = 0
        AND duplicate_requests = 0
        AND event_regressions = 0
        AND invalid_events = 0
        AND late_answers = 0 AS audit_ok
FROM audit
\gset

\echo :audit_json
\if :audit_ok
    \echo 'live smoke reconciliation passed'
\else
    \echo 'live smoke reconciliation failed'
    \quit 1
\endif
