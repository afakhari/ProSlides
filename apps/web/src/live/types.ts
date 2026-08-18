export type LiveState = "draft" | "lobby" | "content" | "question_open" | "question_closed" | "leaderboard" | "ended";

export interface PublicLiveSession {
  id: string;
  presentation_id: string;
  state: LiveState;
  state_version: number;
  active_slide_id: string | null;
  ends_at: string | null;
}

export interface ManagerLiveSession extends PublicLiveSession {
  host_id: string;
  join_code: string;
}

export interface ParticipantWithScore {
  id: string;
  display_name: string;
  avatar?: string;
  score: number;
}

export interface ParticipantSnapshot {
  role: "participant";
  session: PublicLiveSession;
  active_slide?: Record<string, unknown>;
  participant: ParticipantWithScore;
  participant_count: number;
  last_event_id: number;
}

export interface ManagerSnapshot {
  role: "manager";
  session: ManagerLiveSession;
  active_slide?: Record<string, unknown>;
  participant_count: number;
  last_event_id: number;
}

export type LiveSnapshot = ParticipantSnapshot | ManagerSnapshot;

export interface LiveEvent {
  event_id: number;
  schema_version: 1 | 2;
  session_id: string;
  state_version: number;
  name: "session.created" | "presence.updated" | "session.state_changed" | "answer.stats" | "leaderboard.updated";
  payload: unknown;
  occurred_at: string;
}

export interface RosterEntry {
  participant_id: string;
  display_name: string;
  avatar?: string;
  score: number;
  joined_at: string;
}

export interface RosterPage {
  items: RosterEntry[];
  order: "joined" | "score";
  limit: number;
  has_more: boolean;
  next_cursor?: string;
}

export interface LiveSessionResult extends ManagerLiveSession {}
export interface ParticipantResult { id: string; display_name: string; avatar?: string }
export interface AnswerResult { answer_id: string; score_delta: number; duplicate: boolean }
export interface LiveSessionLocator { session_id: string; presentation_id: string }
export interface PresentationSlide { id: string; position: number; kind: string; content: Record<string, unknown> }
export interface Presentation {
  id: string;
  title: string;
  settings: Record<string, string>;
  created_at: string;
  updated_at: string;
  slides: PresentationSlide[];
}
