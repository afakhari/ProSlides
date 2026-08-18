-- A single counter on live_sessions would serialize concurrent joins and can
-- deadlock with the shared session lock used to coordinate state transitions.
-- Presence events carry compactable deltas; snapshots compute the indexed exact
-- count instead.
ALTER TABLE live_sessions
    DROP COLUMN IF EXISTS participant_count;
