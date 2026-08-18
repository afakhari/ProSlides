package config

import (
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"
)

// Config contains only process-wide configuration. Domain configuration belongs
// to its owning module, not to this package.
type Config struct {
	Environment            string
	HTTPAddr               string
	LogLevel               slog.Level
	DatabaseURL            string
	RedisURL               string
	DependencyCheckTimeout time.Duration
	SessionTTL             time.Duration
}

func Load() (Config, error) {
	cfg := Config{
		Environment: valueOrDefault("APP_ENV", "development"),
		HTTPAddr:    valueOrDefault("HTTP_ADDR", ":8080"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		RedisURL:    os.Getenv("REDIS_URL"),
	}

	sessionTTL, err := time.ParseDuration(valueOrDefault("SESSION_TTL", "168h"))
	if err != nil || sessionTTL <= 0 {
		return Config{}, fmt.Errorf("SESSION_TTL must be a positive duration")
	}
	cfg.SessionTTL = sessionTTL

	dependencyCheckTimeout, err := time.ParseDuration(valueOrDefault("DEPENDENCY_CHECK_TIMEOUT", "2s"))
	if err != nil || dependencyCheckTimeout <= 0 {
		return Config{}, fmt.Errorf("DEPENDENCY_CHECK_TIMEOUT must be a positive duration")
	}
	cfg.DependencyCheckTimeout = dependencyCheckTimeout

	level, err := parseLogLevel(valueOrDefault("LOG_LEVEL", "INFO"))
	if err != nil {
		return Config{}, err
	}
	cfg.LogLevel = level

	if cfg.DatabaseURL == "" || cfg.RedisURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL and REDIS_URL are required")
	}
	return cfg, nil
}

func valueOrDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func parseLogLevel(raw string) (slog.Level, error) {
	switch strings.ToUpper(raw) {
	case "DEBUG":
		return slog.LevelDebug, nil
	case "INFO":
		return slog.LevelInfo, nil
	case "WARN", "WARNING":
		return slog.LevelWarn, nil
	case "ERROR":
		return slog.LevelError, nil
	default:
		return 0, fmt.Errorf("invalid LOG_LEVEL %q", raw)
	}
}
