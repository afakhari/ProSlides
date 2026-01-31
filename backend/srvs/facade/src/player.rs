use actix::*;
use actix_web_actors::ws;
use redis::AsyncCommands;
use serde_json::json;
use std::time::{SystemTime, UNIX_EPOCH};
use crate::utils::{
    get_slide_index, load_quiz_setup
};
use crate::models::{
    OptionResult, PlayerAnswer, PlayerInfo, PlayerOk, PlayerSession, PlayerText, QuestionResult, RegisterPlayer, SendPlayerList, UnregisterPlayer
};

use std::time::{Duration, Instant};

// Heartbeat interval and timeout
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
const CLIENT_TIMEOUT: Duration = Duration::from_secs(30);

// ...existing code...

impl PlayerSession {
    /// Sends ping to client every HEARTBEAT_INTERVAL seconds.
    fn hb(&self, ctx: &mut ws::WebsocketContext<Self>) {
        ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
            if Instant::now().duration_since(act.hb) > CLIENT_TIMEOUT {
                println!("⚠️ Player heartbeat failed, disconnecting!");
                act.room.do_send(UnregisterPlayer(ctx.address()));
                ctx.stop();
                return;
            }
            ctx.ping(b"");
        });
    }
}


impl Actor for PlayerSession {
    type Context = ws::WebsocketContext<Self>;
    fn started(&mut self, ctx: &mut Self::Context) {
        // Start heartbeat
        self.hb(ctx);
        self.room.do_send(RegisterPlayer(ctx.address()));
    }

    fn stopped(&mut self, ctx: &mut Self::Context) {
        self.room.do_send(UnregisterPlayer(ctx.address()));
    }
}


impl Handler<PlayerText> for PlayerSession {
    type Result = ();

