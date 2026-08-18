package identity

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"math/big"
	"net/mail"
	"net/url"
	"strings"
	"time"
)

var (
	ErrPasswordResetUnavailable = errors.New("password reset unavailable")
	ErrInvalidPasswordReset     = errors.New("invalid password reset")
	ErrVerificationUnavailable  = errors.New("email verification unavailable")
	ErrInvalidVerification      = errors.New("invalid email verification")
	ErrVerificationExpired      = errors.New("email verification expired")
	ErrVerificationAttempts     = errors.New("email verification attempts exceeded")
	ErrGoogleUnavailable        = errors.New("google authentication unavailable")
	ErrInvalidGoogleCredential  = errors.New("invalid google credential")
	ErrEmailNotVerified         = errors.New("email not verified")
)

type PasswordResetMailer interface {
	SendPasswordReset(context.Context, string, string) error
}
type VerificationMailer interface {
	SendVerification(context.Context, string, string, time.Duration) error
}
type GoogleIdentity struct{ Email, DisplayName string }
type GoogleVerifier interface {
	Verify(context.Context, string) (GoogleIdentity, error)
}
type ServiceOptions struct {
	PasswordResetMailer     PasswordResetMailer
	VerificationMailer      VerificationMailer
	GoogleVerifier          GoogleVerifier
	PasswordResetBaseURL    string
	PasswordResetTTL        time.Duration
	RequireVerification     bool
	VerificationTTL         time.Duration
	VerificationResendDelay time.Duration
	VerificationMaxAttempts int
	VerificationPepper      string
}

type Service struct {
	store   Store
	ttl     time.Duration
	now     func() time.Time
	options ServiceOptions
}

func NewServiceWithOptions(store Store, ttl time.Duration, options ServiceOptions) *Service {
	options.PasswordResetBaseURL = strings.TrimRight(options.PasswordResetBaseURL, "/")
	return &Service{store: store, ttl: ttl, now: time.Now, options: options}
}
func NewServiceWithPasswordReset(store Store, ttl time.Duration, mailer PasswordResetMailer, baseURL string, resetTTL time.Duration) *Service {
	return NewServiceWithOptions(store, ttl, ServiceOptions{PasswordResetMailer: mailer, PasswordResetBaseURL: baseURL, PasswordResetTTL: resetTTL})
}

func NewService(store Store, ttl time.Duration) *Service {
	return NewServiceWithOptions(store, ttl, ServiceOptions{})
}

type Authenticated struct {
	User                  User
	Secrets               SessionSecrets
	SessionEstablished    bool
	VerificationSent      bool
	VerificationExpiresIn int
	IsNewUser             bool
}

func (s *Service) Register(ctx context.Context, input Registration) (Authenticated, error) {
	account, err := PrepareRegistration(input)
	if err != nil {
		return Authenticated{}, err
	}
	if s.options.RequireVerification {
		if s.options.VerificationMailer == nil || s.options.VerificationTTL <= 0 {
			return Authenticated{}, ErrVerificationUnavailable
		}
		account.IsActive = false
	}
	user, err := s.store.CreateUser(ctx, account)
	if err != nil {
		return Authenticated{}, err
	}
	if !s.options.RequireVerification {
		out, sessionErr := s.startSession(ctx, user)
		out.IsNewUser = true
		return out, sessionErr
	}
	code, err := verificationCode()
	if err != nil {
		return Authenticated{}, err
	}
	if err = s.store.CreateEmailVerification(ctx, user.ID, s.hashVerificationCode(code), s.now().Add(s.options.VerificationTTL)); err != nil {
		return Authenticated{}, err
	}
	if err = s.options.VerificationMailer.SendVerification(ctx, user.Email, code, s.options.VerificationTTL); err != nil {
		return Authenticated{}, ErrVerificationUnavailable
	}
	return Authenticated{User: user, VerificationSent: true, VerificationExpiresIn: int(s.options.VerificationTTL.Seconds()), IsNewUser: true}, nil
}
func (s *Service) Login(ctx context.Context, email, password string) (Authenticated, error) {
	user, err := s.store.FindUserByEmail(ctx, normalizeEmail(email))
	if err != nil || !VerifyPassword(password, user.PasswordHash) {
		return Authenticated{}, ErrInvalidCredentials
	}
	if !user.IsActive {
		return Authenticated{}, ErrEmailNotVerified
	}
	return s.startSession(ctx, user)
}

