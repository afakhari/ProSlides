use actix::*;
use redis::aio::ConnectionManager;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::time::{Duration, Instant};
use uuid::Uuid;

// Type alias for Redis connection pool
pub type RedisPool = ConnectionManager;

//
// ==== Question struct ====
#[derive(Serialize, Clone)]
pub struct OptionItem {
    pub option_id: u32,
    pub option_text: String,
    pub image: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct Question {
    pub r#type: u8,
    pub question_id: u64,
    pub question_text: String,
    pub question_time: u32,
    pub max_point: f64,
    pub min_point: f64,
    pub has_multiple: bool,
    pub options: Vec<OptionItem>,
}

#[derive(serde::Serialize, Clone)]
pub struct OptionResult {
    pub option_id: u32,
    pub answer: bool,
}

#[derive(serde::Serialize, Clone)]
pub struct QuestionResult {
    pub r#type: u8,
    pub question_id: u64,
    pub options_result: Vec<OptionResult>,
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct NewQuestion(pub Question);

// ===== Player Answer =====

#[derive(Deserialize, Clone, Debug, serde::Serialize)]
pub struct PlayerOptionAnswer {
    pub option_id: u32,
    pub picked: bool,
}

#[allow(dead_code)]
#[derive(Deserialize, Clone, Debug)]
pub struct PlayerAnswer {
    pub r#type: u8,
    pub question_id: u32,
    pub user_id: String,
    pub submit_time: f32,
    #[serde(default)]
    pub run_id: Option<u64>,
    pub options_result: Vec<PlayerOptionAnswer>,
}

#[allow(dead_code)]
#[derive(Message)]
#[rtype(result = "()")]
pub struct PlayerAnswerMessage(pub PlayerAnswer);

#[derive(Deserialize, Clone, Debug)]
pub struct ManagerAction {
    pub r#type: u8,
    pub action: String,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct PlayerInfo {
    pub r#type: u8,
    pub name: String,
    pub character: String,
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct SendPlayerList {
    pub session_id: String,
    pub new_player: serde_json::Value,
}

#[allow(dead_code)]
#[derive(Message)]
#[rtype(result = "()")]
pub struct QuizSetupMessage(pub QuizSetup);

// ====== Room ======
#[allow(dead_code)]
pub struct Room {
    pub players: HashSet<Addr<PlayerSession>>,
    pub manager: Option<Addr<ManagerSession>>,
    pub ok_responses: usize,
    pub replay_cache: RoomReplayCache,
    pub run_id: u64,
    pub started: bool,
    pub abandoned: bool,
    pub redis_pool: RedisPool,
    pub session_id: String,
}

#[derive(Default)]
pub struct RoomReplayCache {
    pub last_question: Option<Question>,
    pub last_player_payload: Option<String>,
    pub last_run_id: u64,
    pub stored_at: Option<Instant>,
}

impl RoomReplayCache {
    pub fn on_new_question(&mut self, question: Question) {
        self.last_question = Some(question);
    }

    pub fn on_broadcast(&mut self, payload: String, run_id: u64) {
        self.last_player_payload = Some(payload);
        self.last_run_id = run_id;
        self.stored_at = Some(Instant::now());
    }

    pub fn replay_payload(
        &self,
        run_id: u64,
        manager_connected: bool,
        ttl: Duration,
    ) -> Option<String> {
        if !manager_connected {
            return None;
        }
        if self.last_run_id != run_id {
            return None;
        }
        let stored_at = self.stored_at?;
        if stored_at.elapsed() > ttl {
            return None;
        }
        self.last_player_payload.clone()
    }

    pub fn reset(&mut self) {
        self.last_question = None;
        self.last_player_payload = None;
        self.last_run_id = 0;
        self.stored_at = None;
    }
}

//
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct QuizSetup {
    pub quiz_id: u32,
    pub title: String,
    pub background: Background,
    #[serde(default)]
    pub music_url: Option<String>,
    pub access_code: String,
    pub slides: Vec<Slide>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Background {
    pub color: String,
    pub image: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Slide {
    pub slide_id: u64,
    pub slide_type: u8, // 1 = question, 2 = content, 3 = leaderboard
    pub order: u16,
    #[serde(default)]
    pub show_leaderboad_after: Option<bool>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub content_text: Option<String>,
    #[serde(default)]
    pub content_image_url: Option<String>,
    #[serde(default)]
    pub question: Option<QuizQuestion>,
    #[serde(default)]
    pub leaderboard: Vec<LeaderboardEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LeaderboardEntry {
    #[serde(default)]
    pub rust_session_id: String,
    #[serde(default)]
    pub player_name: String,
    #[serde(default)]
    pub avatar: String,
    #[serde(default)]
    pub score: u32,
    #[serde(default)]
    pub time_taken: f32,
    #[serde(default)]
    pub rank: u16,
}

#[derive(Debug, Serialize, Clone)]
pub struct LeaderboardUpdate {
    pub leaderboard: Vec<LeaderboardEntry>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct QuizQuestion {
    pub question_id: u64,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub text: Option<String>,
    pub question_type: String,
    #[serde(default)]
    pub image_url: Option<String>,
    pub partial_scoring: bool,
    pub time_limit: u32,
    #[serde(default)]
    pub max_point: f64,
    #[serde(default)]
    pub min_point: f64,
    #[serde(default)]
    pub faster_answers_more_points: bool,
    pub options: Vec<QuizOption>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct QuizOption {
    pub option_id: u32,
    pub text: String,
    pub is_correct: bool,
    pub votes: u32,
    #[serde(default)]
    pub image_url: Option<String>,
}
//
// Messages used by Room ↔ Player
#[derive(Message)]
#[rtype(result = "()")]
pub struct PlayerText(pub String);

#[derive(Message)]
#[rtype(result = "()")]
pub struct RegisterPlayer(pub Addr<PlayerSession>);

#[derive(Message)]
#[rtype(result = "()")]
pub struct UnregisterPlayer(pub Addr<PlayerSession>);

#[derive(Message)]
#[rtype(result = "()")]
pub struct PlayerOk(#[allow(dead_code)] pub Addr<PlayerSession>);

/// Player WebSocket actor
pub struct PlayerSession {
    pub id: Uuid,
    pub room: Addr<Room>,
    pub name: Option<String>,
    pub character: Option<String>,
    pub session_id: String,
    pub redis_pool: RedisPool,
    pub quiz_setup: Option<QuizSetup>,
    pub hb: Instant,
}

#[allow(dead_code)]
#[derive(Deserialize)]
pub struct OptionPick {
    option_id: i64,
    picked: bool,
}

//

#[derive(Message)]
#[rtype(result = "()")]
pub struct ManagerText(pub String);

#[derive(Message)]
#[rtype(result = "()")]
pub struct RegisterManager(pub Addr<ManagerSession>);

#[derive(Message)]
#[rtype(result = "()")]
pub struct UnregisterManager;

#[derive(Message)]
#[rtype(result = "()")]
pub struct BroadcastToPlayers(pub String);

#[derive(Message)]
#[rtype(result = "()")]
pub struct ResetRoomReplay;

#[derive(Message)]
#[rtype(result = "()")]
pub struct MarkRunStarted;

pub struct ManagerSession {
    pub room: Addr<Room>,
    pub session_id: String,
    pub redis_pool: RedisPool,
    pub quiz_setup: QuizSetup,
    pub hb: Instant,
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct ServerMessage(pub String);

#[cfg(test)]
mod tests {
    use super::{Question, RoomReplayCache};
    use std::time::Duration;

    fn sample_question(id: u64) -> Question {
        Question {
            r#type: 2,
            question_id: id,
            question_text: format!("Q{id}"),
            question_time: 20,
            max_point: 1000.0,
            min_point: 0.0,
            has_multiple: false,
            options: vec![],
        }
    }

    #[test]
    fn replay_uses_last_broadcast_payload_not_question() {
        let mut cache = RoomReplayCache::default();
        cache.on_new_question(sample_question(10));
        cache.on_broadcast(r#"{"type":11,"results":[{"name":"A"}]}"#.to_string(), 1);

        let replay = cache.replay_payload(1, true, Duration::from_secs(30));
        assert_eq!(
            replay.as_deref(),
            Some(r#"{"type":11,"results":[{"name":"A"}]}"#)
        );
        assert_eq!(
            cache.last_question.as_ref().map(|q| q.question_id),
            Some(10)
        );
    }

    #[test]
    fn reset_clears_stale_replay_between_runs() {
        let mut cache = RoomReplayCache::default();
        cache.on_new_question(sample_question(1));
        cache.on_broadcast(r#"{"slide_type":2,"title":"Intro"}"#.to_string(), 1);

        cache.reset();

        assert!(
            cache
                .replay_payload(1, true, Duration::from_secs(30))
                .is_none()
        );
        assert!(cache.last_question.is_none());
    }

    #[test]
    fn start_then_first_slide_replay_matches_fresh_broadcast() {
        let mut cache = RoomReplayCache::default();

        cache.on_broadcast(r#"{"type":2,"question_id":99}"#.to_string(), 1);
        cache.reset();

        let first_slide_payload = r#"{"slide_id":1,"slide_type":2,"title":"Welcome"}"#;
        cache.on_broadcast(first_slide_payload.to_string(), 2);

        assert_eq!(
            cache
                .replay_payload(2, true, Duration::from_secs(30))
                .as_deref(),
            Some(first_slide_payload)
        );
    }
}
