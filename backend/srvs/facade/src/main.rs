use actix::*;
use actix_web::{web, App, Error, HttpRequest, HttpResponse, HttpServer};
use std::collections::{HashMap, HashSet};
use parking_lot::Mutex;
use serde::Serialize;
use uuid::Uuid;
use redis::aio::ConnectionManager;

// Local modules
mod manager;
mod player;
mod models;
mod utils;
use utils::get_quiz_setup;
use models::{
    PlayerSession,
    Room,
    NewQuestion,
    PlayerAnswerMessage,
    SendPlayerList,
    ManagerText,
    RegisterPlayer,
    UnregisterPlayer,
    BroadcastToPlayers,
    RegisterManager,
    UnregisterManager,
    PlayerText,
    PlayerOk,
    ManagerSession,
    RedisPool,
};
use std::time::Instant;

pub const REDIS_URL: &str = "redis://127.0.0.1/";


impl Room {
    pub fn new(session_id: String, redis_pool: RedisPool) -> Self {
        Room {
            players: HashSet::new(),
            manager: None,
            ok_responses: 0,
            last_question: None,
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
        self.last_question = Some(msg.0);
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
            if manager.is_none() { return; }
            
            // Get all player keys
            let pattern = format!("players:{session_id}");
            let keys: Vec<String> = match redis::cmd("SMEMBERS")
                .arg(&pattern)
                .query_async(&mut con)
                .await {
                Ok(k) => k,
                Err(_) => return,
            };

            let mut users = Vec::with_capacity(keys.len() + 1);

            // Batch get all player data if keys exist
            if !keys.is_empty() {
                let player_jsons: Vec<Option<String>> = match redis::cmd("MGET")
                    .arg(&keys)
                    .query_async(&mut con)
                    .await {
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

            let msg = PlayerListMsg {
                r#type: 7,
                users,
            };

            if let Ok(payload) = serde_json::to_string(&msg) {
                manager.unwrap().do_send(ManagerText(payload));
            }
        });
    }
}

impl Handler<RegisterPlayer> for Room {
    type Result = ();
    fn handle(&mut self, msg: RegisterPlayer, _: &mut Self::Context) {
        self.players.insert(msg.0);
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
    }
}

impl Handler<UnregisterManager> for Room {
    type Result = ();
    fn handle(&mut self, _: UnregisterManager, _: &mut Self::Context) {
        self.manager = None;
    }
}

impl Handler<BroadcastToPlayers> for Room {
    type Result = ();
    fn handle(&mut self, msg: BroadcastToPlayers, _: &mut Self::Context) {
        self.ok_responses = 0;
        for player in &self.players {
            player.do_send(PlayerText(msg.0.clone()));
        }
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
    let redis_client = redis::Client::open(REDIS_URL)
        .expect("Failed to create Redis client");
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
