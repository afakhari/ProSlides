# بررسی عمیق رگرسیون پرزنتیشن (۱۵ کامیت اخیر)

## نتیجه نهایی
مظنون اصلی همچنان کامیت `fd10893` با عنوان:
`Sync presentation flow and fix manager/player desync`
است؛ چون دقیقاً همان‌جا منطق Rust مربوط به همگام‌سازی پلیر جدید با state جاری دست‌کاری شده و ارسال `last_question` هنگام `RegisterPlayer` اضافه شده است.

---

## 1) اسکوپ بررسی
در ۱۵ کامیت اخیر، فقط **۲ کامیت** شامل تغییرات Rust بوده‌اند:

1. `aee0f89` — `Fix manager leaderboard flow and UI text`
2. `fd10893` — `Sync presentation flow and fix manager/player desync`

باقی کامیت‌ها یا merge بوده‌اند یا فقط روی frontend اثر داشته‌اند.

---

## 2) تمام تغییرات Rust در ۱۵ کامیت اخیر

### Commit: `aee0f89`
فایل‌های Rust تغییرکرده:
- `backend/srvs/facade/src/manager.rs`
- `backend/srvs/facade/src/utils.rs`

خلاصه تغییرات:
- اضافه شدن `QuizQuestion` به imports و refactor بزرگ در `manager.rs`.
- اضافه شدن helper جدید `build_question_payload` برای تولید payload سوال از روی `Slide`.
- اضافه شدن helper جدید `finalize_question` برای:
  - اعتبارسنجی marker فعال سوال (`question:{session}:active`)
  - محاسبه نتایج گزینه‌ها
  - ارسال نتیجه به manager/player
  - ارسال leaderboard
  - ثبت نتیجه در API (`post_options_result`)
- در `utils.rs`، کلید `question:{session_id}:active` هم به cleanup اضافه شد.

ارزیابی ریسک:
- این کامیت عمدتاً refactor و ایمن‌سازی flow پایان سوال است.
- تغییراتش بیشتر روی lifecycle سوال/leaderboard اثر می‌گذارد و به‌صورت مستقیم منطق ارسال state به **پلیر تازه‌وارد** را تغییر نمی‌دهد.

---

### Commit: `fd10893`
فایل‌های Rust تغییرکرده:
- `backend/srvs/facade/src/main.rs`
- `backend/srvs/facade/src/manager.rs`
- `backend/srvs/facade/src/utils.rs`

خلاصه تغییرات:
- در `main.rs` داخل `RegisterPlayer`:
  - پلیر تازه ثبت می‌شود
  - اگر `last_question` موجود باشد، همان payload برای پلیر جدید فوراً ارسال می‌شود.
- در `manager.rs`:
  - اکشن جدید `start` کنار `next` اضافه شد.
  - هنگام `start`، state ران سوالات reset می‌شود (`reset_quiz_run_state`) و slide index روی `-1` قرار می‌گیرد.
  - هنگام ارسال سوال، علاوه بر broadcast به player، همان payload برای manager هم ارسال می‌شود.
- در `utils.rs`:
  - تابع جدید `reset_quiz_run_state` اضافه شده تا keyهای اجرایی سوال/leaderboard/new_points پاک شوند.

ارزیابی ریسک:
- بخش `RegisterPlayer` در `main.rs` ریسک مستقیم desync دارد: چون `last_question` فقط آخرین سوال را نگه می‌دارد، نه «اسلاید جاری واقعی». در نتیجه اگر منیجر روی content/leaderboard باشد ولی `last_question` از قبل مقدار داشته باشد، پلیر جدید سوال قدیمی می‌بیند.

---

## 3) شواهد کد فعلی که با باگ شما منطبق است

- `Room` فقط یک state به نام `last_question` نگه می‌دارد که با `NewQuestion` ست می‌شود.
- هنگام `RegisterPlayer`، در صورت وجود `last_question` همان payload به پلیر push می‌شود.

این یعنی state بازپخش‌شده برای پلیر جدید، «state سوال آخر» است نه «state اسلاید فعلی پرزنتیشن».

---

## 4) چرا دقیقاً مشکل "اختلاف اسلاید manager/player" رخ می‌دهد؟

سناریوی نمونه:
1. منیجر سوال شماره N را رد کرده و وارد اسلاید content یا leaderboard می‌شود.
2. `last_question` هنوز payload سوال N است.
3. پلیر reconnect/join می‌کند.
4. `RegisterPlayer` برای او `last_question` را می‌فرستد.
5. پلیر سوال N را می‌بیند ولی منیجر روی اسلاید دیگری است.

نتیجه: desync ظاهری و واقعی بین manager/player.

---

## 5) جمع‌بندی نهایی مظنون

- از بین کل ۱۵ کامیت اخیر، با توجه به تغییرات Rust، **محتمل‌ترین منشأ رگرسیون** همان `fd10893` است.
- دلیل فنی: اضافه شدن replay مستقیم `last_question` برای پلیر جدید بدون درنظر گرفتن نوع/ایندکس اسلاید جاری.

---

## 6) پیشنهاد اصلاح دقیق

برای رفع ریشه‌ای:
- به‌جای replay کردن `last_question` در `RegisterPlayer`، باید state canonical جاری session replay شود:
  - slide index جاری
  - slide type جاری (question/content/leaderboard)
  - payload متناظر همان slide
- اگر نگه‌داری state در `Room` انجام می‌شود، ساختار state باید کامل باشد (نه فقط question).
- ترجیحاً منبع حقیقت current slide از Redis/session-state خوانده شود تا manager/player همیشه از یک مرجع state بگیرند.
