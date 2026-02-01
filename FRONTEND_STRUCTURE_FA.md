# ساختار تفصیلی پروژه فرانت‌اند

## 📂 بررسی دقیق هر پوشه

### 1️⃣ پوشه `src/`

#### 1.1 `src/pages/` - صفحات اصلی

هر صفحه یک مسیر جداگانه است و معمولاً شامل منطق پیچیده‌تری است:

```
pages/
├── auth/
│   ├── AuthPage.jsx              # صفحه ورود/ثبت‌نام
│   └── ResetPasswordPage.jsx     # صفحه بازیابی رمز
│
├── landing/
│   └── LandingPage.jsx           # صفحه اول سایت
│
├── quiz/
│   └── manager/
│       ├── HomePage.jsx          # فهرست کوئیز‌های مدیر
│       └── EditorPage.jsx        # ویرایش کوئیز
│
├── presentation/
│   ├── manager/
│   │   ├── JoinPage.jsx          # ورود مدیر به اتاق
│   │   ├── PickAnswerQuestion.jsx # نمایش سوال چند گزینه‌ای
│   │   └── LeaderBoard.jsx       # نمایش لیدربورد
│   │
│   └── player/
│       ├── JoinPage.jsx          # ورود بازیکن به اتاق
│       ├── PickAnswerQuestion.jsx # پاسخ‌دهی به سوال
│       └── LeaderBoard.jsx       # مشاهده رتبه‌بندی
│
├── report/
│   └── SessionDetail.jsx         # جزئیات جلسه و گزارش
│
├── team/
│   └── TeamPage.jsx              # صفحه مدیریت تیم
│
└── loading/
    └── LoadingPage.jsx           # صفحه بارگذاری/انتظار
```

**نکات مهم:**

- هر صفحه می‌تواند از `useServerData()` و `useWebSocket()` استفاده کند
- صفحات Presentation معمولاً در داخل `PresentationEntry` راوتر قرار می‌گیرند
- Lazy loading استفاده می‌شود برای بهبود عملکرد

---

#### 1.2 `src/components/` - کامپوننت‌های مشترک

```
components/
├── ui/                           # کامپوننت‌های اساسی (shadcn/ui)
│   ├── Button.jsx
│   ├── Input.jsx
│   ├── Modal.jsx
│   └── ... (سایر کامپوننت‌های UI)
│
├── presentation/
│   ├── QuestionDisplay.jsx       # نمایش سوال
│   ├── AnswerOptions.jsx         # گزینه‌های پاسخ
│   ├── QuestionTimer.jsx         # تایمر سوال
│   └── ... (سایر کامپوننت‌های ارائه)
│
├── Header.jsx                    # هدر صفحات
├── Footer.jsx                    # فوتر صفحات
├── SiteHeader.jsx                # هدر سایت
├── SiteFooter.jsx                # فوتر سایت
├── QuizHeader.jsx                # هدر کوئیز
├── QuizManager.jsx               # مدیریت کوئیز
├── LeaderboardModal.jsx          # پنجره لیدربورد
├── TopBar.jsx                    # نوار بالا
├── QRSidebar.jsx                 # کنار میز QR Code
├── ShareMenu.jsx                 # منوی اشتراک‌گذاری
├── ReactionEffects.jsx           # انیمیشن‌های واکنش
└── Seo.jsx                       # بهینه‌سازی SEO
```

**ویژگی‌ها:**

- کامپوننت‌های UI بازاستفاده‌پذیر و مستقل
- کامپوننت‌های Presentation برای منطق مربوط به ارائه
- Props-based configuration

---

#### 1.3 `src/contexts/` - State Management

سه Context اصلی برای مدیریت state:

```
contexts/
├── WebSocketContext.jsx          # ارتباط WebSocket
├── ServerDataContext.jsx         # داده‌های دریافتی از سرور
└── AudioContext.jsx              # مدیریت صدا
```

**تفصیل:**

**WebSocketContext:**

- مدیریت اتصال WebSocket
- ارسال و دریافت پیام‌ها
- مدیریت reconnection

**ServerDataContext:**

- ذخیره داده‌های دریافتی از سرور
- مدیریت state برای users، questions، leaderboard
- تابع‌های بروزرسانی برای هر نوع پیام

