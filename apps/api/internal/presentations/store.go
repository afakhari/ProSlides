package presentations

import (
	"context"
	"encoding/json"
	"errors"
	"time"
)

var ErrNotFound = errors.New("presentation not found")

type Slide struct {
	ID       string          `json:"id"`
	Position int             `json:"position"`
	Kind     string          `json:"kind"`
	Content  json.RawMessage `json:"content"`
}
type Presentation struct {
	ID        string          `json:"id"`
	Title     string          `json:"title"`
	Settings  json.RawMessage `json:"settings"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
	Slides    []Slide         `json:"slides"`
}
type PresentationSummary struct {
	ID               string          `json:"id"`
	Title            string          `json:"title"`
	Settings         json.RawMessage `json:"settings"`
	SlideCount       int             `json:"slide_count"`
	ParticipantCount int             `json:"participant_count"`
	CreatedAt        time.Time       `json:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at"`
}
type PresentationPatch struct {
	Title    *string
	Settings json.RawMessage
}
type SessionLocator struct {
	SessionID      string `json:"session_id"`
	PresentationID string `json:"presentation_id"`
}
type Store interface {
	ListOwned(context.Context, string) ([]PresentationSummary, error)
	FindOwned(context.Context, string, string) (Presentation, error)
	Create(context.Context, string, string, json.RawMessage) (Presentation, error)
	Update(context.Context, string, string, PresentationPatch) (Presentation, error)
	Delete(context.Context, string, string) error
	Duplicate(context.Context, string, string, string) (Presentation, error)
	LatestSession(context.Context, string, string) (SessionLocator, error)
	DeleteResults(context.Context, string, string) error
	CreateSlide(context.Context, string, string, int, string, json.RawMessage) (Slide, error)
	ReplaceSlide(context.Context, string, string, string, int, string, json.RawMessage) (Slide, error)
	DeleteSlide(context.Context, string, string, string) error
	ReorderSlides(context.Context, string, string, []string) error
}
