package identity

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"
)

type GoogleTokenVerifier struct {
	client            *http.Client
	clientID, jwksURL string
	mu                sync.RWMutex
	keys              map[string]*rsa.PublicKey
	expires           time.Time
}

func NewGoogleTokenVerifier(clientID, jwksURL string, client *http.Client) *GoogleTokenVerifier {
	if client == nil {
		client = &http.Client{Timeout: 5 * time.Second}
	}
	return &GoogleTokenVerifier{client: client, clientID: strings.TrimSpace(clientID), jwksURL: jwksURL}
}

func (v *GoogleTokenVerifier) Verify(ctx context.Context, token string) (GoogleIdentity, error) {
	if v.clientID == "" || v.jwksURL == "" {
		return GoogleIdentity{}, ErrGoogleUnavailable
	}
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return GoogleIdentity{}, ErrInvalidGoogleCredential
	}
	var header struct {
		Algorithm string `json:"alg"`
		KeyID     string `json:"kid"`
	}
	if decodeJWTPart(parts[0], &header) != nil || header.Algorithm != "RS256" || header.KeyID == "" {
		return GoogleIdentity{}, ErrInvalidGoogleCredential
	}
	key, err := v.key(ctx, header.KeyID)
	if err != nil {
		return GoogleIdentity{}, ErrInvalidGoogleCredential
	}
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return GoogleIdentity{}, ErrInvalidGoogleCredential
	}
	digest := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if rsa.VerifyPKCS1v15(key, crypto.SHA256, digest[:], signature) != nil {
		return GoogleIdentity{}, ErrInvalidGoogleCredential
	}
	var claims struct {
		Issuer        string `json:"iss"`
		Audience      any    `json:"aud"`
		Email         string `json:"email"`
		EmailVerified bool   `json:"email_verified"`
		Name          string `json:"name"`
		ExpiresAt     int64  `json:"exp"`
		IssuedAt      int64  `json:"iat"`
	}
	if decodeJWTPart(parts[1], &claims) != nil {
		return GoogleIdentity{}, ErrInvalidGoogleCredential
	}
	now := time.Now().Unix()
	if (claims.Issuer != "accounts.google.com" && claims.Issuer != "https://accounts.google.com") || !audienceContains(claims.Audience, v.clientID) || !claims.EmailVerified || normalizeEmail(claims.Email) == "" || claims.ExpiresAt <= now || claims.IssuedAt > now+60 {
		return GoogleIdentity{}, ErrInvalidGoogleCredential
	}
	return GoogleIdentity{Email: normalizeEmail(claims.Email), DisplayName: strings.TrimSpace(claims.Name)}, nil
}

func decodeJWTPart(value string, target any) error {
	raw, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return err
	}
	return json.Unmarshal(raw, target)
}

func audienceContains(value any, expected string) bool {
	switch audience := value.(type) {
	case string:
		return audience == expected
	case []any:
		for _, item := range audience {
			if text, ok := item.(string); ok && text == expected {
				return true
			}
		}
	}
	return false
}

func (v *GoogleTokenVerifier) key(ctx context.Context, id string) (*rsa.PublicKey, error) {
	v.mu.RLock()
	key, found := v.keys[id]
	fresh := time.Now().Before(v.expires)
	v.mu.RUnlock()
	if found && fresh {
		return key, nil
	}
	if err := v.refresh(ctx); err != nil {
		return nil, err
	}
	v.mu.RLock()
	defer v.mu.RUnlock()
	key, found = v.keys[id]
	if !found {
		return nil, errors.New("unknown Google signing key")
	}
	return key, nil
}

func (v *GoogleTokenVerifier) refresh(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.jwksURL, nil)
	if err != nil {
		return err
	}
	response, err := v.client.Do(req)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return errors.New("Google key endpoint unavailable")
	}
	var document struct {
		Keys []struct {
			KeyID string `json:"kid"`
			Type  string `json:"kty"`
			Use   string `json:"use"`
			N     string `json:"n"`
			E     string `json:"e"`
		} `json:"keys"`
	}
	if json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&document) != nil {
		return errors.New("invalid Google key response")
	}
	keys := make(map[string]*rsa.PublicKey, len(document.Keys))
	for _, item := range document.Keys {
		if item.Type != "RSA" || item.Use != "sig" || item.KeyID == "" {
			continue
		}
		n, nErr := base64.RawURLEncoding.DecodeString(item.N)
		e, eErr := base64.RawURLEncoding.DecodeString(item.E)
		if nErr != nil || eErr != nil || len(e) == 0 || len(e) > 4 {
			continue
		}
		exponent := 0
		for _, b := range e {
			exponent = exponent<<8 + int(b)
		}
		if exponent < 3 {
			continue
		}
		keys[item.KeyID] = &rsa.PublicKey{N: new(big.Int).SetBytes(n), E: exponent}
	}
	if len(keys) == 0 {
		return errors.New("Google key set is empty")
	}
	cacheTTL := 5 * time.Minute
	if raw := response.Header.Get("Cache-Control"); strings.Contains(raw, "max-age=") {
		for _, directive := range strings.Split(raw, ",") {
			var seconds int
			if _, scanErr := fmt.Sscanf(strings.TrimSpace(directive), "max-age=%d", &seconds); scanErr == nil && seconds > 0 {
				cacheTTL = time.Duration(seconds) * time.Second
			}
		}
	}
	v.mu.Lock()
	v.keys = keys
	v.expires = time.Now().Add(cacheTTL)
	v.mu.Unlock()
	return nil
}
