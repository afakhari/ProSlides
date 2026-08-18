package presentations

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/proslides/proslides/internal/identity"
	"net/http"
)

type SessionReader interface {
	Current(context.Context, string) (identity.StoredSession, error)
	Authorize(context.Context, string, string) (identity.User, error)
}
type HTTP struct {
	sessions SessionReader
	store    Store
}

func NewHTTP(s SessionReader, store Store) *HTTP { return &HTTP{sessions: s, store: store} }
func (h *HTTP) Register(m *http.ServeMux) {
	m.HandleFunc("GET /api/v1/presentations/{presentationId}", h.get)
	m.HandleFunc("POST /api/v1/presentations", h.create)
	m.HandleFunc("POST /api/v1/presentations/{presentationId}/slides", h.createSlide)
	m.HandleFunc("POST /api/v1/presentations/{presentationId}/questions", h.createQuestion)
}
func (h *HTTP) createQuestion(w http.ResponseWriter, r *http.Request) {
	c, e := r.Cookie("proslides_session")
	if e != nil {
		errJSON(w, 401, "unauthorized")
		return
	}
	u, e := h.sessions.Authorize(r.Context(), c.Value, r.Header.Get("X-CSRF-Token"))
	if e != nil {
		errJSON(w, 403, "csrf_failed")
		return
	}
	var body struct {
		Position                int    `json:"position"`
		Text                    string `json:"text"`
		QuestionType            string `json:"question_type"`
		QuestionTime            int    `json:"question_time"`
		MaxPoint                int    `json:"max_point"`
		MinPoint                int    `json:"min_point"`
		FasterAnswersMorePoints bool   `json:"faster_answers_more_points"`
		PartialScoring          bool   `json:"partial_scoring"`
		Options                 []struct {
			Text      string `json:"text"`
			IsCorrect bool   `json:"is_correct"`
		} `json:"options"`
	}
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		errJSON(w, 400, "invalid_request")
		return
	}
	if body.QuestionTime == 0 {
		body.QuestionTime = 30
	}
	if body.MaxPoint == 0 {
		body.MaxPoint = 100
	}
	if body.Position < 0 || len(body.Text) == 0 || len(body.Options) < 2 || (body.QuestionType != "single" && body.QuestionType != "multiple") || body.QuestionTime < 1 || body.QuestionTime > 86400 || body.MinPoint < 0 || body.MaxPoint < body.MinPoint {
		errJSON(w, 400, "invalid_request")
		return
	}
	correct := 0
	for _, o := range body.Options {
		if len(o.Text) == 0 {
			errJSON(w, 400, "invalid_request")
			return
		}
		if o.IsCorrect {
			correct++
		}
	}
	if correct == 0 || (body.QuestionType == "single" && correct != 1) {
		errJSON(w, 400, "invalid_request")
		return
	}
	content, _ := json.Marshal(map[string]any{"text": body.Text, "question_type": body.QuestionType, "question_time": body.QuestionTime, "max_point": body.MaxPoint, "min_point": body.MinPoint, "faster_answers_more_points": body.FasterAnswersMorePoints, "partial_scoring": body.PartialScoring, "options": body.Options})
	slide, e := h.store.CreateSlide(r.Context(), r.PathValue("presentationId"), u.ID, body.Position, "question", content)
	if errors.Is(e, ErrNotFound) {
		errJSON(w, 404, "not_found")
		return
	}
	if e != nil {
		errJSON(w, 500, "internal_error")
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(201)
	_ = json.NewEncoder(w).Encode(slide)
}
func (h *HTTP) createSlide(w http.ResponseWriter, r *http.Request) {
	c, e := r.Cookie("proslides_session")
	if e != nil {
		errJSON(w, 401, "unauthorized")
		return
	}
	u, e := h.sessions.Authorize(r.Context(), c.Value, r.Header.Get("X-CSRF-Token"))
	if e != nil {
		errJSON(w, 403, "csrf_failed")
		return
	}
	var body struct {
		Position int             `json:"position"`
		Kind     string          `json:"kind"`
		Content  json.RawMessage `json:"content"`
	}
	if json.NewDecoder(r.Body).Decode(&body) != nil || body.Position < 0 || len(body.Kind) == 0 || len(body.Kind) > 100 || !json.Valid(body.Content) {
		errJSON(w, 400, "invalid_request")
		return
	}
	slide, e := h.store.CreateSlide(r.Context(), r.PathValue("presentationId"), u.ID, body.Position, body.Kind, body.Content)
	if errors.Is(e, ErrNotFound) {
		errJSON(w, 404, "not_found")
		return
	}
	if e != nil {
		errJSON(w, 500, "internal_error")
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(201)
	_ = json.NewEncoder(w).Encode(slide)
}
func (h *HTTP) create(w http.ResponseWriter, r *http.Request) {
	c, e := r.Cookie("proslides_session")
	if e != nil {
		errJSON(w, 401, "unauthorized")
		return
	}
	u, e := h.sessions.Authorize(r.Context(), c.Value, r.Header.Get("X-CSRF-Token"))
	if e != nil {
		errJSON(w, 403, "csrf_failed")
		return
	}
	var body struct {
		Title string `json:"title"`
	}
	if json.NewDecoder(r.Body).Decode(&body) != nil || len(body.Title) == 0 || len(body.Title) > 500 {
		errJSON(w, 400, "invalid_request")
		return
	}
	p, e := h.store.Create(r.Context(), u.ID, body.Title)
	if e != nil {
		errJSON(w, 500, "internal_error")
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(p)
}
func (h *HTTP) get(w http.ResponseWriter, r *http.Request) {
	c, e := r.Cookie("proslides_session")
	if e != nil {
		errJSON(w, 401, "unauthorized")
		return
	}
	x, e := h.sessions.Current(r.Context(), c.Value)
	if e != nil {
		errJSON(w, 401, "unauthorized")
		return
	}
	p, e := h.store.FindOwned(r.Context(), r.PathValue("presentationId"), x.User.ID)
	if errors.Is(e, ErrNotFound) {
		errJSON(w, 404, "not_found")
		return
	}
	if e != nil {
		errJSON(w, 500, "internal_error")
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(p)
}
func errJSON(w http.ResponseWriter, s int, e string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(s)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": e})
}