func (s *Service) GoogleAuthenticate(ctx context.Context, credential string) (Authenticated, error) {
	if s.options.GoogleVerifier == nil {
		return Authenticated{}, ErrGoogleUnavailable
	}
	claim, err := s.options.GoogleVerifier.Verify(ctx, credential)
	if err != nil {
		return Authenticated{}, ErrInvalidGoogleCredential
	}
	user, created, err := s.store.UpsertGoogleUser(ctx, normalizeEmail(claim.Email), strings.TrimSpace(claim.DisplayName))
	if err != nil {
		return Authenticated{}, err
	}
	out, err := s.startSession(ctx, user)
	out.IsNewUser = created
	return out, err
}

func (s *Service) VerifyEmail(ctx context.Context, email, code string) (Authenticated, error) {
	if len(code) != 6 || s.options.VerificationMaxAttempts <= 0 {
		return Authenticated{}, ErrInvalidVerification
	}
	for _, r := range code {
		if r < '0' || r > '9' {
			return Authenticated{}, ErrInvalidVerification
		}
	}
	result, err := s.store.VerifyEmail(ctx, normalizeEmail(email), s.hashVerificationCode(code), s.options.VerificationMaxAttempts)
	if err != nil {
		return Authenticated{}, err
	}
	switch result {
	case VerifyEmailAccepted:
		user, findErr := s.store.FindUserByEmail(ctx, normalizeEmail(email))
		if findErr != nil || !user.IsActive {
			return Authenticated{}, ErrInvalidVerification
		}
		return s.startSession(ctx, user)
	case VerifyEmailAlreadyDone:
		return Authenticated{}, ErrInvalidVerification
	case VerifyEmailExpired:
		return Authenticated{}, ErrVerificationExpired
	case VerifyEmailTooMany:
		return Authenticated{}, ErrVerificationAttempts
	default:
		return Authenticated{}, ErrInvalidVerification
	}
}

func (s *Service) ResendVerification(ctx context.Context, email string) (VerificationIssue, error) {
	if s.options.VerificationMailer == nil || s.options.VerificationTTL <= 0 {
		return VerificationIssue{}, ErrVerificationUnavailable
	}
	code, err := verificationCode()
	if err != nil {
		return VerificationIssue{}, err
	}
	now := s.now()
	issue, err := s.store.ReplaceEmailVerification(ctx, normalizeEmail(email), s.hashVerificationCode(code), now.Add(s.options.VerificationTTL), now.Add(-s.options.VerificationResendDelay))
	if err != nil {
		return VerificationIssue{}, err
	}
	if issue.Unknown {
		return VerificationIssue{Issued: true}, nil
	}
	if issue.User.IsActive {
		return issue, nil
	}
	if !issue.Issued {
		return issue, nil
	}
	if err = s.options.VerificationMailer.SendVerification(ctx, issue.User.Email, code, s.options.VerificationTTL); err != nil {
		return VerificationIssue{}, ErrVerificationUnavailable
	}
	return issue, nil
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
	if s.options.PasswordResetMailer == nil || s.options.PasswordResetBaseURL == "" || s.options.PasswordResetTTL <= 0 {
		return ErrPasswordResetUnavailable
	}
	email = normalizeEmail(email)
	if len(email) > 320 {
		return ErrInvalidPasswordReset
	}
	if parsed, err := mail.ParseAddress(email); err != nil || parsed.Address != email {
		return ErrInvalidPasswordReset
	}
	user, err := s.store.FindUserByEmail(ctx, email)
	if errors.Is(err, ErrInvalidCredentials) {
		return nil
	}
	if err != nil {
		return err
	}
	if !user.IsActive {
		return nil
	}
	token, err := randomToken()
	if err != nil {
		return err
	}
	if err = s.store.CreatePasswordReset(ctx, user.ID, hashToken(token), s.now().Add(s.options.PasswordResetTTL)); err != nil {
		return err
	}
	link := s.options.PasswordResetBaseURL + "/reset-password?uid=" + url.QueryEscape(user.ID) + "&token=" + url.QueryEscape(token)
	if err = s.options.PasswordResetMailer.SendPasswordReset(ctx, user.Email, link); err != nil {
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
	return Authenticated{User: user, Secrets: secrets, SessionEstablished: true}, nil
}

func normalizeEmail(value string) string { return strings.ToLower(strings.TrimSpace(value)) }

func (s *Service) hashVerificationCode(code string) []byte {
	mac := hmac.New(sha256.New, []byte(s.options.VerificationPepper))
	_, _ = mac.Write([]byte(code))
	return mac.Sum(nil)
}

func verificationCode() (string, error) {
	const digits = "0123456789"
	code := make([]byte, 6)
	for i := range code {
		n, err := rand.Int(rand.Reader, big.NewInt(10))
		if err != nil {
			return "", err
		}
		code[i] = digits[n.Int64()]
	}
	return string(code), nil
}
