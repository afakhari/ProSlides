package identity

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type denyLimiter struct{}

func (denyLimiter) Allow(context.Context, string, string, int, time.Duration) (bool, time.Duration, error) {
	return false, 30 * time.Second, nil
}

func TestAuthenticationRateLimitReturnsRetryAfter(t *testing.T) {
	mux := http.NewServeMux()
	NewHTTP(nil, false, denyLimiter{}).Register(mux)
	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", strings.NewReader(`{"email":"user@example.com","password":"password"}`))
	request.RemoteAddr = "192.0.2.10:1234"
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, request)
	if response.Code != http.StatusTooManyRequests || response.Header().Get("Retry-After") != "30" {
		t.Fatalf("status=%d retry=%q", response.Code, response.Header().Get("Retry-After"))
	}
}
