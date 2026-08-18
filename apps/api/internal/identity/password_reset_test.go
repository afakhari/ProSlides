package identity

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

type resetTestStore struct {
	user               User
	resetHash          []byte
	verificationHash   []byte
	verificationResult VerifyEmailResult
	verificationIssue  VerificationIssue
	createdAccount     Account
	sessionCount       int
	consumed           bool
	passwordHash       string
}

func (s *resetTestStore) CreateEmailVerification(_ context.Context, _ string, hash []byte, _ time.Time) error {
	s.verificationHash = append([]byte(nil), hash...)
	return nil
}
func (s *resetTestStore) VerifyEmail(context.Context, string, []byte, int) (VerifyEmailResult, error) {
	if s.verificationResult == VerifyEmailAccepted {
		s.user.IsActive = true
	}
	return s.verificationResult, nil
}
func (s *resetTestStore) ReplaceEmailVerification(context.Context, string, []byte, time.Time, time.Time) (VerificationIssue, error) {
	return s.verificationIssue, nil
}
func (s *resetTestStore) UpsertGoogleUser(context.Context, string, string) (User, bool, error) {
	return User{}, false, nil
}

func (s *resetTestStore) CreateUser(_ context.Context, account Account) (User, error) {
	s.createdAccount = account
	s.user = User{ID: "user-id", Email: account.Email, DisplayName: account.DisplayName, PasswordHash: account.PasswordHash, IsActive: account.IsActive}
	return s.user, nil
}
func (s *resetTestStore) FindUserByEmail(_ context.Context, email string) (User, error) {
	if s.user.Email != email {
		return User{}, ErrInvalidCredentials
	}
	return s.user, nil
}
func (s *resetTestStore) CreateSession(context.Context, string, SessionSecrets) error {
	s.sessionCount++
	return nil
}
func (s *resetTestStore) FindSession(context.Context, []byte) (StoredSession, error) {
	return StoredSession{}, nil
}

type verificationTestMailer struct{ code string }

func (m *verificationTestMailer) SendVerification(_ context.Context, _ string, code string, _ time.Duration) error {
	m.code = code
	return nil
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
	store := &resetTestStore{user: User{ID: "4d5cb7b8-feb0-4695-863f-b305093625a1", Email: "user@example.com", IsActive: true}}
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

func TestRegistrationStoresOnlyHashedVerificationCodeAndStartsNoSession(t *testing.T) {
	store := &resetTestStore{}
	mailer := &verificationTestMailer{}
	service := NewServiceWithOptions(store, time.Hour, ServiceOptions{RequireVerification: true, VerificationMailer: mailer, VerificationTTL: 10 * time.Minute, VerificationResendDelay: time.Minute, VerificationMaxAttempts: 5})
	result, err := service.Register(context.Background(), Registration{Email: "user@example.com", DisplayName: "User", Password: "long-enough-password"})
	if err != nil {
		t.Fatal(err)
	}
	if store.createdAccount.IsActive || result.User.IsActive || result.SessionEstablished || store.sessionCount != 0 {
		t.Fatalf("inactive registration opened a session: %#v", result)
	}
	if len(mailer.code) != 6 || len(store.verificationHash) != 32 || strings.Contains(string(store.verificationHash), mailer.code) {
		t.Fatal("verification code was not handled as a hashed secret")
	}
}

func TestVerificationCannotLogInAnAlreadyActiveAccount(t *testing.T) {
	store := &resetTestStore{user: User{ID: "user-id", Email: "user@example.com", IsActive: true}, verificationResult: VerifyEmailAlreadyDone}
	service := NewServiceWithOptions(store, time.Hour, ServiceOptions{VerificationMaxAttempts: 5})
	if _, err := service.VerifyEmail(context.Background(), "user@example.com", "123456"); !errors.Is(err, ErrInvalidVerification) {
		t.Fatalf("error=%v", err)
	}
	if store.sessionCount != 0 {
		t.Fatal("active account received a session through verification")
	}
}

func TestSuccessfulVerificationActivatesAndStartsSession(t *testing.T) {
	store := &resetTestStore{user: User{ID: "user-id", Email: "user@example.com"}, verificationResult: VerifyEmailAccepted}
	service := NewServiceWithOptions(store, time.Hour, ServiceOptions{VerificationMaxAttempts: 5, VerificationPepper: "test-pepper"})
	result, err := service.VerifyEmail(context.Background(), "user@example.com", "123456")
	if err != nil {
		t.Fatal(err)
	}
	if !result.User.IsActive || !result.SessionEstablished || store.sessionCount != 1 {
		t.Fatalf("result=%#v sessions=%d", result, store.sessionCount)
	}
}

func TestResendDoesNotDiscloseUnknownAccount(t *testing.T) {
	store := &resetTestStore{verificationIssue: VerificationIssue{Unknown: true}}
	mailer := &verificationTestMailer{}
	service := NewServiceWithOptions(store, time.Hour, ServiceOptions{VerificationMailer: mailer, VerificationTTL: 10 * time.Minute, VerificationResendDelay: time.Minute, VerificationPepper: "test-pepper"})
	issue, err := service.ResendVerification(context.Background(), "missing@example.com")
	if err != nil || !issue.Issued {
		t.Fatalf("issue=%#v err=%v", issue, err)
	}
	if mailer.code != "" {
		t.Fatal("mailer called for unknown account")
	}
}
