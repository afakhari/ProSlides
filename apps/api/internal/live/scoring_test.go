package live

import (
	"testing"
	"time"
)

func TestDeductionPolicy(t *testing.T) {
	p := DeductionPolicy{}
	q := Question{Type: "multiple", Correct: []int{0, 1}, MaxPoints: 100, MinPoints: 10, PartialScoring: true}
	if got := p.Score(q, []int{0, 1}); got != 100 {
		t.Fatalf("got %d", got)
	}
	if got := p.Score(q, []int{0, 2}); got != 0 {
		t.Fatalf("got %d", got)
	}
	if got := p.Score(q, []int{0}); got != 50 {
		t.Fatalf("partial score=%d", got)
	}
	if got := p.Score(q, []int{0, 0}); got != 50 {
		t.Fatalf("duplicate selection score=%d", got)
	}
	if got := p.Score(q, []int{2}); got != 0 {
		t.Fatalf("got %d", got)
	}
}

func TestDeductionPolicySupportsTimingAndExactMode(t *testing.T) {
	p := DeductionPolicy{}
	q := Question{Correct: []int{0, 1}, MaxPoints: 100, MinPoints: 20, FasterAnswers: true, Duration: 10 * time.Second, Remaining: 5 * time.Second}
	if got := p.Score(q, []int{0, 1}); got != 60 {
		t.Fatalf("timed score=%d", got)
	}
	if got := p.Score(q, []int{0}); got != 0 {
		t.Fatalf("exact mode score=%d", got)
	}
}
