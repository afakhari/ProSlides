package live

import "time"

type Question struct {
	Type                 string
	Correct              []int
	MaxPoints, MinPoints int
	PartialScoring       bool
	FasterAnswers        bool
	Duration             time.Duration
	Remaining            time.Duration
}
type ScoringPolicy interface{ Score(Question, []int) int }
type DeductionPolicy struct{}

func (DeductionPolicy) Score(q Question, selected []int) int {
	if len(q.Correct) == 0 {
		return 0
	}
	correct := map[int]bool{}
	for _, i := range q.Correct {
		correct[i] = true
	}
	seen := map[int]bool{}
	hits, wrong := 0, 0
	for _, i := range selected {
		if seen[i] {
			continue
		}
		seen[i] = true
		if correct[i] {
			hits++
		} else {
			wrong++
		}
	}
	numerator := hits - wrong
	if numerator <= 0 {
		return 0
	}
	if !q.PartialScoring && (hits != len(q.Correct) || wrong != 0) {
		return 0
	}
	base := q.MaxPoints
	if q.FasterAnswers && q.Duration > 0 {
		remaining := q.Remaining
		if remaining < 0 {
			remaining = 0
		}
		if remaining > q.Duration {
			remaining = q.Duration
		}
		base = q.MinPoints + int(float64(q.MaxPoints-q.MinPoints)*float64(remaining)/float64(q.Duration))
	}
	value := base * numerator / len(q.Correct)
	return value
}
