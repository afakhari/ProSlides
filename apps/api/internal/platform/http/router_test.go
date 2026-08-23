package platformhttp

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/proslides/proslides/internal/platform/config"
)

type fakeDependency struct {
	name string
	ping func(context.Context) error
}

type flushCountingWriter struct {
	header      http.Header
	headerCalls int
}

func (w *flushCountingWriter) Header() http.Header { return w.header }
func (w *flushCountingWriter) Write(body []byte) (int, error) {
	return len(body), nil
}
func (w *flushCountingWriter) WriteHeader(int) { w.headerCalls++ }
func (w *flushCountingWriter) Flush()          {}

func TestMetricsWriterFlushCommitsHeaderOnce(t *testing.T) {
	underlying := &flushCountingWriter{header: make(http.Header)}
	writer := &metricsWriter{ResponseWriter: underlying, status: http.StatusOK}

	writer.Flush()
	writer.WriteHeader(http.StatusOK)

	if underlying.headerCalls != 1 {
		t.Fatalf("header writes = %d, want 1", underlying.headerCalls)
	}
}

func (d fakeDependency) Name() string { return d.name }

func (d fakeDependency) Ping(ctx context.Context) error { return d.ping(ctx) }

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

func TestReadyzReturnsOKWhenAllDependenciesAreReachable(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	res := httptest.NewRecorder()

	NewRouter(config.Config{Environment: "test", DependencyCheckTimeout: time.Second},
		fakeDependency{name: "postgres", ping: func(context.Context) error { return nil }},
		fakeDependency{name: "redis", ping: func(context.Context) error { return nil }},
	).ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", res.Code, http.StatusOK)
	}
	var payload readinessResponse
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.Status != "ready" || payload.Dependencies["postgres"] != "ok" || payload.Dependencies["redis"] != "ok" {
		t.Fatalf("unexpected readiness payload: %#v", payload)
	}
}

func TestReadyzReturnsServiceUnavailableWithoutLeakingDependencyError(t *testing.T) {
	for _, unavailable := range []string{"postgres", "redis"} {
		t.Run(unavailable, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
			res := httptest.NewRecorder()
			secretError := errors.New("postgres://username:password@private-host:5432/proslides")

			NewRouter(config.Config{Environment: "test", DependencyCheckTimeout: time.Second},
				fakeDependency{name: "postgres", ping: func(context.Context) error {
					if unavailable == "postgres" {
						return secretError
					}
					return nil
				}},
				fakeDependency{name: "redis", ping: func(context.Context) error {
					if unavailable == "redis" {
						return secretError
					}
					return nil
				}},
			).ServeHTTP(res, req)

			if res.Code != http.StatusServiceUnavailable {
				t.Fatalf("status = %d, want %d", res.Code, http.StatusServiceUnavailable)
			}
			if body := res.Body.String(); body == "" || strings.Contains(body, secretError.Error()) {
				t.Fatalf("unsafe readiness body: %q", body)
			}
		})
	}
}

func TestReadyzRejectsMissingDependencyConfiguration(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	res := httptest.NewRecorder()

	NewRouter(config.Config{Environment: "test", DependencyCheckTimeout: time.Second}).ServeHTTP(res, req)

	if res.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", res.Code, http.StatusServiceUnavailable)
	}
}

func TestReadyzMapsTimeoutToServiceUnavailable(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	res := httptest.NewRecorder()

	NewRouter(config.Config{Environment: "test", DependencyCheckTimeout: time.Millisecond},
		fakeDependency{name: "postgres", ping: func(ctx context.Context) error { <-ctx.Done(); return ctx.Err() }},
		fakeDependency{name: "redis", ping: func(context.Context) error { return nil }},
	).ServeHTTP(res, req)

	if res.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", res.Code, http.StatusServiceUnavailable)
	}
}
