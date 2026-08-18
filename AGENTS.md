# ProSlides — سند راهبر توسعه

> این فایل منبع دائمی context پروژه برای انسان و عامل هوش مصنوعی است. پیش از هر
> تغییر کد، معماری یا زیرساخت، آن را کامل بخوانید. پس از هر تغییر مؤثر، بخش‌های
> وضعیت، مرحلهٔ بعدی و جدول تغییرات این فایل را با واقعیت repository هم‌راستا کنید.

## هدف محصول و ظرفیت

ProSlides یک پلتفرم ارائه و آزمون زنده شبیه Kahoot/AhaSlides است: Presentation
Builder، Quiz، Poll، Word Cloud، Q&A، گزارش و Live Session با participant، timer،
score و leaderboard.

تصمیم مالک محصول در **2026-08-18**: محصول از ابتدا برای ظرفیت بالا و رشد بلندمدت
طراحی می‌شود. هدف طراحی اولیه پشتیبانی از ۱۰٬۰۰۰ participant در یک live session و
قابلیت scale افقی برای رشد بعدی است. این هدف به معنای شروع با microserviceهای زیاد
نیست؛ اولویت عملیاتی همچنان سادگی، سرعت توسعه و قابلیت نگهداری است.

## تصمیم معماری رسمی

```text
React + TypeScript + Vite
  ├─ REST: identity, content, join, answer, manager action, snapshot
  └─ SSE: server-to-client live events
             │
Go modular monolith
  ├─ HTTP API + SSE gateway
  ├─ auth, quizzes, slides, reports, media
  ├─ live state machine, scoring, event fan-out, background jobs
  ├─ PostgreSQL: durable source of truth
  └─ Redis/Valkey: ephemeral delivery, presence, cache, rate limits
```

### اصول غیرقابل مذاکره

1. Backend جدید **Go modular monolith** است. از microservice، Kafka، RabbitMQ،
   NATS، ClickHouse، MongoDB و Kubernetes تا زمان وجود نیاز اندازه‌گیری‌شده اجتناب
   شود.
2. SSE فقط مسیر server-to-client است؛ join، answer و manager action با HTTP POST
   انجام می‌شوند. WebSocket فقط با نیاز واقعی دوطرفه و پرتکرار وارد شود.
3. PostgreSQL منبع حقیقت کاربران، محتوا، sessionها، پاسخ‌ها، score و report است.
   Redis هرگز منبع حقیقت دائمی پاسخ یا امتیاز نیست.
4. هر live session یک state machine، `state_version` افزایشی و زمان سروری دارد.
5. هر mutation باید `request_id` داشته باشد و idempotent باشد.
6. هر event قرارداد نام‌دار، نسخه‌دار و مستند دارد؛ پیام‌های عددی بدون قرارداد ممنوع.
7. هر تصمیم scale باید با metric و load test پشتیبانی شود.

## وضعیت فعلی repository

| بخش | واقعیت فعلی |
|---|---|
| Frontend | `apps/web`؛ React 19/Vite موجود و در حال مهاجرت تدریجی به TypeScript/SSE |
| Backend | `apps/api`؛ Go foundation با REST/SSE contract |
| Database | PostgreSQL 16 در Compose؛ migration اولیه موجود است |
| Realtime | SSE مقصد؛ implementation هنوز در Phase 2 است |
| Redis | Redis 7.4 در Compose برای foundation realtime |

کدهای Django، Rust، SQLite، static output و مستندات WebSocket از این branch حذف
شده‌اند؛ تاریخچهٔ آن‌ها در Git و branch `master` باقی می‌ماند. `apps/web` به‌عنوان
پایهٔ UI حفظ شده و وابستگی WebSocket آن باید در Phase 2 به SSE/HTTP منتقل شود.

## ساختار مقصد

```text
apps/api/
  cmd/api/                    # composition root
  internal/
    platform/                 # config, http, postgres, redis, observability
    identity/ quizzes/ slides/ reports/ media/
    live/                     # commands, state, scoring, sse, presence
  migrations/                 # immutable PostgreSQL SQL migrations
  openapi/                    # API and event contracts
  Dockerfile
apps/web/                     # migration تدریجی از JS به TypeScript
```

قانون dependency: handler → application/use-case → domain → repository adapter.
ماژول‌های دامنه نباید مستقیم به handler یا framework وابسته شوند. فقط `live` حق
تغییر state/score/transition session را دارد.

## قرارداد live

### REST

