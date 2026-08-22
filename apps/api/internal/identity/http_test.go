package identity

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"strings"
	"testing"
	"time"
)

type denyLimiter struct{}

func (denyLimiter) Allow(context.Context, string, string, int, time.Duration) (bool, time.Duration, error) {
	return false, 30 * time.Second, nil
}

type captureLimiter struct{ identifier string }

func (l *captureLimiter) Allow(_ context.Context, _, identifier string, _ int, _ time.Duration) (bool, time.Duration, error) {
	l.identifier = identifier
	return false, time.Second, nil
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

func TestRateLimitIgnoresForwardedAddressFromUntrustedPeer(t *testing.T) {
	limiter := &captureLimiter{}
	mux := http.NewServeMux()
	NewHTTP(nil, false, limiter).WithTrustedProxyCIDRs([]netip.Prefix{netip.MustParsePrefix("10.0.0.0/8")}).Register(mux)
	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", strings.NewReader(`{"email":"user@example.com","password":"password"}`))
	request.RemoteAddr = "192.0.2.10:1234"
	request.Header.Set("X-Forwarded-For", "198.51.100.20")
	mux.ServeHTTP(httptest.NewRecorder(), request)
	if limiter.identifier != "192.0.2.10" {
		t.Fatalf("identifier=%q, want direct untrusted peer", limiter.identifier)
	}
}

func TestRateLimitUsesRightMostUntrustedForwardedAddress(t *testing.T) {
	limiter := &captureLimiter{}
	mux := http.NewServeMux()
	NewHTTP(nil, false, limiter).WithTrustedProxyCIDRs([]netip.Prefix{netip.MustParsePrefix("10.0.0.0/8")}).Register(mux)
	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", strings.NewReader(`{"email":"user@example.com","password":"password"}`))
	request.RemoteAddr = "10.0.0.5:1234"
	request.Header.Set("X-Forwarded-For", "203.0.113.99, 198.51.100.20, 10.0.0.4")
	mux.ServeHTTP(httptest.NewRecorder(), request)
	if limiter.identifier != "198.51.100.20" {
		t.Fatalf("identifier=%q, want right-most untrusted address", limiter.identifier)
	}
}
