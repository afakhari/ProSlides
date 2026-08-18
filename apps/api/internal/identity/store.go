package identity

import (
	"context"
	"errors"
	"time"
)

var (
	ErrEmailTaken         = errors.New("email already registered")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrAlreadyVerified    = errors.New("email already verified")
)

type User struct {
	ID, Email, DisplayName, PasswordHash string
	IsActive                             bool
}
type StoredSession struct {
	User          User
	CSRFTokenHash []byte
	ExpiresAt     time.Time
}

// Store isolates the application layer from PostgreSQL and enables behavior tests.
type Store interface {
	CreateUser(context.Context, Account) (User, error)
	FindUserByEmail(context.Context, string) (User, error)
	CreateSession(context.Context, string, SessionSecrets) error
	FindSession(context.Context, []byte) (StoredSession, error)
	DeleteSession(context.Context, []byte) error
	CreatePasswordReset(context.Context, string, []byte, time.Time) error
	ConsumePasswordReset(context.Context, string, []byte, string) (bool, error)
	CreateEmailVerification(context.Context, string, []byte, time.Time) error
	VerifyEmail(context.Context, string, []byte, int) (VerifyEmailResult, error)
	ReplaceEmailVerification(context.Context, string, []byte, time.Time, time.Time) (VerificationIssue, error)
	UpsertGoogleUser(context.Context, string, string) (User, bool, error)
}

type VerifyEmailResult string

const (
	VerifyEmailAccepted    VerifyEmailResult = "accepted"
	VerifyEmailInvalid     VerifyEmailResult = "invalid"
	VerifyEmailExpired     VerifyEmailResult = "expired"
	VerifyEmailTooMany     VerifyEmailResult = "too_many_attempts"
	VerifyEmailAlreadyDone VerifyEmailResult = "already_verified"
)

type VerificationIssue struct {
	User       User
	Issued     bool
	Unknown    bool
	RetryAfter time.Duration
}
