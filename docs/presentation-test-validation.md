# گزارش تست دقیق فرایند پرزنتیشن

تاریخ اجرا: 2026-02-12

## هدف
اعتبارسنجی حرفه‌ای و واقع‌گرایانه‌ی فرایند پرزنتیشن از سه زاویه:
1. سلامت Rust Facade (build/test)
2. سلامت APIهای Django مرتبط با presentation/export/player-session
3. سلامت frontend presentation build/lint

## نتایج اجرایی

### 1) Rust Facade
- دستور: `cargo test --manifest-path backend/srvs/facade/Cargo.toml`
- نتیجه: ✅ Pass
- جزئیات:
  - پروژه facade کامل build شد.
  - تست‌های تعریف‌شده در facade برابر 0 بود (`running 0 tests`) و خطای کامپایل/لینک وجود نداشت.

### 2) Backend API (Django) — تست‌های مرتبط با presentation flow
- ابتدا تلاش مستقیم با `pytest` به خطای dependency خورد (`ModuleNotFoundError: rest_framework`).
- محیط dependency با `uv sync` همگام شد.
- سپس با `PYTHONPATH` صحیح، مجموعه تست‌های هدفمند اجرا شد.

دستور موفق:
`PYTHONPATH=/workspace/ProSlides uv run pytest \
backend/srvs/office/tests/test_export_api.py \
backend/srvs/office/tests/test_export_content_and_order.py \
backend/srvs/office/tests/test_resolve_access_code.py \
backend/srvs/office/tests/test_player_sessions_api.py \
backend/srvs/office/tests/test_quiz_reset_result.py`

- نتیجه: ✅ Pass (13 passed)
- پوشش این تست‌ها:
  - export quiz/slides
  - حفظ ترتیب اسلایدها و leaderboard insertion
  - resolve access code
  - player session APIs
  - reset result و پاک‌سازی leaderboard/participants/votes

### 3) Frontend (Presentation Build Health)
- دستور: `npm --prefix frontend run lint`
- نتیجه: ✅ Pass

- دستور: `npm --prefix frontend run build`
- نتیجه: ✅ Pass
- نکته:
  - build production موفق بود.
  - هشدار chunk-size برای فایل بزرگ‌تر از 500kB مشاهده شد (هشدار performance، نه خطای functional).

## جمع‌بندی فنی
- از نظر **سلامت build و تست‌های backend/frontend** وضعیت خوب است.
- مسیرهای API مرتبط با presentation/export/player-session که برای facade حیاتی هستند تست و پاس شدند.
- با این حال برای «واقع‌گرایی کامل سروری» پیشنهاد می‌شود در CI یک سناریوی E2E websocket اضافه شود که manager/player واقعی را روی facade در حال اجرا شبیه‌سازی کند (join/start/next/leaderboard/reconnect).

## پیشنهاد مرحله بعد (برای اطمینان production-level)
1. اضافه‌کردن تست E2E برای facade websocket با mock Django export/results endpoints.
2. سناریوی reconnect برای player و late-join در وسط flow.
3. سناریوی load حداقلی (مثلاً 50-100 player bot) برای اندازه‌گیری latency در transitionها.
