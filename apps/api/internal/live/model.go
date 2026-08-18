package live

import (
	"context"
	"encoding/json"
	"errors"
	"time"
)

var (
	ErrNotFound     = errors.New("live resource not found")
	ErrConflict     = errors.New("live state conflict")
	ErrUnauthorized = errors.New("participant unauthorized")
	ErrInvalid      = errors.New("invalid live request")
	ErrCSRF         = errors.New("csrf validation failed")
)

type Session struct {
	ID             string     `json:"id"`
	PresentationID string     `json:"presentation_id"`
	HostID         string     `json:"host_id"`
	JoinCode       string     `json:"join_code"`
	State          State      `json:"state"`
	StateVersion   int64      `json:"state_version"`
	ActiveSlideID  *string    `json:"active_slide_id"`
	EndsAt         *time.Time `json:"ends_at"`
}
type Participant struct {
	ID          string `json:"id"`
	DisplayName string `json:"display_name"`
	Avatar      string `json:"avatar,omitempty"`
}
type AnswerResult struct {
	AnswerID   string `json:"answer_id"`
	ScoreDelta int    `json:"score_delta"`
	Duplicate  bool   `json:"duplicate"`
}
type Event struct {
	EventID       int64           `json:"event_id"`
	SchemaVersion int             `json:"schema_version"`
	SessionID     string          `json:"session_id"`
	StateVersion  int64           `json:"state_version"`
	Name          string          `json:"name"`
	Payload       json.RawMessage `json:"payload"`
	OccurredAt    time.Time       `json:"occurred_at"`
}
type Snapshot struct {
	Session          Session         `json:"session"`
	ActiveSlide      json.RawMessage `json:"active_slide,omitempty"`
	Participants     []Participant   `json:"participants"`
	Scores           map[string]int  `json:"scores"`
	ParticipantCount int             `json:"participant_count"`
	LastEventID      int64           `json:"last_event_id"`
}

type Store interface {
	CreateSession(context.Context, string, string, string, string) (Session, bool, error)
	Join(context.Context, string, string, string, string, []byte) (Participant, bool, error)
	ApplyAction(context.Context, string, string, string, int64, string, string, int) (Session, bool, error)
	SubmitAnswer(context.Context, string, []byte, string, string, []int, ScoringPolicy) (AnswerResult, error)
	Snapshot(context.Context, string) (Snapshot, error)
	Events(context.Context, string, int64, int) ([]Event, error)
	LatestEventID(context.Context, string) (int64, error)
	AuthorizeViewer(context.Context, string, string, []byte) error
}

type EventStore interface {
	Events(context.Context, string, int64, int) ([]Event, error)
	LatestEventID(context.Context, string) (int64, error)
}
