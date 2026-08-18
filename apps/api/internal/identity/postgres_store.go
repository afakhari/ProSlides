package identity

import (
	"context"
	"crypto/subtle"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresStore struct{ pool *pgxpool.Pool }

func NewPostgresStore(pool *pgxpool.Pool) *PostgresStore { return &PostgresStore{pool: pool} }

func (s *PostgresStore) CreateUser(ctx context.Context, a Account) (User, error) {
	var u User
	err := s.pool.QueryRow(ctx, `INSERT INTO users (email, display_name, password_hash, is_active) VALUES ($1,$2,$3,$4) RETURNING id::text,email,display_name,password_hash,is_active`, a.Email, a.DisplayName, a.PasswordHash, a.IsActive).Scan(&u.ID, &u.Email, &u.DisplayName, &u.PasswordHash, &u.IsActive)
	if err != nil {
		var e *pgconn.PgError
		if errors.As(err, &e) && e.Code == "23505" {
			return User{}, ErrEmailTaken
		}
		return User{}, fmt.Errorf("create user: %w", err)
	}
	return u, nil
}
func (s *PostgresStore) FindUserByEmail(ctx context.Context, email string) (User, error) {
	var u User
	err := s.pool.QueryRow(ctx, `SELECT id::text,email,display_name,password_hash,is_active FROM users WHERE lower(email)=lower($1)`, email).Scan(&u.ID, &u.Email, &u.DisplayName, &u.PasswordHash, &u.IsActive)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrInvalidCredentials
	}
	if err != nil {
		return User{}, fmt.Errorf("find user: %w", err)
	}
	return u, nil
}
func (s *PostgresStore) CreateSession(ctx context.Context, userID string, secrets SessionSecrets) error {
	_, err := s.pool.Exec(ctx, `INSERT INTO user_sessions (user_id,token_hash,csrf_token_hash,expires_at) VALUES ($1,$2,$3,$4)`, userID, secrets.TokenHash, secrets.CSRFTokenHash, secrets.ExpiresAt)
	if err != nil {
		return fmt.Errorf("create session: %w", err)
	}
	return nil
}
func (s *PostgresStore) FindSession(ctx context.Context, hash []byte) (StoredSession, error) {
	var x StoredSession
	err := s.pool.QueryRow(ctx, `SELECT u.id::text,u.email,u.display_name,u.password_hash,u.is_active,s.csrf_token_hash,s.expires_at FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.is_active`, hash).Scan(&x.User.ID, &x.User.Email, &x.User.DisplayName, &x.User.PasswordHash, &x.User.IsActive, &x.CSRFTokenHash, &x.ExpiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return StoredSession{}, ErrInvalidCredentials
	}
	if err != nil {
		return StoredSession{}, fmt.Errorf("find session: %w", err)
	}
	return x, nil
}
func (s *PostgresStore) DeleteSession(ctx context.Context, hash []byte) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM user_sessions WHERE token_hash=$1`, hash)
	return err
}

func (s *PostgresStore) CreatePasswordReset(ctx context.Context, userID string, tokenHash []byte, expiresAt time.Time) error {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	if _, err = tx.Exec(ctx, `DELETE FROM password_reset_tokens WHERE user_id=$1 AND consumed_at IS NULL`, userID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES($1,$2,$3)`, userID, tokenHash, expiresAt); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *PostgresStore) ConsumePasswordReset(ctx context.Context, userID string, tokenHash []byte, passwordHash string) (bool, error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	var tokenID string
	err = tx.QueryRow(ctx, `UPDATE password_reset_tokens SET consumed_at=now() WHERE user_id=$1 AND token_hash=$2 AND consumed_at IS NULL AND expires_at>now() RETURNING id::text`, userID, tokenHash).Scan(&tokenID)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if _, err = tx.Exec(ctx, `UPDATE users SET password_hash=$2,updated_at=now() WHERE id=$1`, userID, passwordHash); err != nil {
		return false, err
	}
	if _, err = tx.Exec(ctx, `DELETE FROM user_sessions WHERE user_id=$1`, userID); err != nil {
		return false, err
	}
	if err = tx.Commit(ctx); err != nil {
		return false, err
	}
	return true, nil
}

func (s *PostgresStore) CreateEmailVerification(ctx context.Context, userID string, codeHash []byte, expiresAt time.Time) error {
	_, err := s.pool.Exec(ctx, `INSERT INTO email_verifications(user_id,code_hash,attempts,expires_at,sent_at,verified_at)
		VALUES($1,$2,0,$3,now(),NULL)
		ON CONFLICT(user_id) DO UPDATE SET code_hash=excluded.code_hash,attempts=0,expires_at=excluded.expires_at,sent_at=now(),verified_at=NULL`, userID, codeHash, expiresAt)
	return err
}