```text
POST /api/v1/live/sessions/{sessionId}/join
POST /api/v1/live/sessions/{sessionId}/answers
POST /api/v1/live/sessions/{sessionId}/actions
GET  /api/v1/live/sessions/{sessionId}/snapshot
GET  /api/v1/live/sessions/{sessionId}/events   # text/event-stream
```

هر command شامل `request_id` و در commandهای مدیریتی `expected_state_version` است.
پاسخ HTTP نتیجهٔ قطعی command را برمی‌گرداند؛ client برای تأیید صرفاً منتظر SSE
نمی‌ماند.

### SSE

```text
session.snapshot
player.presence
slide.opened
answer.stats
question.closed
leaderboard.updated
session.ended
```

هر event: `event_id`، `schema_version`، `session_id`، `state_version`،
`occurred_at` و `payload` دارد. client باید eventهای قدیمی‌تر از state version
فعلی را نادیده بگیرد. reconnect با `Last-Event-ID` و endpoint snapshot انجام شود.

### state machine

```text
draft → lobby → content | question_open → question_closed → leaderboard → ended
```

- answer فقط در `question_open` و قبل از `ends_at` سرور معتبر است.
- duplicate answer نتیجهٔ idempotent قبلی را برمی‌گرداند و score تازه ایجاد نمی‌کند.
- transition نامعتبر `409 Conflict` است.
- answer stats و leaderboard نباید برای هر پاسخ broadcast شوند؛ batch 250–500ms.

## داده و مقیاس

### PostgreSQL

- PostgreSQL 16+ تنها DB عملیاتی است.
- محتوای انعطاف‌پذیر slide در JSONB، اما relationهای اصلی relational هستند.
- روی answer حداقل unique constraint `(session_id, participant_id, question_id)`
  وجود دارد.
- برای رشد، answer/session-eventها با data واقعی partition می‌شوند؛ زودتر نه.
- connection pool، index و query plan پیش از افزایش ماشین‌ها بررسی شوند.

### Redis/Valkey

- از شروع live برای SSE fan-out بین instanceها، presence با TTL، cache و distributed
  rate limit استفاده می‌شود.
- Redis Pub/Sub برای delivery سریع است؛ snapshot و دادهٔ durable از PostgreSQL.
- قطعی Redis نباید دادهٔ PostgreSQL را corrupt کند؛ service می‌تواند push/presence
  را degraded کند ولی command durability باید صریح و قابل مشاهده باشد.

### سطح رشد

| ظرفیت | نیاز عملیاتی |
|---|---|
| توسعه/MVP | یک API instance، PostgreSQL، Redis، Docker Compose |
| تا ۱۰٬۰۰۰ در یک session | چند API/SSE instance پشت Nginx/HTTP2، Redis، PostgreSQL tuned، aggregation و load test |
| بالاتر از آن | benchmark؛ سپس جداکردن فقط SSE gateway یا live aggregation، نه CRUD/auth |

## امنیت و عملیات

- API و SSE در same-origin ارائه شوند. برای SSE از cookie/session کوتاه‌عمر یا
  ticket محدود استفاده شود؛ JWT بلندمدت در query string ممنوع است.
- TLS، `HttpOnly`/`Secure` cookies، CSRF برای mutationها و CORS محدود اجباری است.
- secretها فقط در env/secret store؛ هرگز در Git یا log نیستند.
- Nginx برای SSE: buffering خاموش، HTTP/2، timeout مناسب و heartbeat.
- log ساخت‌یافته باید request/session/participant ID داشته باشد.
- OpenTelemetry، Prometheus metrics و alert برای DB، Redis، SSE connection، command
  failure و reconnect پیش از production لازم است.

## مراحل توسعه

### Phase 0 — foundation and cleanup (وضعیت فعلی)

- [x] تصمیم Go-first ثبت شد.
- [x] ایجاد scaffold `apps/api`، Compose، OpenAPI و migration اولیه.
- [x] حذف Django/Rust/SQLite و tooling و مستندات legacy از branch جدید.
- [x] تبدیل repository به monorepo `apps/api` و `apps/web`.
- [ ] نصب Go toolchain در محیط توسعه و اجرای تست محلی.
- [ ] تکمیل adapterهای PostgreSQL و Redis و readiness واقعی.

### محدودیت‌ها و ریسک‌های فعلی

