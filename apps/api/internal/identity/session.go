package identity

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"time"
)

type SessionSecrets struct {
	Token         string
	TokenHash     []byte
	CSRFToken     string
	CSRFTokenHash []byte
	ExpiresAt     time.Time
}

func NewSessionSecrets(now time.Time, ttl time.Duration) (SessionSecrets, error) {
	token, err := randomToken()
	if err != nil {
		return SessionSecrets{}, err
	}
	csrf, err := randomToken()
	if err != nil {
		return SessionSecrets{}, err
	}
	return SessionSecrets{Token: token, TokenHash: hashToken(token), CSRFToken: csrf, CSRFTokenHash: hashToken(csrf), ExpiresAt: now.Add(ttl)}, nil
}

func hashToken(value string) []byte { sum := sha256.Sum256([]byte(value)); return sum[:] }

func VerifyCSRF(token string, expectedHash []byte) bool {
	actual := hashToken(token)
	if len(actual) != len(expectedHash) {
		return false
	}
	var difference byte
	for i := range actual {
		difference |= actual[i] ^ expectedHash[i]
	}
	return difference == 0
}

func randomToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}