    fn handle(&mut self, msg: PlayerText, ctx: &mut Self::Context) {
        // Broadcasted question JSON received
        ctx.text(msg.0.clone());

        // Automatically send "ok" back to manager
        if let Ok(player_info) = serde_json::from_str::<PlayerInfo>(&msg.0) {
            if player_info.r#type == 6 { // Player registration

            }
        }
        self.room.do_send(PlayerOk(ctx.address()));
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for PlayerSession {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        if let Ok(ws::Message::Ping(msg)) = msg {
            self.hb = Instant::now();
            ctx.pong(&msg);
        }
        else if let Ok(ws::Message::Pong(_)) = msg {
            self.hb = Instant::now();
        }
        else if let Ok(ws::Message::Text(text)) = msg {
            if let Ok(player_info) = serde_json::from_str::<PlayerInfo>(&text) {
                if player_info.r#type == 6 { // Player registration
                    let name = player_info.name.clone();
                    let character = player_info.character.clone();
                    self.name = Some(name.clone());
                    self.character = Some(character.clone());
                    let mut con = self.redis_pool.clone();

                    // Generate a unique ID
                    let user_id = self.id.to_string();

                    // Store player info in Redis
                    let player_json = json!({
                        "user_id": user_id,
                        "name": name,
                        "character": character,
                        "total_points": 0,
                        "new_points": 0
                    });

                    let redis_data = player_json.to_string();
                    let confirmation = json!({
                        "type": 10,
                        "name": name,
                        "character": character,
                        "user_id": user_id,
                    });
                    let user_data = json!({
                        "name": name,
                        "character": character,
                        "user_id": user_id,
                    });
                    let session_id = self.session_id.clone();

                    // Use pipeline for atomic batch operations
                    actix_rt::spawn(async move {
                        let player_key = format!("player:{}:{}", session_id, user_id);
                        let session_key = format!("players:{}", session_id);

                        let mut pipe = redis::pipe();
                        pipe.atomic()
                            .set(&player_key, &redis_data)
                            .sadd(&session_key, &player_key);
                        
                        let _: Result<(), _> = pipe.query_async(&mut con).await;
                    });

                    // Notify room to send updated list to manager
                    self.room.do_send(SendPlayerList { 
                        session_id: self.session_id.clone(),
                        new_player: user_data,
                    });

                    // Send confirmation back to player
                    ctx.text(confirmation.to_string());
                    println!("✅ Registered player: {:?}", confirmation);
                    return;
                }
            }

            // Other message handling (answers, ok, etc.)
            if text == "ok" {
                // self.room.do_send(crate::PlayerOk(ctx.address()));
            } else if let Ok(answer) = serde_json::from_str::<PlayerAnswer>(&text) {
                if answer.r#type == 4 { // Submit Question
                    let session_id = self.session_id.clone();
                    let user_id = self.id.to_string();
                    let answer_clone = answer.clone();
                    let mut con = self.redis_pool.clone();
                    let existing_setup = self.quiz_setup.clone();
                    
                    actix_rt::spawn(async move {
                        // Load quiz setup if needed
                        let setup_quiz = match existing_setup {
                            Some(s) => s,
                            None => match load_quiz_setup(&session_id, &mut con).await {
                                Some(s) => s,
                                None => {
                                    println!("⚠️ Failed to load quiz setup");
                                    return;
                                }
                            }
                        };
                        
                        let slide_index = get_slide_index(&mut con, &session_id).await;
                        if slide_index < 0 || slide_index as usize >= setup_quiz.slides.len() {
                            println!("⚠️ Invalid slide index: {}", slide_index);
                            return;
                        }
                        
                        let slide = &setup_quiz.slides[slide_index as usize];
                        let question = match &slide.question {
                            Some(q) => q,
                            None => {
                                println!("⚠️ No question on slide");
                                return;
                            }
                        };

                        let qkey = format!("question:{}:{}", session_id, answer.question_id);

                        // Batch fetch meta and start time
                        let meta_key = format!("{qkey}:meta");
                        let start_key = format!("{qkey}:start");
                        
                        let (qmeta_str, start_time): (Option<String>, Option<f64>) = 
                            match redis::pipe()
                                .get(&meta_key)
                                .get(&start_key)
                                .query_async(&mut con)
                                .await {
                                Ok(r) => r,
                                Err(_) => {
                                    println!("⚠️ Failed to fetch question data from Redis");
                                    return;
                                }
                            };

                        let qmeta_str = match qmeta_str {
                            Some(s) => s,
                            None => {
                                println!("⚠️ Missing question meta key in Redis: {}", meta_key);
                                return;
                            }
                        };
                        
                        let start_time = match start_time {
                            Some(t) => t,
                            None => {
                                println!("⚠️ Missing question start time in Redis: {}", start_key);
                                return;
                            }
                        };

                        let qmeta: serde_json::Value = match serde_json::from_str(&qmeta_str) {
                            Ok(v) => v,
                            Err(_) => {
                                println!("⚠️ Invalid question meta JSON");
                                return;
                            }
                        };

                        let question_time = qmeta["question_time"].as_f64().unwrap_or(0.0);
                        let max_point = qmeta["max_point"].as_f64().unwrap_or(0.0);
                        let min_point = qmeta["min_point"].as_f64().unwrap_or(0.0);

                        // Build options result
                        let options: Vec<OptionResult> = question.options.iter()
                            .map(|opt| OptionResult { 
                                option_id: opt.option_id, 
                                answer: opt.is_correct,
                            })
                            .collect();
                        
                        let result = QuestionResult {
                            r#type: 3,
                            question_id: question.question_id,
                            options_result: options,
                        };

                        // Calculate score
                        let mut correct_picked_nums: i16 = 0;
                        let mut total_corrects: u8 = 0;
                        
                        for (i, ans_opt) in answer_clone.options_result.iter().enumerate() {
                            if i < result.options_result.len() && 
                               result.options_result[i].option_id == ans_opt.option_id {
                                if result.options_result[i].answer {
                                    total_corrects += 1;
                                    if ans_opt.picked {
                                        correct_picked_nums += 1;
                                    }
                                } else if ans_opt.picked {
                                    correct_picked_nums -= 1;
                                }
                            }
                        }
                        
                        correct_picked_nums = correct_picked_nums.max(0);
                        let slope: f64 = if total_corrects > 0 {
                            correct_picked_nums as f64 / total_corrects as f64
                        } else {
                            0.0
                        };

                        let now = SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .expect("Time went backwards")
                            .as_secs_f64();

                        let submit_time = now - start_time;

                        if question_time <= 0.0 {
                            println!("❌ Invalid question_time: {}", question_time);
                            return;
                        }

                        let elapsed = submit_time.min(question_time);
                        let ratio = 1.0 - (elapsed / question_time);
                        let score = ratio * (max_point - min_point) + min_point;
                        let new_points = slope * score;

                        // Get player data and update in one pipeline
                        let pkey = format!("player:{session_id}:{user_id}");
                        let player_str: Option<String> = con.get(&pkey).await.unwrap_or(None);
                        
                        let mut player: serde_json::Value = match player_str {
                            Some(s) => serde_json::from_str(&s).unwrap_or(json!({})),
                            None => json!({})
                        };

                        let old_total = player["total_points"].as_f64().unwrap_or(0.0);
                        player["total_points"] = json!(old_total + new_points);
                        player["new_points"] = json!(new_points);

                        // Store submit and update scores using pipeline
                        let key = format!("leaderboard:{session_id}");
                        let new_points_key = format!("new_points:{session_id}");
                        let submit_key = format!("{qkey}:submits");
                        let submit_json = json!({
                            "user_id": user_id,
                            "submit_time": submit_time,
                            "picked": answer.options_result
                        });

                        let mut pipe = redis::pipe();
                        pipe.atomic()
                            .zincr(&key, &user_id, new_points)
                            .hset(&new_points_key, &user_id, new_points)
                            .set(&pkey, serde_json::to_string(&player).unwrap_or_default())
                            .rpush(&submit_key, submit_json.to_string());

                        // Add vote counts
                        for opt in &answer.options_result {
                            if opt.picked {
                                pipe.incr(format!("{qkey}:option:{}:count", opt.option_id), 1);
                            }
                        }

                        let _: Result<(), _> = pipe.query_async(&mut con).await;
                    });
                }
            } else {
                println!("⚠️ Unknown player message: {}", text);
            }
        }
    }
}
