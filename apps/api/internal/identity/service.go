package identity

import (
	"errors"
	"net/mail"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

var ErrInvalidRegistration = errors.New("invalid registration")

type Registration struct{ Email, DisplayName, Password string }
type Account struct{ Email, DisplayName, PasswordHash string }

// PrepareRegistration validates and normalizes data before it reaches a repository.
// Passwords never leave this function in plaintext.
func PrepareRegistration(input Registration) (Account, error) {
	email := strings.ToLower(strings.TrimSpace(input.Email))
	name := strings.TrimSpace(input.DisplayName)
	if len(email) > 320 || len(name) == 0 || len(name) > 100 || len(input.Password) < 12 || len(input.Password) > 128 {
		return Account{}, ErrInvalidRegistration
	}
	parsed, err := mail.ParseAddress(email)
	if err != nil || parsed.Address != email {
		return Account{}, ErrInvalidRegistration
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return Account{}, err
	}
	return Account{Email: email, DisplayName: name, PasswordHash: string(hash)}, nil
}

func VerifyPassword(password, hash string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}
