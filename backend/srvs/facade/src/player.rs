use crate::models::{
    OptionItem, OptionResult, PlayerAnswer, PlayerInfo, PlayerOk, PlayerSession, PlayerText,
    Question, QuestionResult, QuizQuestion, Slide, RegisterPlayer, SendPlayerList,
    UnregisterPlayer,
};
use crate::utils::{get_slide_index, load_quiz_setup};
use actix::*;
use actix_web_actors::ws;
use redis::AsyncCommands;
use serde_json::json;
use serde_json::Value;
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

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

fn build_question_payload(slide: &Slide) -> Option<(Question, QuizQuestion)> {
    let quiz_question = slide.question.as_ref()?.clone();

    let mut answer_nums = 0;
    let options: Vec<OptionItem> = quiz_question
        .options
        .iter()
        .map(|opt| {
            if opt.is_correct {
                answer_nums += 1;
            }
            OptionItem {
                option_id: opt.option_id,
                option_text: opt.text.clone(),
                image: opt.image_url.clone(),
            }
        })
        .collect();

    let question = Question {
        r#type: 2,
        question_id: quiz_question.question_id,
        question_text: quiz_question.text.clone().unwrap_or_default(),
        question_time: quiz_question.time_limit,
        max_point: quiz_question.max_point,
        min_point: quiz_question.min_point,
        has_multiple: answer_nums > 1,
        options,
    };

    Some((question, quiz_question))
}

async fn load_leaderboard_from_redis(con: &mut crate::models::RedisPool, session_id: &str) -> Option<Vec<Value>> {
    let pattern = format!("player:{session_id}:*");
    let player_keys: Vec<String> = con.keys(&pattern).await.ok()?;
    let player_jsons: Vec<Option<String>> = if player_keys.is_empty() {
        vec![]
    } else {
        redis::cmd("MGET")
            .arg(&player_keys)
            .query_async(con)
            .await
            .ok()?
    };

    let mut dict_players: HashMap<String, Value> = HashMap::with_capacity(player_jsons.len());
    for player_json in player_jsons.into_iter().flatten() {
        if let Ok(pdata) = serde_json::from_str::<Value>(&player_json) {
            let user_id = pdata
                .get("user_id")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            dict_players.insert(user_id, pdata);
        }
    }

    let key = format!("leaderboard:{session_id}");
    let raw: Vec<(String, f64)> = con.zrevrange_withscores(&key, 0, -1).await.ok()?;

    let mut rank = 0;
    let leaderboard: Vec<Value> = raw
        .into_iter()
        .filter_map(|(player_id, score)| {
            let normalized_id = player_id.trim_matches('"').to_string();
            dict_players.get(&normalized_id).map(|player| {
                rank += 1;
                json!({
                    "user_id": normalized_id,
                    "name": player["name"],
                    "character": player["character"],
                    "rank": rank,
                    "total_points": score,
                    "new_points": player["new_points"],
                })
            })
        })
        .collect();

    Some(leaderboard)
}

async fn sync_player_state_on_reconnect(
    con: &mut crate::models::RedisPool,
    session_id: &str,
    player_addr: Addr<PlayerSession>,
) {
    let setup = match load_quiz_setup(session_id, con).await {
        Some(s) => s,
        None => return,
    };
    let slide_index = get_slide_index(con, session_id).await;
    if slide_index < 0 || slide_index as usize >= setup.slides.len() {
        return;
    }
    let slide = &setup.slides[slide_index as usize];

    match slide.slide_type {
        1 => {
            let (question, quiz_question) = match build_question_payload(slide) {
                Some(payload) => payload,
                None => return,
            };
            let run_id_key = format!("quiz:{}:run_id", session_id);
            let run_id: u64 = con.get(&run_id_key).await.unwrap_or(0);
            let mut question_value = match serde_json::to_value(&question) {
                Ok(v) => v,
                Err(_) => return,
            };
            if let Some(obj) = question_value.as_object_mut() {
                obj.insert("run_id".to_string(), json!(run_id));
            }
            player_addr.do_send(PlayerText(question_value.to_string()));

            let active_key = format!("question:{}:active", session_id);
            let active_marker: Option<String> = con.get(&active_key).await.ok();
            let active_for_current = active_marker
                .as_ref()
                .map(|marker| marker.starts_with(&format!("{}:", question.question_id)))
                .unwrap_or(false);
            if active_for_current {
                return;
            }

            let options: Vec<OptionResult> = quiz_question
                .options
                .iter()
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
            if let Ok(result_json) = serde_json::to_string(&result) {
                player_addr.do_send(PlayerText(result_json));
            }
        }
        2 => {
            if let Ok(str_json) = serde_json::to_string(slide) {
                player_addr.do_send(PlayerText(str_json));
            }
        }
        3 => {
            if let Some(leaderboard) = load_leaderboard_from_redis(con, session_id).await {
                let payload = json!({
                    "type": 11,
                    "results": leaderboard,
                });
                player_addr.do_send(PlayerText(payload.to_string()));
            }
        }
        _ => {}
    }
}

