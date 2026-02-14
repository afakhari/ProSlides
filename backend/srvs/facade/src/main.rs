use actix::*;
use actix_web::{App, Error, HttpRequest, HttpResponse, HttpServer, web};
use parking_lot::Mutex;
use redis::aio::ConnectionManager;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

// Local modules
mod manager;
mod models;
mod player;
mod utils;
use models::{
    BroadcastToPlayers, ManagerSession, ManagerText, MarkRunStarted, NewQuestion,
    PlayerAnswerMessage, PlayerOk, PlayerSession, PlayerText, RedisPool, RegisterManager,
    RegisterPlayer, ResetRoomReplay, Room, RoomReplayCache, SendPlayerList, UnregisterManager,
    UnregisterPlayer,
};
use std::time::{Duration, Instant};
use utils::{cleanup_quiz_redis, get_quiz_setup, save_slide_index};

const ABANDONED_ROOM_TTL: Duration = Duration::from_secs(900);

pub const REDIS_URL: &str = "redis://127.0.0.1/";

impl Room {
    pub fn new(session_id: String, redis_pool: RedisPool) -> Self {
        Room {
            players: HashSet::new(),
            manager: None,
            ok_responses: 0,
            replay_cache: RoomReplayCache::default(),
            run_id: 0,
            started: false,
            abandoned: false,
            abandoned_at: None,
            redis_pool,
            session_id,
        }
    }
}

impl Actor for Room {
    type Context = Context<Self>;
}

impl Handler<NewQuestion> for Room {
    type Result = ();
    fn handle(&mut self, msg: NewQuestion, _: &mut Self::Context) {
        self.replay_cache.on_new_question(msg.0);
    }
}

impl Handler<PlayerAnswerMessage> for Room {
    type Result = ();

    fn handle(&mut self, msg: PlayerAnswerMessage, _: &mut Self::Context) {
        let answer = msg.0.clone();

        println!(
            "🧩 Player {} answered question {}: {:?}",
            answer.user_id, answer.question_id, answer.options_result
        );

        // You can later store this in DB or a HashMap for scoring
        // Example: self.answers.insert(answer.user_id, answer);
    }
}

#[derive(Serialize)]
struct PlayerListMsg {
    r#type: u8,
    users: Vec<serde_json::Value>,
}

impl Handler<SendPlayerList> for Room {
    type Result = ();

    fn handle(&mut self, data: SendPlayerList, _: &mut Self::Context) {
        let manager = self.manager.clone();
        let session_id = data.session_id.clone();
        let mut con = self.redis_pool.clone();
        let new_player = data.new_player.clone();

        actix_rt::spawn(async move {
            if manager.is_none() {
                return;
            }

            // Get all player keys
            let pattern = format!("players:{session_id}");
            let keys: Vec<String> = match redis::cmd("SMEMBERS")
                .arg(&pattern)
                .query_async(&mut con)
                .await
            {
                Ok(k) => k,
                Err(_) => return,
            };

            let mut users = Vec::with_capacity(keys.len() + 1);

            // Batch get all player data if keys exist
            if !keys.is_empty() {
                let player_jsons: Vec<Option<String>> =
                    match redis::cmd("MGET").arg(&keys).query_async(&mut con).await {
                        Ok(v) => v,
                        Err(_) => return,
                    };

                let new_player_id = new_player.get("user_id");
                for json_opt in player_jsons.into_iter().flatten() {
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&json_opt) {
                        if v.get("user_id") != new_player_id {
                            users.push(v);
                        }
                    }
                }
            }

            // Add new player
            users.push(new_player);

            let msg = PlayerListMsg { r#type: 7, users };

            if let Ok(payload) = serde_json::to_string(&msg) {
                manager.unwrap().do_send(ManagerText(payload));
            }
        });
    }
}

impl Handler<RegisterPlayer> for Room {
    type Result = ();
    fn handle(&mut self, msg: RegisterPlayer, _: &mut Self::Context) {
        let player = msg.0.clone();
        self.players.insert(player.clone());
        let ttl = Duration::from_secs(7200);
        let manager_connected = self.manager.is_some() && !self.abandoned;
        if let Some(payload) = self
            .replay_cache
            .replay_payload(self.run_id, manager_connected, ttl)
        {
            player.do_send(PlayerText(payload));
        }
    }
}

impl Handler<UnregisterPlayer> for Room {
    type Result = ();
    fn handle(&mut self, msg: UnregisterPlayer, _: &mut Self::Context) {
        self.players.remove(&msg.0);
    }
}

impl Handler<RegisterManager> for Room {
    type Result = ();
    fn handle(&mut self, msg: RegisterManager, _: &mut Self::Context) {
        self.manager = Some(msg.0);
        self.abandoned = false;
        self.abandoned_at = None;
    }
}

