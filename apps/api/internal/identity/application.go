package identity

import (
	"context"
	"strings"
	"time"
)

type Service struct {
	store Store
	ttl   time.Duration
	now   func() time.Time
}

func NewService(store Store, ttl time.Duration) *Service {
	return &Service{store: store, ttl: ttl, now: time.Now}
}

type Authenticated struct {
	User    User
	Secrets SessionSecrets
}

func (s *Service) Register(ctx context.Context, input Registration) (Authenticated, error) {
	account, err := PrepareRegistration(input)
	if err != nil {
		return Authenticated{}, err
	}
	user, err := s.store.CreateUser(ctx, account)
	if err != nil {
		return Authenticated{}, err
	}
	return s.startSession(ctx, user)
}
func (s *Service) Login(ctx context.Context, email, password string) (Authenticated, error) {
	user, err := s.store.FindUserByEmail(ctx, strings.ToLower(strings.TrimSpace(email)))
	if err != nil || !VerifyPassword(password, user.PasswordHash) {
		return Authenticated{}, ErrInvalidCredentials
	}
	return s.startSession(ctx, user)
}
func (s *Service) Current(ctx context.Context, token string) (StoredSession, error) {
	return s.store.FindSession(ctx, hashToken(token))
}
func (s *Service) Authorize(ctx context.Context, token, csrf string) (User, error) {
	session, err := s.Current(ctx, token)
	if err != nil || !VerifyCSRF(csrf, session.CSRFTokenHash) {
		return User{}, ErrInvalidCredentials
	}
	return session.User, nil
}
func (s *Service) Logout(ctx context.Context, token, csrf string) error {
	session, err := s.Current(ctx, token)
	if err != nil {
		return err
	}
	if !VerifyCSRF(csrf, session.CSRFTokenHash) {
		return ErrInvalidCredentials
	}
	return s.store.DeleteSession(ctx, hashToken(token))
}
func (s *Service) startSession(ctx context.Context, user User) (Authenticated, error) {
	secrets, err := NewSessionSecrets(s.now(), s.ttl)
	if err != nil {
		return Authenticated{}, err
	}
	if err = s.store.CreateSession(ctx, user.ID, secrets); err != nil {
		return Authenticated{}, err
	}
	return Authenticated{User: user, Secrets: secrets}, nil
}