**AudioContext:**

- پخش صدا‌های notification
- کنترل sound effects

---

#### 1.4 `src/hooks/` - Custom Hooks

```
hooks/
├── useWebSocket.js               # استفاده از WebSocketContext
└── useServerData.js              # استفاده از ServerDataContext
```

**استفاده:**

```jsx
// استفاده در کامپوننت
const { isConnected, sendMessage } = useWebSocket();
const { serverData, updateUsers } = useServerData();
```

---

#### 1.5 `src/utils/` - توابع کمکی

```
utils/
├── api.js                        # تنظیم آدرس API
├── apiFetch.js                   # درخواست‌های HTTP
├── auth.js                       # مدیریت احراز هویت
└── colorUtils.js                 # توابع رنگی
```

**تفصیل:**

**apiFetch.js:**

```javascript
// استفاده:
const res = await apiFetch("/quizzes/", {
  method: "POST",
  json: { title: "Untitled" },
});
```

**auth.js:**

- ذخیره و بازیابی توکن‌های JWT
- مدیریت انقضای توکن
- logout کردن

---

#### 1.6 `src/services/` - منطق تجاری

```
services/
└── quizService.jsx               # خدمات مربوط به کوئیز
```

این فایل‌ها شامل منطق پیچیده و عملیات‌های تجاری هستند.

---

#### 1.7 `src/lib/` و `src/data/`

```
lib/
├── utils.js                      # توابع کلی
└── colorUtils.js                 # توابع رنگی

data/
└── mockData.js                   # داده‌های نمونه برای توسعه
```

---

### 2️⃣ پوشه `public/`

فایل‌های استاتیکی که به عنوان است استفاده می‌شوند:

```
public/
├── robots.txt                    # دستورالعمل‌های موتور جستجو
├── sitemap.xml                   # نقشه سایت
├── site.webmanifest              # تنظیمات PWA
└── fonts/                        # فونت‌های custom
```

---

### 3️⃣ فایل‌های تنظیمات

```
frontend/
├── package.json                  # وابستگی‌ها و scripts
├── vite.config.js                # تنظیمات Vite
├── tailwind.config.cjs           # تنظیمات Tailwind
├── postcss.config.cjs            # تنظیمات PostCSS
├── eslint.config.js              # تنظیمات ESLint
├── jsconfig.json                 # تنظیمات JavaScript
└── components.json               # تنظیمات shadcn/ui
```

---

## 🔌 نقاط کلیدی اتصال

### نقطه ورود (Entry Point)

```
main.jsx
  ↓
App.jsx
  ↓
<Router>
  <Suspense>
    <Routes>
```

### Flow کاملی از ورود تا نمایش داده‌ها:

```
1. صفحه بارگذاری می‌شود (مثلاً AuthPage)
2. کاربر وارد می‌شود و credential ارسال می‌کند
3. apiFetch() درخواست می‌فرستد و توکن دریافت می‌شود
4. توکن در localStorage ذخیره می‌شود
5. صفحه جدید بارگذاری می‌شود (مثلاً HomePage)
6. WebSocketProvider فعال می‌شود
7. PresentationEntry راوتر اتاق را دریافت می‌کند
8. WebSocket اتصال برقرار می‌کند
9. پیام‌های real-time دریافت می‌شوند
10. ServerDataContext داده‌ها را ذخیره می‌کند
11. کامپوننت‌ها خود را بازرسانی می‌کنند
```

---

## 📊 جدول مرجع فایل‌ها

| مسیر          | نوع               | هدف                          |
| ------------- | ----------------- | ---------------------------- |
| `pages/`      | صفحات             | تمام مسیرهای اصلی            |
| `components/` | کامپوننت          | کامپوننت‌های دوباستفاده‌پذیر |
| `contexts/`   | State             | مدیریت state سراسری          |
| `hooks/`      | Hook              | منطق دوباستفاده‌پذیر         |
| `utils/`      | توابع             | کارکرد کلی‌تر                |
| `services/`   | منطق              | منطق تجاری پیچیده            |
| `assets/`     | فایل‌های استاتیکی | تصاویر و فونت‌ها             |
| `data/`       | داده              | داده‌های ساختی               |
