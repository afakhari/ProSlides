package live

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresStore struct{ pool *pgxpool.Pool }

func NewPostgresStore(pool *pgxpool.Pool) *PostgresStore { return &PostgresStore{pool: pool} }

func (s *PostgresStore) CreateSession(c context.Context, host, presentation, request, code string) (Session, bool, error) {
	var out Session
	if e := scanSession(s.pool.QueryRow(c, `SELECT id::text,presentation_id::text,host_id::text,join_code,state,state_version,active_slide_id::text,ends_at FROM live_sessions WHERE host_id=$1 AND request_id=$2`, host, request), &out); e == nil {
		return out, true, nil
	} else if !errors.Is(e, pgx.ErrNoRows) {
		return out, false, e
	}
	tx, e := s.pool.Begin(c)
	if e != nil {
		return out, false, e
	}
	defer tx.Rollback(c)
	if _, e = tx.Exec(c, `SELECT pg_advisory_xact_lock(hashtextextended($1::text || ':' || $2::text, 0))`, host, request); e != nil {
		return out, false, e
	}
	if e = scanSession(tx.QueryRow(c, `SELECT id::text,presentation_id::text,host_id::text,join_code,state,state_version,active_slide_id::text,ends_at FROM live_sessions WHERE host_id=$1 AND request_id=$2`, host, request), &out); e == nil {
		return out, true, nil
	} else if !errors.Is(e, pgx.ErrNoRows) {
		return out, false, e
	}
	e = scanSession(tx.QueryRow(c, `INSERT INTO live_sessions(presentation_id,host_id,join_code,state,request_id) SELECT id,$1,$3,'draft',$4 FROM presentations WHERE id=$2 AND owner_id=$1 RETURNING id::text,presentation_id::text,host_id::text,join_code,state,state_version,active_slide_id::text,ends_at`, host, presentation, code, request), &out)
	if errors.Is(e, pgx.ErrNoRows) {
		return out, false, ErrNotFound
	}
	if e != nil {
		return out, false, mapPG(e)
	}
	if e = insertEvent(c, tx, out.ID, out.StateVersion, "session.created", map[string]any{"state": out.State}); e != nil {
		return out, false, e
	}
	if e = tx.Commit(c); e != nil {
		return out, false, e
	}
	return out, false, nil
}
func (s *PostgresStore) Join(c context.Context, session, request, name, avatar string, hash []byte) (Participant, bool, error) {
	var p Participant
	if e := s.pool.QueryRow(c, `SELECT id::text,display_name,COALESCE(avatar,'') FROM participants WHERE session_id=$1 AND request_id=$2`, session, request).Scan(&p.ID, &p.DisplayName, &p.Avatar); e == nil {
		return p, true, nil
	} else if !errors.Is(e, pgx.ErrNoRows) {
		return p, false, e
	}
	tx, e := s.pool.Begin(c)
	if e != nil {
		return p, false, e
	}
	defer tx.Rollback(c)
	var version int64
	e = tx.QueryRow(c, `SELECT state_version FROM live_sessions WHERE id=$1 AND state NOT IN ('draft','ended') FOR SHARE`, session).Scan(&version)
	if errors.Is(e, pgx.ErrNoRows) {
		return p, false, ErrConflict
	}
	if e != nil {
		return p, false, e
	}
	e = tx.QueryRow(c, `INSERT INTO participants(session_id,display_name,avatar,request_id,token_hash) VALUES($1,$2,$3,$4,$5) RETURNING id::text,display_name,COALESCE(avatar,'')`, session, name, avatar, request, hash).Scan(&p.ID, &p.DisplayName, &p.Avatar)
	if e != nil {
		if isUniqueViolation(e) {
			_ = tx.Rollback(c)
			if duplicateErr := s.pool.QueryRow(c, `SELECT id::text,display_name,COALESCE(avatar,'') FROM participants WHERE session_id=$1 AND request_id=$2`, session, request).Scan(&p.ID, &p.DisplayName, &p.Avatar); duplicateErr == nil {
				return p, true, nil
			}
		}
		return p, false, mapPG(e)
	}
	if e = insertEvent(c, tx, session, version, "presence.updated", map[string]any{"participant_delta": 1}); e != nil {
		return p, false, e
	}
	if e = tx.Commit(c); e != nil {
		return p, false, e
	}
	return p, false, nil
}
func (s *PostgresStore) ApplyAction(c context.Context, session, host, request string, expected int64, action, slide string, duration int) (Session, bool, error) {
	var out Session
	var prior []byte
	if e := s.pool.QueryRow(c, `SELECT result FROM live_commands WHERE session_id=$1 AND request_id=$2`, session, request).Scan(&prior); e == nil {
		if e = json.Unmarshal(prior, &out); e != nil {
			return out, true, e
		}
		return out, true, nil
	} else if !errors.Is(e, pgx.ErrNoRows) {
		return out, false, e
	}
	tx, e := s.pool.BeginTx(c, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if e != nil {
		return out, false, e
	}
	defer tx.Rollback(c)
	e = scanSession(tx.QueryRow(c, `SELECT id::text,presentation_id::text,host_id::text,join_code,state,state_version,active_slide_id::text,ends_at FROM live_sessions WHERE id=$1 AND host_id=$2 FOR UPDATE`, session, host), &out)
	if errors.Is(e, pgx.ErrNoRows) {
		return out, false, ErrNotFound
	}
	if e != nil {
		return out, false, e
	}
	if e = tx.QueryRow(c, `SELECT result FROM live_commands WHERE session_id=$1 AND request_id=$2`, session, request).Scan(&prior); e == nil {
		if e = json.Unmarshal(prior, &out); e != nil {
			return out, true, e
		}
		return out, true, nil
	} else if !errors.Is(e, pgx.ErrNoRows) {
		return out, false, e
	}
	if out.StateVersion != expected {
		return out, false, ErrConflict
	}
	to, e := actionTarget(out.State, action)
	if e != nil || !CanTransition(out.State, to) {
		return out, false, ErrInvalidTransition
	}
	var active any = out.ActiveSlideID
	var ends any = out.EndsAt
	if action == "open_content" || action == "open_question" {
		var kind string
		var content []byte
		e = tx.QueryRow(c, `SELECT kind,content FROM slides WHERE id=$1 AND presentation_id=$2`, slide, out.PresentationID).Scan(&kind, &content)
		if errors.Is(e, pgx.ErrNoRows) {
			return out, false, ErrNotFound
		}
		if e != nil {
			return out, false, e
		}
		if action == "open_question" && kind != "question" {
			return out, false, ErrInvalid
		}
		active = slide
		if action == "open_question" {
			var configured struct {
				QuestionTime int `json:"question_time"`
			}
			_ = json.Unmarshal(content, &configured)
			if configured.QuestionTime > 0 {
				duration = configured.QuestionTime
			}
			if duration < 1 || duration > 86400 {
				return out, false, ErrInvalid
			}
			ends = time.Now().UTC().Add(time.Duration(duration) * time.Second)
		} else {
			ends = nil
		}
	}
	if action == "end" {
		active = nil
		ends = nil
	}
	e = scanSession(tx.QueryRow(c, `UPDATE live_sessions SET state=$2,state_version=state_version+1,active_slide_id=$3,ends_at=$4,ended_at=CASE WHEN $2='ended' THEN now() ELSE ended_at END,updated_at=now() WHERE id=$1 RETURNING id::text,presentation_id::text,host_id::text,join_code,state,state_version,active_slide_id::text,ends_at`, session, to, active, ends), &out)
	if e != nil {
		return out, false, e
	}
	resultJSON, _ := json.Marshal(out)
	_, e = tx.Exec(c, `INSERT INTO live_commands(session_id,request_id,action,result_state,result_state_version,result) VALUES($1,$2,$3,$4,$5,$6)`, session, request, action, out.State, out.StateVersion, resultJSON)
	if e != nil {
		return out, false, mapPG(e)
	}
	if e = insertEvent(c, tx, session, out.StateVersion, "session.state_changed", map[string]any{"state": out.State, "active_slide_id": out.ActiveSlideID, "ends_at": out.EndsAt}); e != nil {
		return out, false, e
	}
	if action == "close_question" && out.ActiveSlideID != nil {
		stats, statsErr := answerStats(c, tx, session, *out.ActiveSlideID)
		if statsErr != nil {
			return out, false, statsErr
		}
		if e = insertEvent(c, tx, session, out.StateVersion, "answer.stats", stats); e != nil {
			return out, false, e
		}
	}
	if action == "show_leaderboard" {
		leaderboard, leaderboardErr := leaderboardSummary(c, tx, session)
		if leaderboardErr != nil {
			return out, false, leaderboardErr
		}
		if e = insertEvent(c, tx, session, out.StateVersion, "leaderboard.updated", leaderboard); e != nil {
			return out, false, e
		}
	}
	if e = tx.Commit(c); e != nil {
		return out, false, e
	}
	return out, false, nil
}
func (s *PostgresStore) SubmitAnswer(c context.Context, session string, hash []byte, request, slide string, selected []int, policy ScoringPolicy) (AnswerResult, error) {
	var result AnswerResult
	if e := s.pool.QueryRow(c, `SELECT id::text,score_delta FROM answers WHERE session_id=$1 AND request_id=$2`, session, request).Scan(&result.AnswerID, &result.ScoreDelta); e == nil {
		result.Duplicate = true
		return result, nil
	} else if !errors.Is(e, pgx.ErrNoRows) {
		return result, e
	}
	tx, e := s.pool.BeginTx(c, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if e != nil {
		return result, e
	}
	defer tx.Rollback(c)
	var participant, active, state string
	var ends time.Time
	var content []byte
	e = tx.QueryRow(c, `SELECT p.id::text,l.active_slide_id::text,l.state,l.ends_at,sl.content FROM participants p JOIN live_sessions l ON l.id=p.session_id JOIN slides sl ON sl.id=l.active_slide_id WHERE p.session_id=$1 AND p.token_hash=$2 FOR SHARE OF l`, session, hash).Scan(&participant, &active, &state, &ends, &content)
	if errors.Is(e, pgx.ErrNoRows) {
		return result, ErrUnauthorized
	}
	if e != nil {
		return result, e
	}
	if state != string(QuestionOpen) || active != slide || !time.Now().UTC().Before(ends) {
		return result, ErrConflict
	}
	var q struct {
		QuestionType   string `json:"question_type"`
		MaxPoints      int    `json:"max_point"`
		MinPoints      int    `json:"min_point"`
		QuestionTime   int    `json:"question_time"`
		FasterAnswers  bool   `json:"faster_answers_more_points"`
		PartialScoring bool   `json:"partial_scoring"`
		Options        []struct {
			IsCorrect bool `json:"is_correct"`
		} `json:"options"`
	}
	if json.Unmarshal(content, &q) != nil {
		return result, ErrInvalid
	}
	if q.MaxPoints <= 0 {
		q.MaxPoints = 100
	}
	seen := map[int]bool{}
	for _, index := range selected {
		if index >= len(q.Options) || seen[index] {
			return result, ErrInvalid
		}
		seen[index] = true
	}
	if q.QuestionType == "single" && len(selected) != 1 {
		return result, ErrInvalid
	}
	correct := []int{}
	for i, o := range q.Options {
		if o.IsCorrect {
			correct = append(correct, i)
		}
	}
	score := policy.Score(Question{Type: q.QuestionType, Correct: correct, MaxPoints: q.MaxPoints, MinPoints: q.MinPoints, PartialScoring: q.PartialScoring, FasterAnswers: q.FasterAnswers, Duration: time.Duration(q.QuestionTime) * time.Second, Remaining: time.Until(ends)}, selected)
	answer, _ := json.Marshal(map[string]any{"selected_option_indexes": selected})
	e = tx.QueryRow(c, `INSERT INTO answers(session_id,participant_id,question_slide_id,request_id,answer,score_delta) VALUES($1,$2,$3,$4,$5,$6) RETURNING id::text,score_delta`, session, participant, slide, request, answer, score).Scan(&result.AnswerID, &result.ScoreDelta)
	if e != nil {
		if isUniqueViolation(e) {
			_ = tx.Rollback(c)
			if duplicateErr := s.pool.QueryRow(c, `SELECT id::text,score_delta FROM answers WHERE session_id=$1 AND request_id=$2`, session, request).Scan(&result.AnswerID, &result.ScoreDelta); duplicateErr == nil {
				result.Duplicate = true
				return result, nil
			}
		}
		return result, mapPG(e)
	}
	if _, e = tx.Exec(c, `UPDATE participants SET score=score+$2 WHERE id=$1`, participant, score); e != nil {
		return result, e
	}
	if e = tx.Commit(c); e != nil {
		return result, e
	}
	return result, nil
}
func (s *PostgresStore) ParticipantSnapshot(c context.Context, session string, hash []byte) (ParticipantSnapshot, error) {
	var x ParticipantSnapshot
	tx, e := s.pool.BeginTx(c, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if e != nil {
		return x, e
	}
	defer tx.Rollback(c)
	var full Session
	e = tx.QueryRow(c, `SELECT l.id::text,l.presentation_id::text,l.host_id::text,l.join_code,l.state,l.state_version,l.active_slide_id::text,l.ends_at,p.id::text,p.display_name,COALESCE(p.avatar,''),p.score
		FROM live_sessions l JOIN participants p ON p.session_id=l.id
		WHERE l.id=$1 AND p.token_hash=$2`, session, hash).Scan(
		&full.ID, &full.PresentationID, &full.HostID, &full.JoinCode, &full.State, &full.StateVersion, &full.ActiveSlideID, &full.EndsAt,
		&x.Participant.ID, &x.Participant.DisplayName, &x.Participant.Avatar, &x.Participant.Score,
	)
	if errors.Is(e, pgx.ErrNoRows) {
		return x, ErrUnauthorized
	}
	if e != nil {
		return x, e
	}
	x.Role = "participant"
	x.Session = publicSession(full)
	if e = snapshotMeta(c, tx, session, &x.ParticipantCount, &x.LastEventID, full.ActiveSlideID, &x.ActiveSlide); e != nil {
		return x, e
	}
	if e = tx.Commit(c); e != nil {
		return x, e
	}
	return x, nil
}
func (s *PostgresStore) ManagerSnapshot(c context.Context, session, manager string) (ManagerSnapshot, error) {
	var x ManagerSnapshot
	tx, e := s.pool.BeginTx(c, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if e != nil {
		return x, e
	}
	defer tx.Rollback(c)
	e = scanSession(tx.QueryRow(c, `SELECT id::text,presentation_id::text,host_id::text,join_code,state,state_version,active_slide_id::text,ends_at FROM live_sessions WHERE id=$1 AND host_id=$2`, session, manager), &x.Session)
	if errors.Is(e, pgx.ErrNoRows) {
		return x, ErrNotFound
	}
	if e != nil {
		return x, e
	}
	x.Role = "manager"
	if e = snapshotMeta(c, tx, session, &x.ParticipantCount, &x.LastEventID, x.Session.ActiveSlideID, &x.ActiveSlide); e != nil {
		return x, e
	}
	if e = tx.Commit(c); e != nil {
		return x, e
	}
	return x, nil
}
func (s *PostgresStore) Roster(c context.Context, session, manager string, query RosterQuery) (RosterPage, error) {
	page := RosterPage{Items: []RosterEntry{}, Order: query.Order, Limit: query.Limit}
	var owned bool
	if e := s.pool.QueryRow(c, `SELECT EXISTS(SELECT 1 FROM live_sessions WHERE id=$1 AND host_id=$2)`, session, manager).Scan(&owned); e != nil {
		return page, e
	}
	if !owned {
		return page, ErrNotFound
	}
	var rows pgx.Rows
	var e error
	if query.Order == "score" {
		if query.Cursor == nil {
			rows, e = s.pool.Query(c, `SELECT id::text,display_name,COALESCE(avatar,''),score,joined_at FROM participants WHERE session_id=$1 ORDER BY score DESC,joined_at,id LIMIT $2`, session, query.Limit+1)
		} else {
			rows, e = s.pool.Query(c, `SELECT id::text,display_name,COALESCE(avatar,''),score,joined_at FROM participants WHERE session_id=$1 AND (score<$2 OR (score=$2 AND (joined_at,id)>($3,$4::uuid))) ORDER BY score DESC,joined_at,id LIMIT $5`, session, query.Cursor.Score, query.Cursor.JoinedAt, query.Cursor.ID, query.Limit+1)
		}
	} else if query.Cursor == nil {
		rows, e = s.pool.Query(c, `SELECT id::text,display_name,COALESCE(avatar,''),score,joined_at FROM participants WHERE session_id=$1 ORDER BY joined_at,id LIMIT $2`, session, query.Limit+1)
	} else {
		rows, e = s.pool.Query(c, `SELECT id::text,display_name,COALESCE(avatar,''),score,joined_at FROM participants WHERE session_id=$1 AND (joined_at,id)>($2,$3::uuid) ORDER BY joined_at,id LIMIT $4`, session, query.Cursor.JoinedAt, query.Cursor.ID, query.Limit+1)
	}
	if e != nil {
		return page, mapPG(e)
	}
	defer rows.Close()
	for rows.Next() {
		var item RosterEntry
		if e = rows.Scan(&item.ParticipantID, &item.DisplayName, &item.Avatar, &item.Score, &item.JoinedAt); e != nil {
			return page, e
		}
		page.Items = append(page.Items, item)
	}
	if e = rows.Err(); e != nil {
		return page, e
	}
	if len(page.Items) > query.Limit {
		page.HasMore = true
		page.Items = page.Items[:query.Limit]
	}
	return page, nil
}

func snapshotMeta(c context.Context, tx pgx.Tx, session string, participantCount *int, lastEventID *int64, activeSlideID *string, activeSlide *json.RawMessage) error {
	if e := tx.QueryRow(c, `SELECT count(*)::int,COALESCE((SELECT max(event_id) FROM live_events WHERE session_id=$1),0) FROM participants WHERE session_id=$1`, session).Scan(participantCount, lastEventID); e != nil {
		return e
	}
	if activeSlideID != nil {
		if e := tx.QueryRow(c, `SELECT jsonb_build_object('id',id,'position',position,'kind',kind,'content',content) FROM slides WHERE id=$1`, *activeSlideID).Scan(activeSlide); e != nil {
			return e
		}
	}
	return nil
}

func publicSession(session Session) PublicSession {
	return PublicSession{ID: session.ID, PresentationID: session.PresentationID, State: session.State, StateVersion: session.StateVersion, ActiveSlideID: session.ActiveSlideID, EndsAt: session.EndsAt}
}
func (s *PostgresStore) Events(c context.Context, session string, after int64, limit int) ([]Event, error) {
	rows, e := s.pool.Query(c, `SELECT event_id,schema_version,session_id::text,state_version,name,payload,occurred_at FROM live_events WHERE session_id=$1 AND event_id>$2 ORDER BY event_id LIMIT $3`, session, after, limit)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []Event{}
	for rows.Next() {
		var x Event
		if e = rows.Scan(&x.EventID, &x.SchemaVersion, &x.SessionID, &x.StateVersion, &x.Name, &x.Payload, &x.OccurredAt); e != nil {
			return nil, e
		}
		if e = sanitizeReplayedEvent(&x); e != nil {
			return nil, e
		}
		out = append(out, x)
	}
	return out, rows.Err()
}
func (s *PostgresStore) LatestEventID(c context.Context, session string) (int64, error) {
	var id int64
	e := s.pool.QueryRow(c, `SELECT COALESCE(max(event_id),0) FROM live_events WHERE session_id=$1`, session).Scan(&id)
	return id, e
}
func (s *PostgresStore) AuthorizeViewer(c context.Context, session, manager string, hash []byte) error {
	var ok bool
	e := s.pool.QueryRow(c, `SELECT EXISTS(SELECT 1 FROM live_sessions l WHERE l.id=$1 AND (l.host_id::text=$2 OR EXISTS(SELECT 1 FROM participants p WHERE p.session_id=l.id AND p.token_hash=$3)))`, session, manager, hash).Scan(&ok)
	if e != nil {
		return e
	}
	if !ok {
		return ErrUnauthorized
	}
	return nil
}
func scanSession(row pgx.Row, x *Session) error {
	return row.Scan(&x.ID, &x.PresentationID, &x.HostID, &x.JoinCode, &x.State, &x.StateVersion, &x.ActiveSlideID, &x.EndsAt)
}
func insertEvent(c context.Context, tx pgx.Tx, session string, version int64, name string, payload any) error {
	b, _ := json.Marshal(payload)
	schemaVersion := 1
	if name == "leaderboard.updated" {
		schemaVersion = 2
	}
	_, e := tx.Exec(c, `INSERT INTO live_events(schema_version,session_id,state_version,name,payload)VALUES($1,$2,$3,$4,$5)`, schemaVersion, session, version, name, b)
	return e
}

func sanitizeReplayedEvent(event *Event) error {
	if event.Name != "leaderboard.updated" {
		return nil
	}
	var rows []json.RawMessage
	payload := bytes.TrimSpace(event.Payload)
	if len(payload) > 0 && payload[0] == '[' {
		if e := json.Unmarshal(event.Payload, &rows); e != nil {
			return e
		}
		event.Payload, _ = json.Marshal(map[string]int{"participant_count": len(rows)})
	}
	event.SchemaVersion = 2
	return nil
}

func answerStats(c context.Context, tx pgx.Tx, session, slide string) (map[string]any, error) {
	counts := map[string]int{}
	rows, e := tx.Query(c, `SELECT selected.value, count(*)::int
		FROM answers a
		CROSS JOIN LATERAL jsonb_array_elements_text(a.answer->'selected_option_indexes') selected(value)
		WHERE a.session_id=$1 AND a.question_slide_id=$2
		GROUP BY selected.value`, session, slide)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	for rows.Next() {
		var option string
		var count int
		if e = rows.Scan(&option, &count); e != nil {
			return nil, e
		}
		counts[option] = count
	}
	if e = rows.Err(); e != nil {
		return nil, e
	}
	var responseCount int
	if e = tx.QueryRow(c, `SELECT count(*)::int FROM answers WHERE session_id=$1 AND question_slide_id=$2`, session, slide).Scan(&responseCount); e != nil {
		return nil, e
	}
	return map[string]any{"question_slide_id": slide, "response_count": responseCount, "option_counts": counts}, nil
}

func leaderboardSummary(c context.Context, tx pgx.Tx, session string) (map[string]any, error) {
	var participantCount int
	if e := tx.QueryRow(c, `SELECT count(*)::int FROM participants WHERE session_id=$1`, session).Scan(&participantCount); e != nil {
		return nil, e
	}
	return map[string]any{"participant_count": participantCount}, nil
}
func actionTarget(from State, action string) (State, error) {
	switch action {
	case "start":
		return Lobby, nil
	case "open_content":
		return Content, nil
	case "open_question":
		return QuestionOpen, nil
	case "close_question":
		return QuestionClosed, nil
	case "show_leaderboard":
		return Leaderboard, nil
	case "end":
		return Ended, nil
	}
	return from, ErrInvalid
}
func mapPG(e error) error {
	var p *pgconn.PgError
	if errors.As(e, &p) {
		if p.Code == "23505" || p.Code == "40001" {
			return ErrConflict
		}
		if p.Code == "22P02" || p.Code == "23514" {
			return ErrInvalid
		}
	}
	return fmt.Errorf("live store: %w", e)
}

func isUniqueViolation(e error) bool {
	var p *pgconn.PgError
	return errors.As(e, &p) && p.Code == "23505"
}
