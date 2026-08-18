package identity

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"
)

type HTTP struct {
	service *Service
	secure  bool
}

func NewHTTP(s *Service, secure bool) *HTTP { return &HTTP{service: s, secure: secure} }
func (h *HTTP) Register(m *http.ServeMux) {
	m.HandleFunc("POST /api/v1/auth/register", h.register)
	m.HandleFunc("POST /api/v1/auth/login", h.login)
	m.HandleFunc("POST /api/v1/auth/logout", h.logout)
	m.HandleFunc("GET /api/v1/auth/me", h.me)
}

type credentials struct {
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	Password    string `json:"password"`
}

func (h *HTTP) register(w http.ResponseWriter, r *http.Request) {
	var v credentials
	if json.NewDecoder(r.Body).Decode(&v) != nil {
		errJSON(w, 400, "invalid_request")
		return
	}
	a, e := h.service.Register(r.Context(), Registration{v.Email, v.DisplayName, v.Password})
	h.auth(w, a, e, http.StatusCreated)
}
func (h *HTTP) login(w http.ResponseWriter, r *http.Request) {
	var v credentials
	if json.NewDecoder(r.Body).Decode(&v) != nil {
		errJSON(w, 400, "invalid_request")
		return
	}
	a, e := h.service.Login(r.Context(), v.Email, v.Password)
	h.auth(w, a, e, http.StatusOK)
}
func (h *HTTP) auth(w http.ResponseWriter, a Authenticated, e error, successStatus int) {
	if e != nil {
		if errors.Is(e, ErrInvalidRegistration) {
			errJSON(w, 400, "invalid_request")
		} else if errors.Is(e, ErrEmailTaken) {
			errJSON(w, 409, "email_taken")
		} else {
			errJSON(w, 401, "invalid_credentials")
		}
		return
	}
	exp := a.Secrets.ExpiresAt
	http.SetCookie(w, &http.Cookie{Name: "proslides_session", Value: a.Secrets.Token, Path: "/", Expires: exp, HttpOnly: true, Secure: h.secure, SameSite: http.SameSiteLaxMode})
	http.SetCookie(w, &http.Cookie{Name: "proslides_csrf", Value: a.Secrets.CSRFToken, Path: "/", Expires: exp, Secure: h.secure, SameSite: http.SameSiteLaxMode})
	w.WriteHeader(successStatus)
	json.NewEncoder(w).Encode(map[string]string{"id": a.User.ID, "email": a.User.Email, "display_name": a.User.DisplayName})
}
func (h *HTTP) me(w http.ResponseWriter, r *http.Request) {
	c, e := r.Cookie("proslides_session")
	if e != nil {
		errJSON(w, 401, "unauthorized")
		return
	}
	s, e := h.service.Current(r.Context(), c.Value)
	if e != nil {
		errJSON(w, 401, "unauthorized")
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"id": s.User.ID, "email": s.User.Email, "display_name": s.User.DisplayName})
}
func (h *HTTP) logout(w http.ResponseWriter, r *http.Request) {
	s, _ := r.Cookie("proslides_session")
	c, _ := r.Cookie("proslides_csrf")
	if s == nil || c == nil || r.Header.Get("X-CSRF-Token") != c.Value || h.service.Logout(r.Context(), s.Value, c.Value) != nil {
		errJSON(w, 403, "csrf_failed")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "proslides_session", Value: "", Path: "/", MaxAge: -1, HttpOnly: true, Secure: h.secure})
	http.SetCookie(w, &http.Cookie{Name: "proslides_csrf", Value: "", Path: "/", MaxAge: -1, Secure: h.secure})
	w.WriteHeader(204)
}
func errJSON(w http.ResponseWriter, s int, e string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(s)
	json.NewEncoder(w).Encode(map[string]string{"error": e})
}

var _ = time.Now
