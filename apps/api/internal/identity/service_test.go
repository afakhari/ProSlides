package identity

import (
	"errors"
	"testing"
)

func TestPrepareRegistrationNormalizesAndHashesPassword(t *testing.T) {
	account, err := PrepareRegistration(Registration{Email: " User@Example.COM ", DisplayName: "  User  ", Password: "long-enough-password"})
	if err != nil {
		t.Fatalf("PrepareRegistration() error = %v", err)
	}
	if account.Email != "user@example.com" || account.DisplayName != "User" {
		t.Fatalf("unexpected account: %#v", account)
	}
	if account.PasswordHash == "long-enough-password" || !VerifyPassword("long-enough-password", account.PasswordHash) {
		t.Fatal("password was not securely hashed")
	}
}

func TestPrepareRegistrationRejectsUnsafeInput(t *testing.T) {
	for _, input := range []Registration{{Email: "invalid", DisplayName: "User", Password: "long-enough-password"}, {Email: "u@example.com", DisplayName: "", Password: "long-enough-password"}, {Email: "u@example.com", DisplayName: "User", Password: "short"}} {
		if _, err := PrepareRegistration(input); !errors.Is(err, ErrInvalidRegistration) {
			t.Fatalf("error = %v, want ErrInvalidRegistration", err)
		}
	}
}