func (s *PostgresStore) VerifyEmail(ctx context.Context, email string, codeHash []byte, maxAttempts int) (VerifyEmailResult, error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return VerifyEmailInvalid, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	var userID string
	var active bool
	err = tx.QueryRow(ctx, `SELECT id::text,is_active FROM users WHERE lower(email)=lower($1) FOR UPDATE`, email).Scan(&userID, &active)
	if errors.Is(err, pgx.ErrNoRows) {
		return VerifyEmailInvalid, nil
	}
	if err != nil {
		return VerifyEmailInvalid, err
	}
	if active {
		return VerifyEmailAlreadyDone, nil
	}
	var expected []byte
	var attempts int
	var expiresAt time.Time
	err = tx.QueryRow(ctx, `SELECT code_hash,attempts,expires_at FROM email_verifications WHERE user_id=$1 AND verified_at IS NULL FOR UPDATE`, userID).Scan(&expected, &attempts, &expiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return VerifyEmailInvalid, nil
	}
	if err != nil {
		return VerifyEmailInvalid, err
	}
	if attempts >= maxAttempts {
		return VerifyEmailTooMany, nil
	}
	if !expiresAt.After(time.Now()) {
		return VerifyEmailExpired, nil
	}
	if len(expected) != len(codeHash) || subtle.ConstantTimeCompare(expected, codeHash) != 1 {
		if _, err = tx.Exec(ctx, `UPDATE email_verifications SET attempts=attempts+1 WHERE user_id=$1`, userID); err != nil {
			return VerifyEmailInvalid, err
		}
		if err = tx.Commit(ctx); err != nil {
			return VerifyEmailInvalid, err
		}
		return VerifyEmailInvalid, nil
	}
	if _, err = tx.Exec(ctx, `UPDATE users SET is_active=TRUE,updated_at=now() WHERE id=$1`, userID); err != nil {
		return VerifyEmailInvalid, err
	}
	if _, err = tx.Exec(ctx, `UPDATE email_verifications SET code_hash=NULL,verified_at=now() WHERE user_id=$1`, userID); err != nil {
		return VerifyEmailInvalid, err
	}
	if err = tx.Commit(ctx); err != nil {
		return VerifyEmailInvalid, err
	}
	return VerifyEmailAccepted, nil
}

func (s *PostgresStore) ReplaceEmailVerification(ctx context.Context, email string, codeHash []byte, expiresAt, notBefore time.Time) (VerificationIssue, error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return VerificationIssue{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	var issue VerificationIssue
	err = tx.QueryRow(ctx, `SELECT id::text,email,display_name,password_hash,is_active FROM users WHERE lower(email)=lower($1) FOR UPDATE`, email).Scan(&issue.User.ID, &issue.User.Email, &issue.User.DisplayName, &issue.User.PasswordHash, &issue.User.IsActive)
	if errors.Is(err, pgx.ErrNoRows) {
		return VerificationIssue{Unknown: true}, nil
	}
	if err != nil {
		return VerificationIssue{}, err
	}
	if issue.User.IsActive {
		return issue, nil
	}
	var sentAt time.Time
	err = tx.QueryRow(ctx, `SELECT sent_at FROM email_verifications WHERE user_id=$1`, issue.User.ID).Scan(&sentAt)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return VerificationIssue{}, err
	}
	if err == nil && sentAt.After(notBefore) {
		issue.RetryAfter = sentAt.Sub(notBefore)
		return issue, nil
	}
	if _, err = tx.Exec(ctx, `INSERT INTO email_verifications(user_id,code_hash,attempts,expires_at,sent_at,verified_at)
		VALUES($1,$2,0,$3,now(),NULL)
		ON CONFLICT(user_id) DO UPDATE SET code_hash=excluded.code_hash,attempts=0,expires_at=excluded.expires_at,sent_at=now(),verified_at=NULL`, issue.User.ID, codeHash, expiresAt); err != nil {
		return VerificationIssue{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return VerificationIssue{}, err
	}
	issue.Issued = true
	return issue, nil
}

func (s *PostgresStore) UpsertGoogleUser(ctx context.Context, email, displayName string) (User, bool, error) {
	user, err := s.FindUserByEmail(ctx, email)
	if err == nil {
		_, err = s.pool.Exec(ctx, `UPDATE users SET is_active=TRUE,display_name=CASE WHEN display_name='' THEN $2 ELSE display_name END,updated_at=now() WHERE id=$1`, user.ID, displayName)
		if err != nil {
			return User{}, false, err
		}
		user.IsActive = true
		if user.DisplayName == "" {
			user.DisplayName = displayName
		}
		return user, false, nil
	}
	if !errors.Is(err, ErrInvalidCredentials) {
		return User{}, false, err
	}
	if displayName == "" {
		displayName = email
	}
	user, err = s.CreateUser(ctx, Account{Email: email, DisplayName: displayName, PasswordHash: "!", IsActive: true})
	if errors.Is(err, ErrEmailTaken) {
		return s.UpsertGoogleUser(ctx, email, displayName)
	}
	return user, true, err
}

var _ = time.Time{}
