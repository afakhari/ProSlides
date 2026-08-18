package live

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/proslides/proslides/internal/identity"
)

type ManagerAuth interface {
	Current(context.Context, string) (identity.StoredSession, error)
	Authorize(context.Context, string, string) (identity.User, error)
}
type HTTP struct {
	service *Service
	auth    ManagerAuth
	secure  bool
}

func NewHTTP(service *Service, auth ManagerAuth, secure bool) *HTTP {
	return &HTTP{service: service, auth: auth, secure: secure}
}
func (h *HTTP) Register(m *http.ServeMux) {
	m.HandleFunc("POST /api/v1/live/sessions", h.createSession)
	m.HandleFunc("POST /api/v1/live/sessions/{sessionId}/join", h.join)
	m.HandleFunc("POST /api/v1/live/sessions/{sessionId}/actions", h.action)
	m.HandleFunc("POST /api/v1/live/sessions/{sessionId}/answers", h.answer)
	m.HandleFunc("GET /api/v1/live/sessions/{sessionId}/snapshot", h.snapshot)
	m.HandleFunc("GET /api/v1/live/sessions/{sessionId}/events", h.events)
}
func (h *HTTP) createSession(w http.ResponseWriter, r *http.Request) {
	u, e := h.manager(r, true)
	if e != nil {
		returnError(w, e)
		return
	}
	var b struct {
		RequestID      string `json:"request_id"`
		PresentationID string `json:"presentation_id"`
	}
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		returnError(w, ErrInvalid)
		return
	}
	x, dup, e := h.service.CreateSession(r.Context(), u.ID, b.PresentationID, b.RequestID)
	if e != nil {
		returnError(w, e)
		return
	}
	writeJSON(w, map[bool]int{true: 200, false: 201}[dup], x)
}
func (h *HTTP) join(w http.ResponseWriter, r *http.Request) {
	var b struct {
		RequestID   string `json:"request_id"`
		DisplayName string `json:"display_name"`
		Avatar      string `json:"avatar"`
	}
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		returnError(w, ErrInvalid)
		return
	}
	p, dup, e := h.service.Join(r.Context(), r.PathValue("sessionId"), b.RequestID, b.DisplayName, b.Avatar)
	if e != nil {
		returnError(w, e)
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "proslides_participant", Value: b.RequestID, Path: "/api/v1/live/sessions/" + r.PathValue("sessionId"), HttpOnly: true, Secure: h.secure, SameSite: http.SameSiteLaxMode})
	writeJSON(w, map[bool]int{true: 200, false: 201}[dup], p)
}
func (h *HTTP) action(w http.ResponseWriter, r *http.Request) {
	u, e := h.manager(r, true)
	if e != nil {
		returnError(w, e)
		return
	}
	var b struct {
		RequestID            string `json:"request_id"`
		ExpectedStateVersion int64  `json:"expected_state_version"`
		Action               string `json:"action"`
		SlideID              string `json:"slide_id"`
		DurationSeconds      int    `json:"duration_seconds"`
	}
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		returnError(w, ErrInvalid)
		return
	}
	x, dup, e := h.service.Action(r.Context(), r.PathValue("sessionId"), u.ID, b.RequestID, b.ExpectedStateVersion, b.Action, b.SlideID, b.DurationSeconds)
	if e != nil {
		returnError(w, e)
		return
	}
	writeJSON(w, map[bool]int{true: 200, false: 201}[dup], x)
}
func (h *HTTP) answer(w http.ResponseWriter, r *http.Request) {
	token, e := r.Cookie("proslides_participant")
	if e != nil {
		returnError(w, ErrUnauthorized)
		return
	}
	var b struct {
		RequestID       string `json:"request_id"`
		QuestionSlideID string `json:"question_slide_id"`
		Selected        []int  `json:"selected_option_indexes"`
	}
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		returnError(w, ErrInvalid)
		return
	}
	x, e := h.service.Submit(r.Context(), r.PathValue("sessionId"), token.Value, b.RequestID, b.QuestionSlideID, b.Selected)
	if e != nil {
		returnError(w, e)
		return
	}
	status := 201
	if x.Duplicate {
		status = 200
	}
	writeJSON(w, status, x)
}
func (h *HTTP) snapshot(w http.ResponseWriter, r *http.Request) {
	if e := h.viewer(r); e != nil {
		returnError(w, e)
		return
	}
	x, e := h.service.Snapshot(r.Context(), r.PathValue("sessionId"))
	if e != nil {
		returnError(w, e)
		return
	}
	writeJSON(w, 200, x)
}
func (h *HTTP) events(w http.ResponseWriter, r *http.Request) {
	if e := h.viewer(r); e != nil {
		returnError(w, e)
		return
	}
	f, ok := w.(http.Flusher)
	if !ok {
		returnError(w, errors.New("stream unsupported"))
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache, no-store")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	after, _ := strconv.ParseInt(r.Header.Get("Last-Event-ID"), 10, 64)
	ticker := time.NewTicker(500 * time.Millisecond)
	heartbeat := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	defer heartbeat.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case <-heartbeat.C:
			fmt.Fprint(w, ": heartbeat\n\n")
			f.Flush()
		case <-ticker.C:
			events, e := h.service.Events(r.Context(), r.PathValue("sessionId"), after)
			if e != nil {
				return
			}
			for _, event := range events {
				data, _ := json.Marshal(event)
				fmt.Fprintf(w, "id: %d\nevent: %s\ndata: %s\n\n", event.EventID, event.Name, data)
				after = event.EventID
			}
			if len(events) > 0 {
				f.Flush()
			}
		}
	}
}
func (h *HTTP) manager(r *http.Request, csrf bool) (identity.User, error) {
	c, e := r.Cookie("proslides_session")
	if e != nil {
		return identity.User{}, ErrUnauthorized
	}
	if csrf {
		u, e := h.auth.Authorize(r.Context(), c.Value, r.Header.Get("X-CSRF-Token"))
		if e != nil {
			return identity.User{}, ErrCSRF
		}
		return u, nil
	}
	s, e := h.auth.Current(r.Context(), c.Value)
	return s.User, e
}
func (h *HTTP) viewer(r *http.Request) error {
	manager := ""
	if u, e := h.manager(r, false); e == nil {
		manager = u.ID
	}
	participant := ""
	if c, e := r.Cookie("proslides_participant"); e == nil {
		participant = c.Value
	}
	return h.service.AuthorizeViewer(r.Context(), r.PathValue("sessionId"), manager, participant)
}
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func returnError(w http.ResponseWriter, e error) {
	status, code := 500, "internal_error"
	switch {
	case errors.Is(e, identity.ErrInvalidCredentials), errors.Is(e, ErrUnauthorized):
		status, code = 401, "unauthorized"
	case errors.Is(e, ErrCSRF):
		status, code = 403, "csrf_failed"
	case errors.Is(e, ErrInvalid):
		status, code = 400, "invalid_request"
	case errors.Is(e, ErrNotFound):
		status, code = 404, "not_found"
	case errors.Is(e, ErrConflict), errors.Is(e, ErrInvalidTransition):
		status, code = 409, "conflict"
	}
	writeJSON(w, status, map[string]string{"error": code})
}
