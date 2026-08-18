package identity

import (
	"context"
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
	err := s.pool.QueryRow(ctx, `INSERT INTO users (email, display_name, password_hash) VALUES ($1,$2,$3) RETURNING id::text,email,display_name,password_hash`, a.Email, a.DisplayName, a.PasswordHash).Scan(&u.ID, &u.Email, &u.DisplayName, &u.PasswordHash)
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
	err := s.pool.QueryRow(ctx, `SELECT id::text,email,display_name,password_hash FROM users WHERE lower(email)=lower($1)`, email).Scan(&u.ID, &u.Email, &u.DisplayName, &u.PasswordHash)
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
	err := s.pool.QueryRow(ctx, `SELECT u.id::text,u.email,u.display_name,u.password_hash,s.csrf_token_hash,s.expires_at FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`, hash).Scan(&x.User.ID, &x.User.Email, &x.User.DisplayName, &x.User.PasswordHash, &x.CSRFTokenHash, &x.ExpiresAt)
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

var _ = time.Time{}
