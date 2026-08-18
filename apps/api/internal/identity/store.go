package identity

import (
	"context"
	"errors"
	"time"
)

var (
	ErrEmailTaken         = errors.New("email already registered")
	ErrInvalidCredentials = errors.New("invalid credentials")
)

type User struct{ ID, Email, DisplayName, PasswordHash string }
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
}
