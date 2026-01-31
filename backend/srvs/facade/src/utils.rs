use crate::models::{
    QuizSetup,
    LeaderboardEntry,
    LeaderboardUpdate,
    RedisPool,
};
use redis::AsyncCommands;
use reqwest::Client;
use serde_json::json;

const API_TOKEN: &str = "Salam-Amin-Bidad1";

pub async fn save_quiz_setup(
    session_id: &str,
    setup: &QuizSetup,
    con: &mut RedisPool,
) -> redis::RedisResult<()> {
    let quiz_key = format!("quiz:{session_id}");
    let json = serde_json::to_string(setup).unwrap();
    con.set(quiz_key, json).await
}

pub async fn load_quiz_setup(
    session_id: &str,
    con: &mut RedisPool,
) -> Option<QuizSetup> {
    let key = format!("quiz:{session_id}");
    let data: Option<String> = con.get(key).await.ok()?;
    data.and_then(|json| serde_json::from_str(&json).ok())
}

pub async fn save_slide_index(
    con: &mut RedisPool,
    session_id: &str,
    index: i32,
) {
    let key = format!("quiz:{}:slide_index", session_id);
    let _: Result<(), _> = con.set(key, index).await;
}

pub async fn get_slide_index(
    con: &mut RedisPool,
    session_id: &str
) -> i32 {
    let key = format!("quiz:{}:slide_index", session_id);
    con.get::<_, i32>(key).await.unwrap_or(-1)
}

pub async fn get_quiz_setup(session_id: &str) -> Result<QuizSetup, Box<dyn std::error::Error>> {
    let url = format!("http://87.107.165.177:8000/api/quizzes/{}/export/", session_id);

    let client = Client::new();

    let response = client
        .get(&url)
        .header("X-Export-Token", API_TOKEN)        
        .send()
        .await?
        .error_for_status()?;

    let quiz_setup: QuizSetup = response.json().await?;

    Ok(quiz_setup)
}

pub async fn post_question_leaderboard(
    session_id: &str,
    slide_pk: u64,
    leaderboard: Vec<LeaderboardEntry>,
) -> anyhow::Result<()> {
    let url = format!(
        "http://87.107.165.177:8000/api/quizzes/{}/slides/{}/question/leaderboard/",
        session_id, slide_pk
    );

    let payload = LeaderboardUpdate { leaderboard };
    let client = reqwest::Client::new();

    let response = client
        .post(&url)
        .header("X-Export-Token", API_TOKEN)        
        .json(&payload)
        .send()
        .await?;
    
    let status = response.status();
    if !status.is_success() {
        let text = response.text().await?;
        anyhow::bail!("Failed to send leaderboard (HTTP {}): {}", status, text);
    }

    Ok(())
}

pub async fn post_options_result(
    session_id: &str,
    slide_id: u64,
    options_result: Vec<serde_json::Value>,
) -> anyhow::Result<()> {
    let url = format!(
        "http://87.107.165.177:8000/api/quizzes/{}/slides/{}/question/results/",
        session_id, slide_id
    );

    let client = reqwest::Client::new();
    let data = json!({ "options": options_result });

    let response = client
        .post(&url)
        .header("X-Export-Token", API_TOKEN)
        .json(&data)
        .send()
        .await?;
    
    let status = response.status();
    if !status.is_success() {
        let text = response.text().await?;
        anyhow::bail!("Failed to send options result (HTTP {}): {}", status, text);
    }

    Ok(())
}

pub async fn cleanup_quiz_redis(
    con: &mut RedisPool,
    session_id: &str,
) {
    // Collect all keys to delete in batches
    let patterns = [
        format!("player:{session_id}:*"),
        format!("question:{}:*:option:*:count", session_id),
        format!("question:{}:*:submits", session_id),
        format!("question:{}:*:start", session_id),
        format!("question:{}:*:meta", session_id),
    ];

    let mut all_keys: Vec<String> = Vec::new();
    
    for pattern in &patterns {
        if let Ok(keys) = con.keys::<_, Vec<String>>(pattern).await {
            all_keys.extend(keys);
        }
    }

    // Add static keys
    all_keys.push(format!("players:{}", session_id));
    all_keys.push(format!("leaderboard:{session_id}"));
    all_keys.push(format!("new_points:{session_id}"));

    // Delete all keys in a single pipeline
    if !all_keys.is_empty() {
        let mut pipe = redis::pipe();
        pipe.atomic();
        for key in &all_keys {
            pipe.del(key);
        }
        let _: Result<(), _> = pipe.query_async(con).await;
    }
}

pub async fn add_scores_batch(
    con: &mut RedisPool,
    session_id: &str,
    updates: Vec<LeaderboardEntry>,
) {
    if updates.is_empty() {
        return;
    }

    let key = format!("leaderboard:{session_id}");
    let new_points_key = format!("new_points:{session_id}");

    let mut pipe = redis::pipe();
    pipe.atomic();

    for update in updates {
        pipe.zincr(&key, &update.rust_session_id, update.score);
        pipe.hset(&new_points_key, &update.rust_session_id, update.score);
    }

    let _: Result<(), _> = pipe.query_async(con).await;
}