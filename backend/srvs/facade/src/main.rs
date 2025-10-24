use actix::*;
use actix_web::{web, App, Error, HttpRequest, HttpResponse, HttpServer};
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use serde::Serialize;

// Local modules
mod manager;
mod player;

use manager::*;
use player::*;

// ==== Question struct ====
#[derive(Serialize, Clone)]
pub struct OptionItem {
    pub option_id: u32,
    pub option_text: String,
}

#[derive(Serialize, Clone)]
pub struct Question {
    pub r#type: u8,
    pub question_id: u32,
    pub question_text: String,
    pub question_time: u32,
    pub max_point: u32,
    pub min_point: u32,
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
    pub question_id: u32,
    pub options_result: Vec<OptionResult>,
}


// ====== Room ======
pub struct Room {
    players: HashSet<Addr<PlayerSession>>,
    manager: Option<Addr<ManagerSession>>,
    ok_responses: usize,
}

impl Room {
    pub fn new() -> Self {
        Room {
            players: HashSet::new(),
            manager: None,
            ok_responses: 0,
        }
    }
}

impl Actor for Room {
    type Context = Context<Self>;
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

    fn handle(&mut self, _: PlayerOk, ctx: &mut Self::Context) {
        self.ok_responses += 1;

        // Notify the manager about progress
        if let Some(manager) = &self.manager {
            manager.do_send(ManagerText(format!(
                "OK count: {} / {}",
                self.ok_responses,
                self.players.len()
            )));
        }

        // When all players have acknowledged
        if self.ok_responses == self.players.len() && self.players.len() > 0 {
            println!("✅ All players sent OK. Starting 10s timer...");

            let players = self.players.clone();

            // Define your result data
            let result = crate::QuestionResult {
                r#type: 3,
                question_id: 45,
                options_result: vec![
                    crate::OptionResult { option_id: 58, answer: false },
                    crate::OptionResult { option_id: 59, answer: true },
                ],
            };

            let result_json = serde_json::to_string(&result).unwrap();

            // Schedule the delayed broadcast
            ctx.run_later(std::time::Duration::from_secs(10), move |_, _ctx| {
                println!("⏰ Sending result data to players after 10s");
                for player in &players {
                    player.do_send(PlayerText(result_json.clone()));
                }
            });
        }
    }
}


// ====== App State ======
struct AppState {
    rooms: Mutex<HashMap<String, Addr<Room>>>,
}

// ====== Route ======
async fn ws_route(
    req: HttpRequest,
    stream: web::Payload,
    data: web::Data<AppState>,
    path: web::Path<(String, String)>, // (session_id, role)
) -> Result<HttpResponse, Error> {
    let (session_id, role) = path.into_inner();
    let mut rooms = data.rooms.lock().unwrap();

    let room = rooms
        .entry(session_id.clone())
        .or_insert_with(|| Room::new().start())
        .clone();

    match role.as_str() {
        "manager" => actix_web_actors::ws::start(ManagerSession { room }, &req, stream),
        "player" => actix_web_actors::ws::start(PlayerSession { room }, &req, stream),
        _ => Ok(HttpResponse::BadRequest().body("role must be 'manager' or 'player'")),
    }
}

// ====== Main ======
#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let data = web::Data::new(AppState {
        rooms: Mutex::new(HashMap::new()),
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
