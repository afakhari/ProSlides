package presentations

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/proslides/proslides/internal/identity"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type fakeSessions struct{ err error }

func (f fakeSessions) Current(context.Context, string) (identity.StoredSession, error) {
	if f.err != nil {
		return identity.StoredSession{}, f.err
	}
	return identity.StoredSession{User: identity.User{ID: "owner"}}, nil
}
func (f fakeSessions) Authorize(context.Context, string, string) (identity.User, error) {
	if f.err != nil {
		return identity.User{}, f.err
	}
	return identity.User{ID: "owner"}, nil
}

type fakeStore struct {
	p     Presentation
	err   error
	owner string
}

func (f *fakeStore) FindOwned(_ context.Context, _ string, owner string) (Presentation, error) {
	f.owner = owner
	return f.p, f.err
}
func (f *fakeStore) Create(_ context.Context, owner, title string) (Presentation, error) {
	f.owner = owner
	return Presentation{ID: "new", Title: title, Slides: []Slide{}}, f.err
}
func (f *fakeStore) CreateSlide(_ context.Context, _ string, owner string, position int, kind string, content json.RawMessage) (Slide, error) {
	f.owner = owner
	return Slide{ID: "slide", Position: position, Kind: kind, Content: content}, f.err
}
func TestGetPresentationRequiresSession(t *testing.T) {
	m := http.NewServeMux()
	NewHTTP(fakeSessions{}, &fakeStore{}).Register(m)
	r := httptest.NewRecorder()
	m.ServeHTTP(r, httptest.NewRequest(http.MethodGet, "/api/v1/presentations/x", nil))
	if r.Code != 401 {
		t.Fatalf("status=%d", r.Code)
	}
}
func TestGetPresentationReturnsOwnedSlides(t *testing.T) {
	m := http.NewServeMux()
	s := &fakeStore{p: Presentation{ID: "p", Title: "Demo", Slides: []Slide{{ID: "s", Position: 0, Kind: "content", Content: []byte(`{"text":"hello"}`)}}}}
	NewHTTP(fakeSessions{}, s).Register(m)
	q := httptest.NewRequest(http.MethodGet, "/api/v1/presentations/p", nil)
	q.AddCookie(&http.Cookie{Name: "proslides_session", Value: "token"})
	r := httptest.NewRecorder()
	m.ServeHTTP(r, q)
	if r.Code != 200 || s.owner != "owner" {
		t.Fatalf("status=%d owner=%s", r.Code, s.owner)
	}
}
func TestGetPresentationHidesMissingAndUnauthorized(t *testing.T) {
	m := http.NewServeMux()
	NewHTTP(fakeSessions{}, &fakeStore{err: ErrNotFound}).Register(m)
	q := httptest.NewRequest(http.MethodGet, "/api/v1/presentations/p", nil)
	q.AddCookie(&http.Cookie{Name: "proslides_session", Value: "token"})
	r := httptest.NewRecorder()
	m.ServeHTTP(r, q)
	if r.Code != 404 {
		t.Fatalf("status=%d", r.Code)
	}
	_ = errors.New
}

func TestCreateSlideRequiresCSRFAndCreatesForOwner(t *testing.T) {
	m := http.NewServeMux()
	store := &fakeStore{}
	NewHTTP(fakeSessions{}, store).Register(m)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/presentations/p/slides", strings.NewReader(`{"position":0,"kind":"content","content":{"text":"hello"}}`))
	req.AddCookie(&http.Cookie{Name: "proslides_session", Value: "token"})
	req.Header.Set("X-CSRF-Token", "csrf")
	res := httptest.NewRecorder()
	m.ServeHTTP(res, req)
	if res.Code != http.StatusCreated || store.owner != "owner" {
		t.Fatalf("status=%d owner=%s", res.Code, store.owner)
	}
}
func TestCreateMultipleQuestion(t *testing.T) {
	m := http.NewServeMux()
	NewHTTP(fakeSessions{}, &fakeStore{}).Register(m)
	q := httptest.NewRequest(http.MethodPost, "/api/v1/presentations/p/questions", strings.NewReader(`{"position":1,"text":"Choose","question_type":"multiple","options":[{"text":"A","is_correct":true},{"text":"B","is_correct":true}]}`))
	q.AddCookie(&http.Cookie{Name: "proslides_session", Value: "t"})
	q.Header.Set("X-CSRF-Token", "c")
	r := httptest.NewRecorder()
	m.ServeHTTP(r, q)
	if r.Code != 201 {
		t.Fatalf("status=%d", r.Code)
	}
}
