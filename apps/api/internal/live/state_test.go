package live

import "testing"

func TestStateTransitions(t *testing.T) {
	if !CanTransition(Lobby, QuestionOpen) || !CanTransition(QuestionOpen, QuestionClosed) || CanTransition(QuestionOpen, Leaderboard) || CanTransition(Ended, Lobby) {
		t.Fatal("unexpected transition policy")
	}
}
