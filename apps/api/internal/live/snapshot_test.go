package live

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestParticipantActiveSlideRemovesCorrectnessMetadata(t *testing.T) {
	raw := json.RawMessage(`{"id":"slide-1","kind":"question","content":{"options":[{"text":"A","is_correct":true},{"text":"B","is_correct":false}],"correct_option_indexes":[0]}}`)

	sanitized, err := sanitizeParticipantActiveSlide(raw)
	if err != nil {
		t.Fatal(err)
	}
	for _, forbidden := range []string{"is_correct", "correct_answer", "correct_option_indexes"} {
		if strings.Contains(string(sanitized), forbidden) {
			t.Fatalf("participant active slide disclosed %q: %s", forbidden, sanitized)
		}
	}
	if !strings.Contains(string(sanitized), `"text":"A"`) {
		t.Fatalf("participant slide content was not preserved: %s", sanitized)
	}
}

func TestParticipantActiveSlideAcceptsEmptyPayload(t *testing.T) {
	sanitized, err := sanitizeParticipantActiveSlide(nil)
	if err != nil || sanitized != nil {
		t.Fatalf("empty active slide = %q, %v", sanitized, err)
	}
}
