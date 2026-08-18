package live

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"strings"
)

type Service struct {
	store   Store
	scoring ScoringPolicy
}

func NewService(store Store, scoring ScoringPolicy) *Service {
	return &Service{store: store, scoring: scoring}
}

func (s *Service) CreateSession(c context.Context, host, presentation, request string) (Session, bool, error) {
	if host == "" || presentation == "" || request == "" {
		return Session{}, false, ErrInvalid
	}
	code, e := joinCode()
	if e != nil {
		return Session{}, false, e
	}
	return s.store.CreateSession(c, host, presentation, request, code)
}
func (s *Service) Join(c context.Context, session, request, name, avatar string) (Participant, bool, error) {
	name = strings.TrimSpace(name)
	if session == "" || request == "" || name == "" || len(name) > 100 || len(avatar) > 100 {
		return Participant{}, false, ErrInvalid
	}
	return s.store.Join(c, session, request, name, avatar, tokenHash(request))
}
func (s *Service) Action(c context.Context, session, host, request string, version int64, action, slide string, duration int) (Session, bool, error) {
	if session == "" || host == "" || request == "" || version < 1 {
		return Session{}, false, ErrInvalid
	}
	return s.store.ApplyAction(c, session, host, request, version, action, slide, duration)
}
func (s *Service) Submit(c context.Context, session, participantToken, request, slide string, selected []int) (AnswerResult, error) {
	if session == "" || participantToken == "" || request == "" || slide == "" || len(selected) == 0 {
		return AnswerResult{}, ErrInvalid
	}
	for _, v := range selected {
		if v < 0 {
			return AnswerResult{}, ErrInvalid
		}
	}
	return s.store.SubmitAnswer(c, session, tokenHash(participantToken), request, slide, selected, s.scoring)
}
func (s *Service) Snapshot(c context.Context, session string) (Snapshot, error) {
	return s.store.Snapshot(c, session)
}
func (s *Service) Events(c context.Context, session string, after int64) ([]Event, error) {
	return s.store.Events(c, session, after, 200)
}
func (s *Service) AuthorizeViewer(c context.Context, session, manager, participantToken string) error {
	var hash []byte
	if participantToken != "" {
		hash = tokenHash(participantToken)
	}
	return s.store.AuthorizeViewer(c, session, manager, hash)
}
func tokenHash(v string) []byte { x := sha256.Sum256([]byte(v)); return x[:] }
func joinCode() (string, error) {
	b := make([]byte, 4)
	if _, e := rand.Read(b); e != nil {
		return "", e
	}
	return strings.ToUpper(hex.EncodeToString(b)), nil
}
