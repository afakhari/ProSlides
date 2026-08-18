package config

import (
	"fmt"
	"log/slog"
	"os"
	"strings"
)

// Config contains only process-wide configuration. Domain configuration belongs
// to its owning module, not to this package.
type Config struct {
	Environment string
	HTTPAddr    string
	LogLevel    slog.Level
	DatabaseURL string
	RedisURL    string
}

func Load() (Config, error) {
	cfg := Config{
		Environment: valueOrDefault("APP_ENV", "development"),
		HTTPAddr:    valueOrDefault("HTTP_ADDR", ":8080"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		RedisURL:    os.Getenv("REDIS_URL"),
	}

	level, err := parseLogLevel(valueOrDefault("LOG_LEVEL", "INFO"))
	if err != nil {
		return Config{}, err
	}
	cfg.LogLevel = level

	if cfg.Environment == "production" && (cfg.DatabaseURL == "" || cfg.RedisURL == "") {
		return Config{}, fmt.Errorf("DATABASE_URL and REDIS_URL are required in production")
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