impl Handler<UnregisterManager> for Room {
    type Result = ();
    fn handle(&mut self, _: UnregisterManager, ctx: &mut Self::Context) {
        self.manager = None;
        self.abandoned = true;
        self.abandoned_at = Some(Instant::now());

        let cleanup_after = ABANDONED_ROOM_TTL;
        ctx.run_later(cleanup_after, |act, _| {
            if act.manager.is_some() || !act.abandoned {
                return;
            }
            if let Some(at) = act.abandoned_at {
                if at.elapsed() < ABANDONED_ROOM_TTL {
                    return;
                }
            } else {
                return;
            }

            let mut con = act.redis_pool.clone();
            let session_id = act.session_id.clone();
            actix_rt::spawn(async move {
                cleanup_quiz_redis(&mut con, &session_id).await;
                save_slide_index(&mut con, &session_id, -1).await;
            });
        });
    }
}

impl Handler<BroadcastToPlayers> for Room {
    type Result = ();
    fn handle(&mut self, msg: BroadcastToPlayers, _: &mut Self::Context) {
        self.ok_responses = 0;
        let payload = self
            .replay_cache
            .prepare_broadcast_payload(msg.0, self.run_id);
        self.replay_cache.on_broadcast(payload.clone(), self.run_id);
        for player in &self.players {
            player.do_send(PlayerText(payload.clone()));
        }

        let mut con = self.redis_pool.clone();
        let key = format!("quiz:{}:run_id", self.session_id);
        let run_id = self.run_id;
        actix_rt::spawn(async move {
            let _: Result<(), _> = redis::cmd("SET")
                .arg(&key)
                .arg(run_id)
                .query_async(&mut con)
                .await;
        });
    }
}

impl Handler<ResetRoomReplay> for Room {
    type Result = ();

    fn handle(&mut self, _: ResetRoomReplay, _: &mut Self::Context) {
        self.replay_cache.reset();
        self.started = false;
    }
}

impl Handler<MarkRunStarted> for Room {
    type Result = ();

    fn handle(&mut self, _: MarkRunStarted, _: &mut Self::Context) {
        self.run_id = self.run_id.saturating_add(1);
        self.started = true;
        self.abandoned = false;

        let payload = serde_json::json!({
            "type": 14,
            "event": "session_started",
            "run_id": self.run_id,
        })
        .to_string();

        for player in &self.players {
            player.do_send(PlayerText(payload.clone()));
        }

        let mut con = self.redis_pool.clone();
        let key = format!("quiz:{}:run_id", self.session_id);
        let run_id = self.run_id;
        actix_rt::spawn(async move {
            let _: Result<(), _> = redis::cmd("SET")
                .arg(&key)
                .arg(run_id)
                .query_async(&mut con)
                .await;
        });
    }
}

impl Handler<PlayerOk> for Room {
    type Result = ();

    fn handle(&mut self, _: PlayerOk, _ctx: &mut Self::Context) {
        self.ok_responses += 1;

        if let Some(manager) = &self.manager {
            manager.do_send(ManagerText(format!(
                "OK count: {} / {}",
                self.ok_responses,
                self.players.len()
            )));
        }

        // When all players have responded
        if self.ok_responses == self.players.len() && !self.players.is_empty() {
            println!("✅ All players OK. Starting timer...");
        }
    }
}

// ====== App State ======
struct AppState {
    rooms: Mutex<HashMap<String, Addr<Room>>>,
    redis_pool: RedisPool,
}

// ====== Route ======
async fn ws_route(
    req: HttpRequest,
    stream: web::Payload,
    data: web::Data<AppState>,
    path: web::Path<(String, String)>, // (session_id, role)
) -> Result<HttpResponse, Error> {
    let (session_id, role) = path.into_inner();
    let redis_pool = data.redis_pool.clone();

    let room = {
        let mut rooms = data.rooms.lock();
        rooms
            .entry(session_id.clone())
            .or_insert_with(|| Room::new(session_id.clone(), redis_pool.clone()).start())
            .clone()
    };

    match role.as_str() {
        "manager" => {
            let quiz_setup = get_quiz_setup(&session_id).await.map_err(|e| {
                actix_web::error::ErrorInternalServerError(format!("Failed to get quiz: {}", e))
            })?;
            actix_web_actors::ws::start(
                ManagerSession {
                    room,
                    session_id: session_id.clone(),
                    redis_pool: redis_pool.clone(),
                    quiz_setup,
                    hb: Instant::now(),
                },
                &req,
                stream,
            )
        }
        "player" => actix_web_actors::ws::start(
            PlayerSession {
                id: Uuid::new_v4(),
                room,
                name: None,
                character: None,
                registered_user_id: None,
                session_id,
                redis_pool: redis_pool.clone(),
                quiz_setup: None,
                hb: Instant::now(),
            },
            &req,
            stream,
        ),
        _ => Ok(HttpResponse::BadRequest().body("role must be 'manager' or 'player'")),
    }
}

// ====== Main ======
#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Create Redis connection pool
    let redis_client = redis::Client::open(REDIS_URL).expect("Failed to create Redis client");
    let redis_pool = ConnectionManager::new(redis_client)
        .await
        .expect("Failed to create Redis connection pool");

    let data = web::Data::new(AppState {
        rooms: Mutex::new(HashMap::new()),
        redis_pool,
    });

    println!("🚀 Server running on http://localhost:8080");

    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .route("/ws/{session_id}/{role}", web::get().to(ws_route))
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
