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
}

struct Guard {
    child: Child,
}
impl Drop for Guard {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn redis_available() -> bool {
    TcpStream::connect_timeout(
        &"127.0.0.1:6379".parse().unwrap(),
        Duration::from_millis(300),
    )
    .is_ok()
}

fn fixture() -> Value {
    json!({
        "quiz_id": 101,
        "title": "Lifecycle",
        "background": {"color":"#000","image":""},
        "music_url": Value::Null,
        "access_code": "1111",
        "slides": [{
            "slide_id": 3001,
            "slide_type": 1,
            "order": 1,
            "question": {
                "question_id": 9101,
                "title": "Q",
                "text": "x?",
                "question_type": "single",
                "image_url": Value::Null,
                "partial_scoring": false,
                "time_limit": 1,
                "max_point": 100.0,
                "min_point": 0.0,
                "faster_answers_more_points": true,
                "options": [
                    {"option_id": 1,"text":"A","is_correct": true,"votes":0,"image_url": Value::Null},
                    {"option_id": 2,"text":"B","is_correct": false,"votes":0,"image_url": Value::Null}
                ]
            },
            "leaderboard": []
        }]
    })
}

async fn export_handler() -> HttpResponse {
    HttpResponse::Ok().json(fixture())
}
async fn leaderboard_handler(_: web::Json<Value>) -> HttpResponse {
    HttpResponse::Ok().json(json!({"ok":true}))
}
async fn results_handler(state: web::Data<MockState>, payload: web::Json<Value>) -> HttpResponse {
    state
        .results_posts
        .lock()
        .unwrap()
        .push(payload.into_inner());
    HttpResponse::Ok().json(json!({"ok":true}))
}

async fn mock_server() -> (String, MockState) {
    let state = MockState {
        results_posts: Arc::new(Mutex::new(vec![])),
    };
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let data = web::Data::new(state.clone());
    let server = HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
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
    .unwrap()
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

fn spawn_facade(base: &str) -> Guard {
    let bin = resolve_facade_bin();
    let child = Command::new(bin)
        .env("DJANGO_API_BASE_URL", format!("{base}/api"))
        .env("NO_PROXY", "127.0.0.1,localhost")
        .env("no_proxy", "127.0.0.1,localhost")
        .env_remove("HTTP_PROXY")
        .env_remove("HTTPS_PROXY")
        .env_remove("ALL_PROXY")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    Guard { child }
}

type Ws = WebSocketStream<MaybeTlsStream<tokio::net::TcpStream>>;
async fn connect(role: &str, sid: &str) -> Ws {
    connect_async(format!("ws://127.0.0.1:8080/ws/{sid}/{role}"))
        .await
        .unwrap()
        .0
}
async fn send_json(ws: &mut Ws, v: Value) {
    ws.send(Message::Text(v.to_string().into())).await.unwrap();
}
async fn recv_json(ws: &mut Ws, wait: Duration) -> Option<Value> {
    timeout(wait, async {
        loop {
            match ws.next().await {
                Some(Ok(Message::Text(t))) => {
                    if let Ok(v) = serde_json::from_str::<Value>(&t) {
                        return Some(v);
                    }
                }
                Some(Ok(_)) => {}
                _ => return None,
            }
        }
    })
    .await
    .ok()
    .flatten()
}

async fn recv_started_and_question(ws: &mut Ws, wait: Duration) -> (Value, Value) {
    let deadline = tokio::time::Instant::now() + wait;
    let mut started: Option<Value> = None;
    let mut question: Option<Value> = None;
    let mut backlog = VecDeque::new();

    while tokio::time::Instant::now() < deadline {
        if let Some(v) = recv_json(ws, Duration::from_millis(300)).await {
            match v.get("type").and_then(Value::as_i64) {
                Some(14) => started = Some(v),
                Some(2) => question = Some(v),
                _ => backlog.push_back(v),
            }
            if started.is_some() && question.is_some() {
                return (started.unwrap(), question.unwrap());
            }
        }
    }

    panic!(
        "missing start/question pair; started={started:?}, question={question:?}, backlog={backlog:?}"
    )
}

async fn recv_type(ws: &mut Ws, expected: i64, wait: Duration) -> Value {
    let t0 = tokio::time::Instant::now();
    let mut backlog = VecDeque::new();
    while t0.elapsed() < wait {
        if let Some(v) = recv_json(ws, Duration::from_millis(300)).await {
            if v.get("type").and_then(Value::as_i64) == Some(expected) {
                return v;
            }
            backlog.push_back(v);
        }
    }
    panic!("missing type={expected}, backlog={backlog:?}")
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn presentation_lifecycle_run_id_and_replay_rules() {
    if !redis_available() {
        eprintln!("SKIP presentation_lifecycle_run_id_and_replay_rules: redis unavailable");
        return;
    }

    let (base, state) = mock_server().await;
    let _facade = spawn_facade(&base);

    for _ in 0..40 {
        if connect_async("ws://127.0.0.1:8080/ws/health/manager")
            .await
            .is_ok()
        {
            break;
        }
        sleep(Duration::from_millis(100)).await;
    }

    let sid = format!("life-{}", uuid::Uuid::new_v4());

    // 1) Player joins before start => waiting only (no replay/session payload).
    let mut p1 = connect("player", &sid).await;
    send_json(&mut p1, json!({"type":6,"name":"p1","character":"c1"})).await;
    let _ack1 = recv_type(&mut p1, 10, Duration::from_secs(2)).await;
    assert!(
        recv_json(&mut p1, Duration::from_millis(700))
            .await
            .is_none()
    );

    // manager connect
    let mut m = connect("manager", &sid).await;
    let _users0 = recv_type(&mut m, 7, Duration::from_secs(2)).await;

    // 2) Manager start => session_started => next payload accepted.
    send_json(&mut m, json!({"type":9,"action":"start"})).await;
    let (started, q1) = recv_started_and_question(&mut p1, Duration::from_secs(3)).await;
    let run1 = started["run_id"].as_u64().unwrap();
    assert_eq!(started["event"], "session_started");
    assert_eq!(q1["run_id"], json!(run1));

    // flush/ack old + valid answers
    let uid1 = _ack1["user_id"].as_str().unwrap();
    send_json(
        &mut p1,
        json!({"type":4,"question_id":9101,"user_id":uid1,"run_id":run1,"submit_time":0.1,
        "options_result":[{"option_id":1,"picked":true},{"option_id":2,"picked":false}] }),
    )
    .await;

    // 6) Previous ignored safely
    send_json(&mut m, json!({"type":9,"action":"previous"})).await;
    assert!(
        recv_json(&mut p1, Duration::from_millis(500))
            .await
            .is_none()
    );

    // 3) Restart run => old run messages ignored (run_id mismatch)
    send_json(&mut m, json!({"type":9,"action":"start"})).await;
    let (started2, q2) = recv_started_and_question(&mut p1, Duration::from_secs(3)).await;
    let run2 = started2["run_id"].as_u64().unwrap();
    assert!(run2 > run1);
    assert_eq!(q2["run_id"], json!(run2));

    // stale answer from run1 should be ignored
    send_json(
        &mut p1,
        json!({"type":4,"question_id":9101,"user_id":uid1,"run_id":run1,"submit_time":0.2,
        "options_result":[{"option_id":1,"picked":true},{"option_id":2,"picked":false}] }),
    )
    .await;

    // fresh run2 accepted
    send_json(
        &mut p1,
        json!({"type":4,"question_id":9101,"user_id":uid1,"run_id":run2,"submit_time":0.2,
        "options_result":[{"option_id":1,"picked":true},{"option_id":2,"picked":false}] }),
    )
    .await;

    // 4) Late join => only fresh allowlisted replay
    let mut late = connect("player", &sid).await;
    send_json(&mut late, json!({"type":6,"name":"late","character":"c2"})).await;
    let _ack_late = recv_type(&mut late, 10, Duration::from_secs(2)).await;
    let replay = recv_json(&mut late, Duration::from_secs(2))
        .await
        .expect("late join should receive a replay payload");
    let replay_type = replay["type"].as_i64().unwrap_or_default();
    assert!(matches!(replay_type, 2 | 3));
    assert_eq!(replay["run_id"], json!(run2));

    // 5) Manager disconnect => Abandoned => player join does not replay; reconnect/start works
    m.close(None).await.unwrap();
    let mut p3 = connect("player", &sid).await;
    send_json(&mut p3, json!({"type":6,"name":"p3","character":"c3"})).await;
    let _ack3 = recv_type(&mut p3, 10, Duration::from_secs(2)).await;
    assert!(
        recv_json(&mut p3, Duration::from_millis(700))
            .await
            .is_none()
    );

    let mut m2 = connect("manager", &sid).await;
    let _usersr = recv_type(&mut m2, 7, Duration::from_secs(2)).await;
    send_json(&mut m2, json!({"type":9,"action":"start"})).await;
    let started3 = recv_type(&mut p3, 14, Duration::from_secs(2)).await;
    assert!(started3["run_id"].as_u64().unwrap() > run2);

    // ensure at least one accepted submission reached API
    sleep(Duration::from_secs(2)).await;
    assert!(!state.results_posts.lock().unwrap().is_empty());
}
