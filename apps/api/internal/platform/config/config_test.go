package config

import "testing"

func TestLoadRequiresBothRuntimeDependencies(t *testing.T) {
	t.Setenv("APP_ENV", "test")
	t.Setenv("DATABASE_URL", "")
	t.Setenv("REDIS_URL", "redis://localhost:6379/0")

	if _, err := Load(); err == nil {
		t.Fatal("Load() error = nil, want missing DATABASE_URL error")
	}
}

func TestLoadRejectsInvalidDependencyCheckTimeout(t *testing.T) {
	t.Setenv("APP_ENV", "test")
	t.Setenv("DATABASE_URL", "postgres://localhost/proslides")
	t.Setenv("REDIS_URL", "redis://localhost:6379/0")
	t.Setenv("DEPENDENCY_CHECK_TIMEOUT", "not-a-duration")

	if _, err := Load(); err == nil {
		t.Fatal("Load() error = nil, want invalid timeout error")
	}
}
