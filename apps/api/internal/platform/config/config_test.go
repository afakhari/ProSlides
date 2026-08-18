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

func TestLoadRequiresSMTPForMandatoryVerification(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/proslides")
	t.Setenv("REDIS_URL", "redis://localhost:6379/0")
	t.Setenv("AUTH_REQUIRE_EMAIL_VERIFICATION", "true")
	t.Setenv("SMTP_HOST", "")
	t.Setenv("SMTP_FROM_ADDRESS", "")
	if _, err := Load(); err == nil {
		t.Fatal("mandatory verification accepted without SMTP")
	}
}

func TestLoadRequiresPepperForMandatoryVerification(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/proslides")
	t.Setenv("REDIS_URL", "redis://localhost:6379/0")
	t.Setenv("AUTH_REQUIRE_EMAIL_VERIFICATION", "true")
	t.Setenv("SMTP_HOST", "smtp.example.test")
	t.Setenv("SMTP_FROM_ADDRESS", "no-reply@example.test")
	t.Setenv("EMAIL_VERIFICATION_PEPPER", "short")
	if _, err := Load(); err == nil {
		t.Fatal("mandatory verification accepted a weak pepper")
	}
}

func TestLoadRejectsConflictingSMTPEncryption(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/proslides")
	t.Setenv("REDIS_URL", "redis://localhost:6379/0")
	t.Setenv("SMTP_USE_TLS", "true")
	t.Setenv("SMTP_USE_SSL", "true")
	if _, err := Load(); err == nil {
		t.Fatal("conflicting SMTP encryption accepted")
	}
}