- `apps/web` هنوز در نقش مبنای مهاجرت UI، کدهای WebSocket دارد؛ توسعهٔ قابلیت جدید روی آن ممنوع است و در Phase 2 با SSE/HTTP جایگزین می‌شود.
- Go در محیط توسعهٔ فعلی نصب نیست و Docker daemon در دسترس نبود؛ بنابراین آزمون Go و build کانتینر باید در CI یا محیط دارای Docker اجرا شوند.
- `npm ci` در زمان پاک‌سازی 20 آسیب‌پذیری وابستگی گزارش کرد. پیش از انتشار، با بازبینی سازگاری و بدون اجرای کورکورانهٔ `npm audit fix` رسیدگی شود.

### Phase 1 — content platform

- [ ] identity/auth، quiz، presentation، slide و media در Go.
- [ ] migration نهایی PostgreSQL و OpenAPI-generated types.
- [ ] انتقال تدریجی React به TypeScript و API client typed.

### Phase 2 — live engine

- [ ] join، answer، action، snapshot و SSE.
- [ ] idempotency، timer سروری، score، presence و reconnect.
- [ ] integration test با PostgreSQL/Redis و E2E Playwright.

### Phase 3 — capacity proof

- [ ] k6 scenarios: 1k/5k/10k participant، reconnect، host disconnect و answer burst.
- [ ] SLOهای p95 command/event latency با مالک محصول ثبت شوند.
- [ ] scale افقی فقط پس از گزارش benchmark.

### Phase 4 — cutover

- [ ] feature flag و parity test با Django/Rust legacy.
- [ ] انتقال traffic تدریجی و rollback آزمایش‌شده.
- [ ] حذف legacy فقط با اجازهٔ صریح مالک.

## پروتکل کار عامل توسعه

1. ابتدا این فایل و فایل‌های بخش مورد تغییر را کامل بخوان.
2. کد repository حقیقت نهایی است؛ اگر با سند ناسازگار بود، تفاوت را گزارش و سند را
   پس از فهم علت اصلاح کن.
3. تغییرات را کوچک، قابل‌آزمون و در scope درخواست نگه دار.
4. هر تغییر API/event ابتدا در `apps/api/openapi/` ثبت و سپس در `apps/api` و `apps/web`
   هم‌راستا شود.
5. قبل از اعلام اتمام، formatter، unit test و integration test متناسب را اجرا کن.
6. پس از هر تغییر مؤثر، checkbox مرحله، وضعیت، تصمیم/ریسک جدید و جدول تغییرات زیر
   را به‌روزرسانی کن.
7. reset database، حذف migration، purge Redis یا حذف legacy فقط با اجازهٔ صریح مالک.

## تغییرات ثبت‌شده

| تاریخ | تغییر | اعتبارسنجی |
|---|---|---|
| 2026-08-18 | ایجاد سند راهبر اولیه | بررسی ساختار Django/Rust/React |
| 2026-08-18 | تصمیم موقت Django-first | ظرفیت هدف ۱k تا ۵k |
| 2026-08-18 | تصمیم رسمی Go-first و ظرفیت‌محور | درخواست صریح مالک: معماری آینده‌نگر و ظرفیت بالاتر |
| 2026-08-18 | ایجاد Go scaffold، Compose، OpenAPI و schema اولیه | بازبینی فایل‌ها؛ Go toolchain در محیط فعلی نصب نیست، پس تست Go اجرا نشده است |
| 2026-08-18 | افزودن راه‌اندازی Go stack به README ریشه | Compose با env اختصاصی API اعتبارسنجی شد |
| 2026-08-18 | تلاش برای build کانتینری API | انجام نشد: Go محلی نصب نیست و Docker daemon این محیط در دسترس نبود |
| 2026-08-18 | پاک‌سازی branch جدید و تبدیل به monorepo | Django/Rust/Python/SQLite و مستندات legacy حذف شدند؛ ساختار `apps/api` و `apps/web` ایجاد شد |
| 2026-08-18 | افزودن CI، ADR و قواعد repository | `npm run lint`، `npm run test:unit` و `npm run build` در `apps/web` پاس شدند؛ Compose معتبر است |

## مراجع repository

- `apps/api/README.md`: راه‌اندازی backend جدید.
- `apps/api/openapi/openapi.yaml`: قرارداد اولیهٔ API.
- `apps/api/migrations/`: schema جدید PostgreSQL.
- `docs/architecture.md`: boundaries و اصول معماری.
- `docs/decisions/0001-go-modular-monolith.md`: تصمیم رسمی معماری.
- `apps/web/src/contexts/WebSocketContext.jsx`: نقطهٔ migration client به SSE.
