# WebSocket E2E Runbook (Manual Repro)

پیش‌نیاز:
- Redis بالا باشد (`docker compose up -d redis` در ریشه پروژه)
- Rust toolchain نصب باشد.

## 1) ساخت facade
```bash
cd /workspace/ProSlides/backend/srvs/facade
cargo build
```

## 2) اجرای mock API و facade در tmux (سه پنجره)
```bash
tmux new-session -d -s proslides-e2e

# Pane 1: mock API (پورت تصادفی با 18000 اینجا ثابت شده)
tmux send-keys -t proslides-e2e:0.0 'python /workspace/ProSlides/backend/srvs/facade/tests/mock_api_server.py --port 18000' C-m

# Pane 2: facade
tmux split-window -h -t proslides-e2e:0
tmux send-keys -t proslides-e2e:0.1 'cd /workspace/ProSlides/backend/srvs/facade && DJANGO_API_BASE_URL=http://127.0.0.1:18000/api target/debug/facade' C-m

# Pane 3: E2E test run
tmux split-window -v -t proslides-e2e:0.1
tmux send-keys -t proslides-e2e:0.2 'cd /workspace/ProSlides/backend/srvs/facade && cargo test --profile e2e-ci --tests -- --nocapture' C-m

# attach
tmux attach -t proslides-e2e
```

## 3) سناریوهای تحت پوشش
- manager start + player join + answer + leaderboard
- manager disconnect و reconnect وسط session
- player disconnect (abandon) و join مجدد
- start مجدد و اطمینان از عدم ارسال duplicate finalize (reset timer/state)


## 4) اجرای مستقیم تست lifecycle (اختیاری)
```bash
cd /workspace/ProSlides/backend/srvs/facade
cargo test --profile e2e-ci --test presentation_lifecycle_e2e -- --nocapture
```
