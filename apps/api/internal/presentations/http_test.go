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
func (f *fakeStore) ListOwned(_ context.Context, owner string) ([]PresentationSummary, error) {
	f.owner = owner
	return []PresentationSummary{}, f.err
}
func (f *fakeStore) Create(_ context.Context, owner, title string, _ json.RawMessage) (Presentation, error) {
	f.owner = owner
	return Presentation{ID: "new", Title: title, Slides: []Slide{}}, f.err
}
func (f *fakeStore) Update(_ context.Context, _, owner string, patch PresentationPatch) (Presentation, error) {
	f.owner = owner
	title := f.p.Title
	if patch.Title != nil {
		title = *patch.Title
	}
	return Presentation{ID: "p", Title: title, Settings: patch.Settings, Slides: []Slide{}}, f.err
}
func (f *fakeStore) Delete(_ context.Context, _, owner string) error { f.owner = owner; return f.err }
func (f *fakeStore) Duplicate(_ context.Context, _, owner, title string) (Presentation, error) {
	f.owner = owner
	return Presentation{ID: "copy", Title: title, Slides: []Slide{}}, f.err
}
func (f *fakeStore) LatestSession(_ context.Context, _, owner string) (SessionLocator, error) {
	f.owner = owner
	return SessionLocator{SessionID: "session", PresentationID: "p"}, f.err
}
func (f *fakeStore) DeleteResults(_ context.Context, _, owner string) error {
	f.owner = owner
	return f.err
}
func (f *fakeStore) CreateSlide(_ context.Context, _ string, owner string, position int, kind string, content json.RawMessage) (Slide, error) {
	f.owner = owner
	return Slide{ID: "slide", Position: position, Kind: kind, Content: content}, f.err
}
func (f *fakeStore) ReplaceSlide(_ context.Context, _, _, owner string, position int, kind string, content json.RawMessage) (Slide, error) {
	f.owner = owner
	return Slide{ID: "slide", Position: position, Kind: kind, Content: content}, f.err
}
func (f *fakeStore) DeleteSlide(_ context.Context, _, _, owner string) error {
	f.owner = owner
	return f.err
}
func (f *fakeStore) ReorderSlides(_ context.Context, _, owner string, _ []string) error {
	f.owner = owner
	return f.err
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

func TestListPresentationsRequiresSession(t *testing.T) {
	m := http.NewServeMux()
	NewHTTP(fakeSessions{}, &fakeStore{}).Register(m)
	r := httptest.NewRecorder()
	m.ServeHTTP(r, httptest.NewRequest(http.MethodGet, "/api/v1/presentations", nil))
	if r.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d", r.Code)
	}
}

func TestUpdatePresentationAndReplaceSlideAreOwnerScoped(t *testing.T) {
	m := http.NewServeMux()
	store := &fakeStore{}
	NewHTTP(fakeSessions{}, store).Register(m)

	update := httptest.NewRequest(http.MethodPatch, "/api/v1/presentations/p", strings.NewReader(`{"title":"Renamed","settings":{"background_color":"#fff"}}`))
	update.AddCookie(&http.Cookie{Name: "proslides_session", Value: "token"})
	update.Header.Set("X-CSRF-Token", "csrf")
	updateResult := httptest.NewRecorder()
	m.ServeHTTP(updateResult, update)
	if updateResult.Code != http.StatusOK || store.owner != "owner" {
		t.Fatalf("status=%d owner=%s", updateResult.Code, store.owner)
	}

	replace := httptest.NewRequest(http.MethodPut, "/api/v1/presentations/p/slides/s", strings.NewReader(`{"position":0,"kind":"content","content":{"text":"updated"}}`))
	replace.AddCookie(&http.Cookie{Name: "proslides_session", Value: "token"})
	replace.Header.Set("X-CSRF-Token", "csrf")
	replaceResult := httptest.NewRecorder()
	m.ServeHTTP(replaceResult, replace)
	if replaceResult.Code != http.StatusOK || store.owner != "owner" {
		t.Fatalf("status=%d owner=%s", replaceResult.Code, store.owner)
	}
}

func TestReorderRejectsDuplicateSlideIDs(t *testing.T) {
	m := http.NewServeMux()
	NewHTTP(fakeSessions{}, &fakeStore{}).Register(m)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/presentations/p/slides/reorder", strings.NewReader(`{"slide_ids":["same","same"]}`))
	req.AddCookie(&http.Cookie{Name: "proslides_session", Value: "token"})
	req.Header.Set("X-CSRF-Token", "csrf")
	result := httptest.NewRecorder()
	m.ServeHTTP(result, req)
	if result.Code != http.StatusBadRequest {
		t.Fatalf("status=%d", result.Code)
	}
}

func TestPresentationAndSlideJSONFieldsRejectNull(t *testing.T) {
	m := http.NewServeMux()
	NewHTTP(fakeSessions{}, &fakeStore{}).Register(m)
	for _, testCase := range []struct {
		method string
		path   string
		body   string
	}{
		{http.MethodPatch, "/api/v1/presentations/p", `{"settings":null}`},
		{http.MethodPost, "/api/v1/presentations/p/slides", `{"position":0,"kind":"content","content":null}`},
	} {
		req := httptest.NewRequest(testCase.method, testCase.path, strings.NewReader(testCase.body))
		req.AddCookie(&http.Cookie{Name: "proslides_session", Value: "token"})
		req.Header.Set("X-CSRF-Token", "csrf")
		result := httptest.NewRecorder()
		m.ServeHTTP(result, req)
		if result.Code != http.StatusBadRequest {
			t.Fatalf("%s %s status=%d", testCase.method, testCase.path, result.Code)
		}
	}
}
