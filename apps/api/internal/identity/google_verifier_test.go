package identity

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestGoogleVerifierValidatesSignatureAndClaims(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		exponent := big.NewInt(int64(key.PublicKey.E)).Bytes()
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": []any{map[string]any{"kid": "test-key", "kty": "RSA", "use": "sig", "n": base64.RawURLEncoding.EncodeToString(key.PublicKey.N.Bytes()), "e": base64.RawURLEncoding.EncodeToString(exponent)}}})
	}))
	defer server.Close()
	verifier := NewGoogleTokenVerifier("web-client", server.URL, server.Client())
	token := signedGoogleToken(t, key, map[string]any{"iss": "https://accounts.google.com", "aud": "web-client", "email": "User@Example.com", "email_verified": true, "name": "Test User", "iat": time.Now().Add(-time.Minute).Unix(), "exp": time.Now().Add(time.Hour).Unix()})
	identity, err := verifier.Verify(context.Background(), token)
	if err != nil || identity.Email != "user@example.com" || identity.DisplayName != "Test User" {
		t.Fatalf("identity=%#v err=%v", identity, err)
	}
	parts := []byte(token)
	parts[len(parts)-1] ^= 1
	if _, err = verifier.Verify(context.Background(), string(parts)); err == nil {
		t.Fatal("forged signature accepted")
	}
	wrongAudience := signedGoogleToken(t, key, map[string]any{"iss": "accounts.google.com", "aud": "other-client", "email": "user@example.com", "email_verified": true, "iat": time.Now().Unix(), "exp": time.Now().Add(time.Hour).Unix()})
	if _, err = verifier.Verify(context.Background(), wrongAudience); err == nil {
		t.Fatal("wrong audience accepted")
	}
}

func signedGoogleToken(t *testing.T, key *rsa.PrivateKey, claims map[string]any) string {
	t.Helper()
	header, _ := json.Marshal(map[string]string{"alg": "RS256", "kid": "test-key"})
	payload, _ := json.Marshal(claims)
	unsigned := base64.RawURLEncoding.EncodeToString(header) + "." + base64.RawURLEncoding.EncodeToString(payload)
	digest := sha256.Sum256([]byte(unsigned))
	signature, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, digest[:])
	if err != nil {
		t.Fatal(err)
	}
	return unsigned + "." + base64.RawURLEncoding.EncodeToString(signature)
}
