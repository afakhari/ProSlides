package identity

import (
	"bytes"
	"testing"
	"time"
)

func TestNewSessionSecretsKeepsOnlyVerifiableHashes(t *testing.T) {
	now := time.Date(2026, 8, 18, 0, 0, 0, 0, time.UTC)
	secrets, err := NewSessionSecrets(now, 24*time.Hour)
	if err != nil {
		t.Fatalf("NewSessionSecrets() error = %v", err)
	}
	if secrets.Token == "" || secrets.CSRFToken == "" || secrets.Token == secrets.CSRFToken {
		t.Fatal("tokens are not independent")
	}
	if bytes.Equal(secrets.TokenHash, []byte(secrets.Token)) || !VerifyCSRF(secrets.CSRFToken, secrets.CSRFTokenHash) || VerifyCSRF("wrong", secrets.CSRFTokenHash) {
		t.Fatal("session secrets are not safely verifiable")
	}
	if !secrets.ExpiresAt.Equal(now.Add(24 * time.Hour)) {
		t.Fatalf("expires at = %v", secrets.ExpiresAt)
	}
}
