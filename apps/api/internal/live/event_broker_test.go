package live

import (
	"context"
	"encoding/json"
	"strings"
	"sync"
	"testing"
	"time"
)

type brokerStore struct {
	mu         sync.Mutex
	events     []Event
	eventCalls int
}

func (s *brokerStore) LatestEventID(context.Context, string) (int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.events) == 0 {
		return 0, nil
	}
	return s.events[len(s.events)-1].EventID, nil
}

func (s *brokerStore) Events(_ context.Context, _ string, after int64, limit int) ([]Event, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.eventCalls++
	out := []Event{}
	for _, event := range s.events {
		if event.EventID > after {
			out = append(out, event)
			if len(out) == limit {
				break
			}
		}
	}
	return out, nil
}

func (s *brokerStore) append(events ...Event) {
	s.mu.Lock()
	s.events = append(s.events, events...)
	s.mu.Unlock()
}

func TestEventBrokerSharesOneSessionPoller(t *testing.T) {
	store := &brokerStore{events: []Event{{EventID: 1}}}
	broker := NewEventBroker(store, 5*time.Millisecond, 4)
	first, cancelFirst, e := broker.Subscribe(context.Background(), "session")
	if e != nil {
		t.Fatal(e)
	}
	defer cancelFirst()
	second, cancelSecond, e := broker.Subscribe(context.Background(), "session")
	if e != nil {
		t.Fatal(e)
	}
	defer cancelSecond()

	store.append(Event{EventID: 2, SessionID: "session", Name: "session.state_changed"})
	for index, subscriber := range []<-chan Event{first, second} {
		select {
		case event := <-subscriber:
			if event.EventID != 2 {
				t.Fatalf("subscriber %d received event %d", index, event.EventID)
			}
		case <-time.After(time.Second):
			t.Fatalf("subscriber %d timed out", index)
		}
	}

	store.mu.Lock()
	calls := store.eventCalls
	store.mu.Unlock()
	if calls > 3 {
		t.Fatalf("expected shared polling, got %d store calls", calls)
	}
}

func TestEventBrokerDisconnectsSlowSubscriber(t *testing.T) {
	store := &brokerStore{}
	broker := NewEventBroker(store, 5*time.Millisecond, 1)
	subscriber, cancel, e := broker.Subscribe(context.Background(), "session")
	if e != nil {
		t.Fatal(e)
	}
	defer cancel()
	store.append(Event{EventID: 1}, Event{EventID: 2})
	time.Sleep(25 * time.Millisecond)

	select {
	case <-subscriber:
	case <-time.After(time.Second):
		t.Fatal("first event timed out")
	}
	select {
	case _, open := <-subscriber:
		if open {
			t.Fatal("slow subscriber remained connected")
		}
	case <-time.After(time.Second):
		t.Fatal("slow subscriber was not disconnected")
	}
}

func TestCompactEventsKeepsOnlyLatestPresenceInBurst(t *testing.T) {
	events := []Event{
		{EventID: 1, Name: "presence.updated"},
		{EventID: 2, Name: "presence.updated"},
		{EventID: 3, Name: "session.state_changed"},
		{EventID: 4, Name: "presence.updated"},
		{EventID: 5, Name: "presence.updated"},
	}
	got := compactEvents(events)
	if len(got) != 3 || got[0].EventID != 2 || got[1].EventID != 3 || got[2].EventID != 5 {
		t.Fatalf("unexpected compacted events: %#v", got)
	}
	var payload struct {
		ParticipantDelta int `json:"participant_delta"`
	}
	if e := json.Unmarshal(got[0].Payload, &payload); e != nil || payload.ParticipantDelta != 2 {
		t.Fatalf("unexpected presence payload: %s (%v)", got[0].Payload, e)
	}
}

func TestSanitizeReplayedEventRemovesHistoricalLeaderboardRows(t *testing.T) {
	event := Event{
		SchemaVersion: 1,
		Name:          "leaderboard.updated",
		Payload:       json.RawMessage(`[{"participant_id":"secret-1","score":100},{"participant_id":"secret-2","score":50}]`),
	}
	if err := sanitizeReplayedEvent(&event); err != nil {
		t.Fatal(err)
	}
	if event.SchemaVersion != 2 {
		t.Fatalf("schema version = %d", event.SchemaVersion)
	}
	var payload map[string]int
	if err := json.Unmarshal(event.Payload, &payload); err != nil {
		t.Fatal(err)
	}
	if payload["participant_count"] != 2 || strings.Contains(string(event.Payload), "participant_id") {
		t.Fatalf("unexpected sanitized payload: %s", event.Payload)
	}
}
