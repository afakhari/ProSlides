package live

import (
	"context"
	"encoding/json"
	"sync"
	"time"
)

const eventPageSize = 200

// EventBroker collapses database polling from one query per SSE connection to
// one query per active session per API process. PostgreSQL remains the replay
// ledger; a slow subscriber is disconnected and recovers through Last-Event-ID.
type EventBroker struct {
	store    EventStore
	interval time.Duration
	buffer   int

	mu       sync.Mutex
	sessions map[string]*eventStream
	nextID   uint64
}

type eventStream struct {
	cancel      context.CancelFunc
	cursor      int64
	subscribers map[uint64]chan Event
}

func NewEventBroker(store EventStore, interval time.Duration, subscriberBuffer int) *EventBroker {
	if interval <= 0 {
		interval = 250 * time.Millisecond
	}
	if subscriberBuffer < 1 {
		subscriberBuffer = 256
	}
	return &EventBroker{store: store, interval: interval, buffer: subscriberBuffer, sessions: map[string]*eventStream{}}
}

func (b *EventBroker) Subscribe(c context.Context, session string) (<-chan Event, func(), error) {
	b.mu.Lock()
	stream := b.sessions[session]
	if stream == nil {
		b.mu.Unlock()
		cursor, e := b.store.LatestEventID(c, session)
		if e != nil {
			return nil, nil, e
		}
		b.mu.Lock()
		stream = b.sessions[session]
		if stream == nil {
			streamCtx, cancel := context.WithCancel(context.Background())
			stream = &eventStream{cancel: cancel, cursor: cursor, subscribers: map[uint64]chan Event{}}
			b.sessions[session] = stream
			go b.run(streamCtx, session, stream)
		}
	}
	b.nextID++
	id := b.nextID
	ch := make(chan Event, b.buffer)
	stream.subscribers[id] = ch
	b.mu.Unlock()

	var once sync.Once
	unsubscribe := func() {
		once.Do(func() { b.unsubscribe(session, stream, id) })
	}
	return ch, unsubscribe, nil
}

func (b *EventBroker) run(c context.Context, session string, stream *eventStream) {
	ticker := time.NewTicker(b.interval)
	defer ticker.Stop()
	for {
		select {
		case <-c.Done():
			return
		case <-ticker.C:
			for {
				events, e := b.store.Events(c, session, stream.cursor, eventPageSize)
				if e != nil || len(events) == 0 {
					break
				}
				stream.cursor = events[len(events)-1].EventID
				for _, event := range compactEvents(events) {
					b.publish(session, stream, event)
				}
				if len(events) < eventPageSize {
					break
				}
			}
		}
	}
}

func compactEvents(events []Event) []Event {
	out := make([]Event, 0, len(events))
	var pendingPresence *Event
	presenceDelta := 0
	flushPresence := func() {
		if pendingPresence != nil {
			pendingPresence.Payload, _ = json.Marshal(map[string]int{"participant_delta": presenceDelta})
			out = append(out, *pendingPresence)
			pendingPresence = nil
			presenceDelta = 0
		}
	}
	for index := range events {
		if events[index].Name == "presence.updated" {
			pendingPresence = &events[index]
			presenceDelta++
			continue
		}
		flushPresence()
		out = append(out, events[index])
	}
	flushPresence()
	return out
}

func (b *EventBroker) publish(session string, stream *eventStream, event Event) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.sessions[session] != stream {
		return
	}
	for id, subscriber := range stream.subscribers {
		select {
		case subscriber <- event:
		default:
			close(subscriber)
			delete(stream.subscribers, id)
		}
	}
	if len(stream.subscribers) == 0 {
		delete(b.sessions, session)
		stream.cancel()
	}
}

func (b *EventBroker) unsubscribe(session string, stream *eventStream, id uint64) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.sessions[session] != stream {
		return
	}
	if subscriber, ok := stream.subscribers[id]; ok {
		close(subscriber)
		delete(stream.subscribers, id)
	}
	if len(stream.subscribers) == 0 {
		delete(b.sessions, session)
		stream.cancel()
	}
}
