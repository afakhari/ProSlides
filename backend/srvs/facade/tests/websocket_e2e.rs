use std::{
    collections::VecDeque,
    net::{TcpListener, TcpStream},
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex},
    time::Duration,
};

use actix_web::{App, HttpResponse, HttpServer, web};
use futures_util::{SinkExt, StreamExt};
use serde_json::{Value, json};
use tokio::time::{sleep, timeout};
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream, connect_async, tungstenite::Message};

#[derive(Clone)]
struct MockState {
    results_posts: Arc<Mutex<Vec<Value>>>,
    leaderboard_posts: Arc<Mutex<Vec<Value>>>,
}

struct ProcessGuard {
    child: Child,
}

impl Drop for ProcessGuard {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn redis_available() -> bool {
    TcpStream::connect_timeout(
        &"127.0.0.1:6379".parse().expect("valid socket addr"),
        Duration::from_millis(300),
    )
    .is_ok()
}

fn fixture_quiz_setup() -> Value {
    json!({
        "quiz_id": 100,
        "title": "E2E Quiz",
        "background": {"color": "#111", "image": ""},
        "music_url": Value::Null,
        "access_code": "1234",
        "slides": [
            {
                "slide_id": 2001,
                "slide_type": 1,
                "order": 1,
                "show_leaderboad_after": true,
                "question": {
                    "question_id": 9001,
                    "title": "Q1",
                    "text": "2+2?",
                    "question_type": "single",
                    "image_url": Value::Null,
                    "partial_scoring": false,
                    "time_limit": 1,
                    "max_point": 100.0,
                    "min_point": 10.0,
                    "faster_answers_more_points": true,
                    "options": [
                        {"option_id": 1, "text": "4", "is_correct": true, "votes": 0, "image_url": Value::Null},
                        {"option_id": 2, "text": "5", "is_correct": false, "votes": 0, "image_url": Value::Null}
                    ]
                },
                "leaderboard": []
            },
            {
                "slide_id": 2002,
                "slide_type": 3,
                "order": 2,
                "leaderboard": []
            }
        ]
    })
}

async fn export_handler() -> HttpResponse {
    HttpResponse::Ok().json(fixture_quiz_setup())
}

async fn leaderboard_handler(
    state: web::Data<MockState>,
    payload: web::Json<Value>,
) -> HttpResponse {
    state
        .leaderboard_posts
        .lock()
        .expect("leaderboard mutex poisoned")
        .push(payload.into_inner());
    HttpResponse::Ok().json(json!({"ok": true}))
}

async fn results_handler(state: web::Data<MockState>, payload: web::Json<Value>) -> HttpResponse {
    state
        .results_posts
        .lock()
        .expect("results mutex poisoned")
        .push(payload.into_inner());
    HttpResponse::Ok().json(json!({"ok": true}))
}

async fn start_mock_api_server() -> (String, MockState) {
    let state = MockState {
        results_posts: Arc::new(Mutex::new(Vec::new())),
        leaderboard_posts: Arc::new(Mutex::new(Vec::new())),
    };

    let listener = TcpListener::bind("127.0.0.1:0").expect("bind mock api listener");
    let addr = listener.local_addr().expect("mock api local addr");
    let state_data = web::Data::new(state.clone());

    let server = HttpServer::new(move || {
        App::new()
            .app_data(state_data.clone())
            .route(
                "/api/quizzes/{session_id}/export/",
                web::get().to(export_handler),
            )
            .route(
                "/api/quizzes/{session_id}/slides/{slide_id}/question/leaderboard/",
                web::post().to(leaderboard_handler),
            )
            .route(
                "/api/quizzes/{session_id}/slides/{slide_id}/question/results/",
                web::post().to(results_handler),
            )
    })
    .listen(listener)
    .expect("start mock api listener")
    .run();

    tokio::spawn(server);
    (format!("http://{}", addr), state)
}

fn resolve_facade_bin() -> String {
    if let Ok(bin) = std::env::var("CARGO_BIN_EXE_facade") {
        return bin;
    }

    let profile = std::env::var("PROFILE").unwrap_or_else(|_| "debug".to_string());
    let candidate = format!("target/{profile}/facade");
    if std::path::Path::new(&candidate).exists() {
        return candidate;
    }

    for fallback in ["target/e2e-ci/facade", "target/debug/facade"] {
        if std::path::Path::new(fallback).exists() {
            return fallback.to_string();
        }
    }

    panic!(
        "facade binary not found: set CARGO_BIN_EXE_facade or build with `cargo build --bin facade`"
    );
}

fn spawn_facade(mock_base: &str) -> ProcessGuard {
    let bin = resolve_facade_bin();
    let child = Command::new(bin)
        .env("DJANGO_API_BASE_URL", format!("{mock_base}/api"))
        .env("NO_PROXY", "127.0.0.1,localhost")
        .env("no_proxy", "127.0.0.1,localhost")
        .env_remove("HTTP_PROXY")
        .env_remove("HTTPS_PROXY")
        .env_remove("ALL_PROXY")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .expect("failed to start facade");

    ProcessGuard { child }
}

async fn wait_ws_ready() {
    for _ in 0..40 {
        if connect_async("ws://127.0.0.1:8080/ws/health/manager")
            .await
            .is_ok()
        {
            return;
        }
        sleep(Duration::from_millis(100)).await;
    }
    panic!("facade ws endpoint did not become ready");
}

type Ws = WebSocketStream<MaybeTlsStream<tokio::net::TcpStream>>;

async fn connect(role: &str, session: &str) -> Ws {
    let (ws, _) = connect_async(format!("ws://127.0.0.1:8080/ws/{session}/{role}"))
        .await
        .expect("connect websocket");
    ws
}

async fn send_json(ws: &mut Ws, value: Value) {
    ws.send(Message::Text(value.to_string().into()))
        .await
        .expect("send websocket text");
}

async fn recv_json(ws: &mut Ws, wait: Duration) -> Option<Value> {
    let fut = async {
        loop {
            match ws.next().await {
                Some(Ok(Message::Text(t))) => {
                    if let Ok(v) = serde_json::from_str::<Value>(&t) {
                        return Some(v);
                    }
                }
                Some(Ok(_)) => {}
                Some(Err(_)) | None => return None,
            }
        }
    };

    timeout(wait, fut).await.ok().flatten()
}

async fn recv_type(ws: &mut Ws, expected: i64, wait: Duration) -> Value {
    let start = tokio::time::Instant::now();
    let mut backlog = VecDeque::new();

    while start.elapsed() < wait {
        if let Some(v) = recv_json(ws, Duration::from_millis(300)).await {
            if v.get("type").and_then(Value::as_i64) == Some(expected) {
                return v;
            }
            backlog.push_back(v);
        }
    }

    panic!("expected type={expected}, got backlog={:?}", backlog);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn websocket_e2e_manager_player_resilience_and_restart() {
    if !redis_available() {
        eprintln!(
            "SKIP websocket_e2e_manager_player_resilience_and_restart: redis is not available on 127.0.0.1:6379"
        );
        return;
    }

    let (mock_base, mock_state) = start_mock_api_server().await;
    let _facade = spawn_facade(&mock_base);
    wait_ws_ready().await;

    let session = format!("e2e-{}", uuid::Uuid::new_v4());

    // Scenario 1: manager start, player join, answer, leaderboard.
    let mut manager = connect("manager", &session).await;
    let initial_users = recv_type(&mut manager, 7, Duration::from_secs(2)).await;
    assert_eq!(initial_users["users"], json!([]));

    let mut player = connect("player", &session).await;
    send_json(
        &mut player,
        json!({"type": 6, "name": "Ali", "character": "lion"}),
    )
    .await;

    let register_ack = recv_type(&mut player, 10, Duration::from_secs(2)).await;
    assert_eq!(register_ack["name"], "Ali");
    assert_eq!(register_ack["character"], "lion");

    let users_after_join = recv_type(&mut manager, 7, Duration::from_secs(2)).await;
    assert_eq!(users_after_join["users"][0]["name"], "Ali");
    assert_eq!(users_after_join["users"][0]["character"], "lion");

    send_json(&mut manager, json!({"type": 9, "action": "start"})).await;
    let manager_q = recv_type(&mut manager, 2, Duration::from_secs(3)).await;
    let player_q = recv_type(&mut player, 2, Duration::from_secs(3)).await;
    assert_eq!(manager_q["question_id"], player_q["question_id"]);
    assert_eq!(manager_q["type"], json!(2));
    assert_eq!(player_q["type"], json!(2));

    let qid = manager_q["question_id"]
        .as_u64()
        .expect("question id as u64");
    let uid = register_ack["user_id"]
        .as_str()
        .expect("registered user id as str");
    send_json(
        &mut player,
        json!({
            "type": 4,
            "question_id": qid,
            "user_id": uid,
            "submit_time": 0.1,
            "options_result": [
                {"option_id": 1, "picked": true},
                {"option_id": 2, "picked": false}
            ]
        }),
    )
    .await;

    let manager_results = recv_type(&mut manager, 8, Duration::from_secs(3)).await;
    assert_eq!(manager_results["question_id"], json!(qid));

    let player_answer_key = recv_type(&mut player, 3, Duration::from_secs(2)).await;
    assert_eq!(player_answer_key["question_id"], json!(qid));

    let manager_q_leaderboard = recv_type(&mut manager, 12, Duration::from_secs(3)).await;
    assert_eq!(manager_q_leaderboard["type"], json!(12));
    assert_eq!(manager_q_leaderboard["results"][0]["name"], "Ali");

    send_json(&mut manager, json!({"type": 9, "action": "next"})).await;
    let manager_lb_slide = recv_type(&mut manager, 1, Duration::from_secs(3)).await;
    let player_lb_slide = recv_type(&mut player, 11, Duration::from_secs(3)).await;
    assert_eq!(manager_lb_slide["type"], json!(1));
    assert_eq!(player_lb_slide["type"], json!(11));
    assert_eq!(manager_lb_slide["results"], player_lb_slide["results"]);

    // Scenario 2: manager disconnect and reconnect in-session.
    player.close(None).await.expect("close player ws");
    manager.close(None).await.expect("close manager ws");

    let mut manager2 = connect("manager", &session).await;
    let users_after_reconnect = recv_type(&mut manager2, 7, Duration::from_secs(2)).await;
    let users_after_reconnect = users_after_reconnect["users"]
        .as_array()
        .expect("users array");
    assert!(users_after_reconnect.len() <= 1);
    if let Some(user) = users_after_reconnect.first() {
        assert_eq!(user["name"], "Ali");
    }

    // Scenario 3: player abandon then rejoin.
    let mut player2 = connect("player", &session).await;
    send_json(
        &mut player2,
        json!({"type": 6, "name": "Ali-2", "character": "fox"}),
    )
    .await;

    let register_ack2 = recv_type(&mut player2, 10, Duration::from_secs(2)).await;
    assert_eq!(register_ack2["name"], "Ali-2");
    assert_eq!(register_ack2["character"], "fox");

    let users_after_rejoin = recv_type(&mut manager2, 7, Duration::from_secs(2)).await;
    assert!(
        users_after_rejoin["users"]
            .as_array()
            .expect("users array")
            .iter()
            .any(|u| u["name"] == "Ali-2" && u["character"] == "fox")
    );

    // Scenario 4: restart and verify timer/state reset (no stale finalize duplicate).
    send_json(&mut manager2, json!({"type": 9, "action": "start"})).await;
    let _ = recv_type(&mut manager2, 2, Duration::from_secs(2)).await;
    let _ = recv_type(&mut player2, 2, Duration::from_secs(2)).await;

    sleep(Duration::from_millis(200)).await;
    send_json(&mut manager2, json!({"type": 9, "action": "start"})).await;

    let restarted_manager_q = recv_type(&mut manager2, 2, Duration::from_secs(2)).await;
    let restarted_player_q = recv_type(&mut player2, 2, Duration::from_secs(2)).await;
    assert_eq!(
        restarted_manager_q["question_id"],
        restarted_player_q["question_id"]
    );

    let mut type8_count = 0;
    let mut type3_count = 0;
    let until = tokio::time::Instant::now() + Duration::from_secs(2);
    while tokio::time::Instant::now() < until {
        if let Some(v) = recv_json(&mut manager2, Duration::from_millis(250)).await {
            if v.get("type").and_then(Value::as_i64) == Some(8) {
                type8_count += 1;
            }
        }
        if let Some(v) = recv_json(&mut player2, Duration::from_millis(250)).await {
            if v.get("type").and_then(Value::as_i64) == Some(3) {
                type3_count += 1;
            }
        }
    }

    assert_eq!(
        type8_count, 1,
        "stale question timer produced duplicate type=8 events"
    );
    assert_eq!(
        type3_count, 1,
        "stale question timer produced duplicate type=3 events"
    );

    // Verify backend side effects posted to API.
    let results_posts = mock_state
        .results_posts
        .lock()
        .expect("results mutex")
        .clone();
    let leaderboard_posts = mock_state
        .leaderboard_posts
        .lock()
        .expect("leaderboard mutex")
        .clone();

    assert!(
        !results_posts.is_empty(),
        "expected at least one results POST"
    );
    assert!(
        !leaderboard_posts.is_empty(),
        "expected at least one leaderboard POST"
    );

    let first_results = &results_posts[0];
    assert!(
        first_results.get("options").is_some(),
        "results payload should contain options"
    );

    let first_leaderboard = &leaderboard_posts[0];
    assert!(
        first_leaderboard.get("leaderboard").is_some(),
        "leaderboard payload should contain leaderboard"
    );
}