impl Actor for PlayerSession {
    type Context = ws::WebsocketContext<Self>;
    fn started(&mut self, ctx: &mut Self::Context) {
        // Start heartbeat
        self.hb(ctx);
        self.room.do_send(RegisterPlayer(ctx.address()));

        let session_id = self.session_id.clone();
        let mut con = self.redis_pool.clone();
        let player_addr = ctx.address();
        actix_rt::spawn(async move {
            sync_player_state_on_reconnect(&mut con, &session_id, player_addr).await;
        });
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
        } else if let Ok(ws::Message::Pong(_)) = msg {
            self.hb = Instant::now();
        } else if let Ok(ws::Message::Text(text)) = msg {
            if let Ok(player_info) = serde_json::from_str::<PlayerInfo>(&text) {
                if player_info.r#type == 6 {
                    // Player registration
                    let name = player_info.name.clone();
                    let character = player_info.character.clone();
                    self.name = Some(name.clone());
                    self.character = Some(character.clone());
                    self.registered_user_id = Some(self.id.to_string());
                    let mut con = self.redis_pool.clone();

                    // Generate a unique ID
                    let user_id = self
                        .registered_user_id
                        .clone()
                        .unwrap_or_else(|| self.id.to_string());
                    let player_user_id = user_id.clone();

                    // Store player info in Redis
                    let player_json = json!({
                        "user_id": user_id.clone(),
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
                        "user_id": user_id.clone(),
                    });
                    let user_data = json!({
                        "name": name,
                        "character": character,
                        "user_id": user_id.clone(),
                    });
                    let session_id = self.session_id.clone();

                    // Use pipeline for atomic batch operations
                    actix_rt::spawn(async move {
                        let player_key = format!("player:{}:{}", session_id, player_user_id);
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
                if answer.r#type == 4 {
                    // Submit Question
                    let session_id = self.session_id.clone();
                    let answer_user_id = answer.user_id.trim().to_string();
                    if let Some(registered_user_id) = &self.registered_user_id {
                        if !answer_user_id.is_empty() && answer_user_id != *registered_user_id {
                            println!(
                                "⚠️ Ignoring answer due to user_id mismatch (registered={}, payload={})",
                                registered_user_id, answer_user_id
                            );
                            return;
                        }
                    }
                    let user_id = if !answer_user_id.is_empty() {
                        answer_user_id
                    } else if let Some(registered_user_id) = &self.registered_user_id {
                        registered_user_id.clone()
                    } else {
                        self.id.to_string()
                    };
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
                            },
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
                                .await
                            {
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

                        let current_run_id = qmeta["run_id"].as_u64().unwrap_or(0);
                        if let Some(answer_run_id) = answer_clone.run_id {
                            if answer_run_id != current_run_id {
                                println!(
                                    "⚠️ Ignoring stale answer due to run_id mismatch (got {}, expected {})",
                                    answer_run_id, current_run_id
                                );
                                return;
                            }
                        } else {
                            println!(
                                "⚠️ Missing run_id in answer for user {} (session {}, question {}, expected run {})",
                                user_id, session_id, answer.question_id, current_run_id
                            );
                        }

                        let question_time = qmeta["question_time"].as_f64().unwrap_or(0.0);
                        let max_point = qmeta["max_point"].as_f64().unwrap_or(0.0);
                        let min_point = qmeta["min_point"].as_f64().unwrap_or(0.0);

                        // Build options result
                        let options: Vec<OptionResult> = question
                            .options
                            .iter()
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
                            if i < result.options_result.len()
                                && result.options_result[i].option_id == ans_opt.option_id
                            {
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

                        // Idempotency guard: each player can submit once per (session, run, question).
                        let submit_once_key = format!(
                            "submitted:{}:{}:{}:{}",
                            session_id, current_run_id, answer.question_id, user_id
                        );
                        let submit_ttl = (question_time.ceil() as u64).saturating_add(3600);
                        let submit_once_ok: Option<String> = redis::cmd("SET")
                            .arg(&submit_once_key)
                            .arg("1")
                            .arg("NX")
                            .arg("EX")
                            .arg(submit_ttl)
                            .query_async(&mut con)
                            .await
                            .ok();
                        if submit_once_ok.is_none() {
                            println!(
                                "⚠️ Ignoring duplicate answer (session={}, run_id={}, question_id={}, user_id={})",
                                session_id, current_run_id, answer.question_id, user_id
                            );
                            return;
                        }

                        let elapsed = submit_time.min(question_time);
                        let ratio = 1.0 - (elapsed / question_time);
                        let score = ratio * (max_point - min_point) + min_point;
                        let new_points = slope * score;

                        // Get player data and update in one pipeline
                        let pkey = format!("player:{session_id}:{user_id}");
                        let player_str: Option<String> = con.get(&pkey).await.unwrap_or(None);
                        let player_str = match player_str {
                            Some(value) => value,
                            None => {
                                println!(
                                    "⚠️ Ignoring answer for unknown user_id {} in session {}",
                                    user_id, session_id
                                );
                                return;
                            }
                        };
                        let mut player: serde_json::Value =
                            serde_json::from_str(&player_str).unwrap_or(json!({}));

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
