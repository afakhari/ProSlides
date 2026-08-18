package live

import "testing"

func TestStateTransitions(t *testing.T) {
	allowed := map[State]map[State]bool{
		Draft:          {Lobby: true},
		Lobby:          {Content: true, QuestionOpen: true, Ended: true},
		Content:        {Content: true, QuestionOpen: true, Ended: true},
		QuestionOpen:   {QuestionClosed: true},
		QuestionClosed: {Leaderboard: true, Content: true, QuestionOpen: true, Ended: true},
		Leaderboard:    {Content: true, QuestionOpen: true, Ended: true},
		Ended:          {},
	}
	states := []State{Draft, Lobby, Content, QuestionOpen, QuestionClosed, Leaderboard, Ended}
	for _, from := range states {
		for _, to := range states {
			if got, want := CanTransition(from, to), allowed[from][to]; got != want {
				t.Fatalf("CanTransition(%q, %q) = %v, want %v", from, to, got, want)
			}
		}
	}
}
