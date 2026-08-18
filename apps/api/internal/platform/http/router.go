package platformhttp

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/proslides/proslides/internal/platform/config"
	"github.com/proslides/proslides/internal/platform/dependency"
)

func NewRouter(cfg config.Config, dependencies ...dependency.Dependency) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", health)
	mux.HandleFunc("GET /readyz", readiness(cfg, dependencies))
	mux.HandleFunc("GET /api/v1/version", version(cfg))
	return requestID(recoverer(mux))
}

func health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

type readinessResponse struct {
	Status       string            `json:"status"`
	Dependencies map[string]string `json:"dependencies"`
}

func readiness(cfg config.Config, dependencies []dependency.Dependency) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		statuses := make(map[string]string, len(dependencies))
		if len(dependencies) == 0 {
			statuses["configuration"] = "unavailable"
			writeJSON(w, http.StatusServiceUnavailable, readinessResponse{
				Status:       "not_ready",
				Dependencies: statuses,
			})
			return
		}

		ready := true
		for _, service := range dependencies {
			checkCtx, cancel := context.WithTimeout(r.Context(), cfg.DependencyCheckTimeout)
			err := service.Ping(checkCtx)
			cancel()
			if err != nil {
				statuses[service.Name()] = "unavailable"
				ready = false
				continue
			}
			statuses[service.Name()] = "ok"
		}

		status := http.StatusOK
		payloadStatus := "ready"
		if !ready {
			status = http.StatusServiceUnavailable
			payloadStatus = "not_ready"
		}
		writeJSON(w, status, readinessResponse{
			Status:       payloadStatus,
			Dependencies: statuses,
		})
	}
}

func version(cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{
			"service":     "proslides-api",
			"environment": cfg.Environment,
			"api_version": "v1",
		})
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func requestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := r.Header.Get("X-Request-ID")
		if requestID == "" {
			requestID = time.Now().UTC().Format("20060102T150405.000000000Z")
		}
		w.Header().Set("X-Request-ID", requestID)
		next.ServeHTTP(w, r)
	})
}

func recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if recover() != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			}
		}()
		next.ServeHTTP(w, r)
	})
}
