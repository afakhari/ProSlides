package platformhttp

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/proslides/proslides/internal/platform/config"
)

func TestHealthz(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	res := httptest.NewRecorder()

	NewRouter(config.Config{Environment: "test"}).ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", res.Code, http.StatusOK)
	}
	if res.Header().Get("X-Request-ID") == "" {
		t.Fatal("missing request ID")
	}
}
