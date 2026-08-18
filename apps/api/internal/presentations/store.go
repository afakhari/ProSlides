package presentations

import (
	"context"
	"encoding/json"
	"errors"
)

var ErrNotFound = errors.New("presentation not found")

type Slide struct {
	ID       string          `json:"id"`
	Position int             `json:"position"`
	Kind     string          `json:"kind"`
	Content  json.RawMessage `json:"content"`
}
type Presentation struct {
	ID     string  `json:"id"`
	Title  string  `json:"title"`
	Slides []Slide `json:"slides"`
}
type Store interface {
	FindOwned(context.Context, string, string) (Presentation, error)
	Create(context.Context, string, string) (Presentation, error)
	CreateSlide(context.Context, string, string, int, string, json.RawMessage) (Slide, error)
}
