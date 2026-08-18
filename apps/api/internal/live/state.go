package live

import "errors"

type State string

const (
	Draft          State = "draft"
	Lobby          State = "lobby"
	Content        State = "content"
	QuestionOpen   State = "question_open"
	QuestionClosed State = "question_closed"
	Leaderboard    State = "leaderboard"
	Ended          State = "ended"
)

var ErrInvalidTransition = errors.New("invalid live state transition")

func CanTransition(from, to State) bool {
	switch from {
	case Draft:
		return to == Lobby
	case Lobby:
		return to == Content || to == QuestionOpen || to == Ended
	case Content:
		return to == Content || to == QuestionOpen || to == Ended
	case QuestionOpen:
		return to == QuestionClosed
	case QuestionClosed:
		return to == Leaderboard || to == Content || to == QuestionOpen || to == Ended
	case Leaderboard:
		return to == Content || to == QuestionOpen || to == Ended
	}
	return false
}
