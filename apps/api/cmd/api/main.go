package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/proslides/proslides/internal/identity"
	"github.com/proslides/proslides/internal/platform/config"
	"github.com/proslides/proslides/internal/platform/dependency"
	platformhttp "github.com/proslides/proslides/internal/platform/http"
	"github.com/proslides/proslides/internal/platform/migrate"
	"github.com/proslides/proslides/internal/platform/postgres"
	"github.com/proslides/proslides/internal/platform/redis"
	"github.com/proslides/proslides/internal/presentations"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("invalid configuration", "error", err)
		os.Exit(1)
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: cfg.LogLevel,
	}))
	startupCtx, cancelStartup := context.WithTimeout(context.Background(), cfg.DependencyCheckTimeout)
	defer cancelStartup()

	postgresClient, err := postgres.New(startupCtx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("postgres initialization failed", "error", err)
		os.Exit(1)
	}
	defer postgresClient.Close()
	if err := migrate.Apply(startupCtx, postgresClient.Pool()); err != nil {
		logger.Error("migration failed", "error", err)
		os.Exit(1)
	}

	redisClient, err := redis.New(cfg.RedisURL)
	if err != nil {
		logger.Error("redis initialization failed", "error", err)
		os.Exit(1)
	}
	defer func() {
		if err := redisClient.Close(); err != nil {
			logger.Warn("redis close failed", "error", err)
		}
	}()

	server := &http.Server{
		Addr: cfg.HTTPAddr,
		Handler: platformhttp.NewRouterWithRoutes(cfg, []dependency.Dependency{postgresClient, redisClient}, func(m *http.ServeMux) {
			identityService := identity.NewService(identity.NewPostgresStore(postgresClient.Pool()), cfg.SessionTTL)
			identity.NewHTTP(identityService, cfg.Environment == "production").Register(m)
			presentations.NewHTTP(identityService, presentations.NewPostgresStore(postgresClient.Pool())).Register(m)
		}),
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       75 * time.Second,
	}

	serverErrors := make(chan error, 1)
	go func() {
		logger.Info("api server started", "address", cfg.HTTPAddr, "environment", cfg.Environment)
		serverErrors <- server.ListenAndServe()
	}()

	shutdownSignal := make(chan os.Signal, 1)
	signal.Notify(shutdownSignal, syscall.SIGINT, syscall.SIGTERM)

	select {
	case signal := <-shutdownSignal:
		logger.Info("shutdown signal received", "signal", signal.String())
	case err := <-serverErrors:
		if !errors.Is(err, http.ErrServerClosed) {
			logger.Error("api server failed", "error", err)
			os.Exit(1)
		}
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown failed", "error", err)
		os.Exit(1)
	}
	logger.Info("api server stopped")
}
