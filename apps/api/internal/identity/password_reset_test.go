package identity

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

type resetTestStore struct {
	user         User
	resetHash    []byte
	consumed     bool
	passwordHash string
}

func (s *resetTestStore) CreateUser(context.Context, Account) (User, error) { return User{}, nil }
func (s *resetTestStore) FindUserByEmail(_ context.Context, email string) (User, error) {
	if s.user.Email != email {
		return User{}, ErrInvalidCredentials
	}
	return s.user, nil
}
func (s *resetTestStore) CreateSession(context.Context, string, SessionSecrets) error { return nil }
func (s *resetTestStore) FindSession(context.Context, []byte) (StoredSession, error) {
	return StoredSession{}, nil
}
func (s *resetTestStore) DeleteSession(context.Context, []byte) error { return nil }
func (s *resetTestStore) CreatePasswordReset(_ context.Context, _ string, hash []byte, _ time.Time) error {
	s.resetHash = append([]byte(nil), hash...)
	return nil
}
func (s *resetTestStore) ConsumePasswordReset(_ context.Context, _ string, hash []byte, passwordHash string) (bool, error) {
	s.consumed = string(hash) == string(s.resetHash)
	s.passwordHash = passwordHash
	return s.consumed, nil
}

type resetTestMailer struct {
	recipient, link string
	err             error
}

func (m *resetTestMailer) SendPasswordReset(_ context.Context, recipient, link string) error {
	m.recipient, m.link = recipient, link
	return m.err
}

func TestPasswordResetUsesOneTimeHashedToken(t *testing.T) {
	store := &resetTestStore{user: User{ID: "4d5cb7b8-feb0-4695-863f-b305093625a1", Email: "user@example.com"}}
	mailer := &resetTestMailer{}
	service := NewServiceWithPasswordReset(store, time.Hour, mailer, "https://proslides.ir", 15*time.Minute)
	service.now = func() time.Time { return time.Date(2026, 8, 19, 0, 0, 0, 0, time.UTC) }
	if err := service.RequestPasswordReset(context.Background(), " User@example.com "); err != nil {
		t.Fatal(err)
	}
	if mailer.recipient != "user@example.com" || !strings.Contains(mailer.link, "/reset-password?uid=") || len(store.resetHash) != 32 {
		t.Fatalf("recipient=%q link=%q hash=%d", mailer.recipient, mailer.link, len(store.resetHash))
	}
	token := strings.Split(strings.Split(mailer.link, "token=")[1], "&")[0]
	if strings.Contains(string(store.resetHash), token) {
		t.Fatal("plaintext token was stored")
	}
	if err := service.ConfirmPasswordReset(context.Background(), store.user.ID, token, "replacement-password"); err != nil {
		t.Fatal(err)
	}
	if !store.consumed || !VerifyPassword("replacement-password", store.passwordHash) {
		t.Fatal("reset was not consumed securely")
	}
}

func TestPasswordResetDoesNotDiscloseUnknownEmailOrUnavailableDelivery(t *testing.T) {
	store := &resetTestStore{}
	mailer := &resetTestMailer{}
	service := NewServiceWithPasswordReset(store, time.Hour, mailer, "https://proslides.ir", time.Minute)
	if err := service.RequestPasswordReset(context.Background(), "missing@example.com"); err != nil {
		t.Fatalf("unknown email disclosed: %v", err)
	}
	if mailer.recipient != "" {
		t.Fatal("mailer called for unknown account")
	}
	if err := NewService(store, time.Hour).RequestPasswordReset(context.Background(), "missing@example.com"); !errors.Is(err, ErrPasswordResetUnavailable) {
		t.Fatalf("error=%v", err)
	}
}
