package identity

import (
	"context"
	"errors"
	"net/mail"
	"net/url"
	"strings"
	"time"
)

var (
	ErrPasswordResetUnavailable = errors.New("password reset unavailable")
	ErrInvalidPasswordReset     = errors.New("invalid password reset")
)

type PasswordResetMailer interface {
	SendPasswordReset(context.Context, string, string) error
}

type Service struct {
	store        Store
	ttl          time.Duration
	now          func() time.Time
	resetMailer  PasswordResetMailer
	resetBaseURL string
	resetTTL     time.Duration
}

func NewServiceWithPasswordReset(store Store, ttl time.Duration, mailer PasswordResetMailer, baseURL string, resetTTL time.Duration) *Service {
	return &Service{store: store, ttl: ttl, now: time.Now, resetMailer: mailer, resetBaseURL: strings.TrimRight(baseURL, "/"), resetTTL: resetTTL}
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

func (s *Service) RequestPasswordReset(ctx context.Context, email string) error {
	if s.resetMailer == nil || s.resetBaseURL == "" || s.resetTTL <= 0 {
		return ErrPasswordResetUnavailable
	}
	email = strings.ToLower(strings.TrimSpace(email))
	if len(email) > 320 {
		return ErrInvalidPasswordReset
	}
	if _, err := mail.ParseAddress(email); err != nil {
		return ErrInvalidPasswordReset
	}
	user, err := s.store.FindUserByEmail(ctx, email)
	if errors.Is(err, ErrInvalidCredentials) {
		return nil
	}
	if err != nil {
		return err
	}
	token, err := randomToken()
	if err != nil {
		return err
	}
	if err = s.store.CreatePasswordReset(ctx, user.ID, hashToken(token), s.now().Add(s.resetTTL)); err != nil {
		return err
	}
	link := s.resetBaseURL + "/reset-password?uid=" + url.QueryEscape(user.ID) + "&token=" + url.QueryEscape(token)
	if err = s.resetMailer.SendPasswordReset(ctx, user.Email, link); err != nil {
		return ErrPasswordResetUnavailable
	}
	return nil
}

func (s *Service) ConfirmPasswordReset(ctx context.Context, userID, token, password string) error {
	if strings.TrimSpace(userID) == "" || len(token) < 32 || len(token) > 128 {
		return ErrInvalidPasswordReset
	}
	hash, err := HashPassword(password)
	if err != nil {
		return ErrInvalidPasswordReset
	}
	ok, err := s.store.ConsumePasswordReset(ctx, userID, hashToken(token), hash)
	if err != nil {
		return err
	}
	if !ok {
		return ErrInvalidPasswordReset
	}
	return nil
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
