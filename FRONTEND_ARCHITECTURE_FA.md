# معماری فرانت‌اند ProSlides

## 📋 فهرست مطالب

1. [نمای کلی پروژه](#نمای-کلی-پروژه)
2. [ساختار پروژه](#ساختار-پروژه)
3. [معماری کلی](#معماری-کلی)
4. [جریان داده](#جریان-داده)
5. [فناوری‌های استفاده‌شده](#فناوری‌های-استفاده‌شده)
6. [برای شروع](#برای-شروع)

## 🎯 نمای کلی پروژه

**ProSlides** یک پلتفرم تعاملی برای برگزاری پرسش و پاسخ زنده است که امکان ارائه درس و سوالات آنی را برای گروه‌های بزرگ فراهم می‌کند.

### ویژگی‌های اصلی:

- **سؤالات تعاملی**: پاسخ‌دهندگان می‌توانند به سؤالات چند گزینه‌ای یا ترسیمی پاسخ دهند
- **لیدربورد زنده**: رتبه‌بندی لحظه‌ای بازیکنان
- **نقش‌های مختلف**: مدیر (ارائه‌دهنده) و بازیکنان (شرکت‌کنندگان)
- **WebSocket ارتباط**: انتقال داده‌های real-time

## 📁 ساختار پروژه

```
frontend/
├── src/
│   ├── assets/              # تصاویر، آیکون‌ها
│   │   ├── avatars/         # تصاویر کاربری
│   │   └── patterns/        # الگوهای زمینه
│   │
│   ├── components/          # کامپوننت‌های قابل استفاده مجدد
│   │   ├── ui/              # کامپوننت‌های UI اساسی (shadcn/ui)
│   │   ├── presentation/    # کامپوننت‌های مربوط به ارائه
│   │   ├── Footer.jsx
│   │   ├── Header.jsx
│   │   ├── QuizHeader.jsx
│   │   ├── QuizManager.jsx
│   │   ├── LeaderboardModal.jsx
│   │   └── ... (سایر کامپوننت‌ها)
│   │
│   ├── contexts/            # State Management (Context API)
│   │   ├── AudioContext.jsx      # مدیریت صدا
│   │   ├── WebSocketContext.jsx  # اتصال WebSocket
│   │   └── ServerDataContext.jsx # داده‌های دریافتی از سرور
│   │
│   ├── hooks/               # Custom React Hooks
│   │   ├── useWebSocket.js      # استفاده از WebSocket Context
│   │   └── useServerData.js     # استفاده از Server Data
│   │
│   ├── pages/               # صفحات اصلی (Page Components)
│   │   ├── auth/            # صفحات احراز هویت
│   │   │   ├── AuthPage.jsx
│   │   │   └── ResetPasswordPage.jsx
│   │   ├── landing/         # صفحه ورود
│   │   ├── quiz/            # صفحات مربوط به کوئیز
│   │   │   └── manager/
│   │   ├── presentation/    # صفحات ارائه
│   │   │   ├── manager/
│   │   │   └── player/
│   │   ├── report/          # صفحات گزارش‌ها
│   │   ├── team/            # صفحات تیم
│   │   └── loading/         # صفحات بارگذاری
│   │
│   ├── routes/              # مسیرهای ارتباطی
│   │   └── PresentationEntry.jsx
│   │
│   ├── services/            # خدمات و Logic تجاری
│   │   └── quizService.jsx
│   │
│   ├── utils/               # ابزارهای کمکی
│   │   ├── api.js           # تنظیم آدرس API
│   │   ├── apiFetch.js      # درخواست‌های HTTP
│   │   ├── auth.js          # مدیریت احراز هویت
│   │   └── colorUtils.js
│   │
│   ├── lib/                 # کتابخانه‌های کمکی
│   │   └── utils.js
│   │
│   ├── data/                # داده‌های ساختی
│   │   └── mockData.js      # داده‌های نمونه
│   │
│   ├── App.jsx              # کامپوننت ریشه اپلیکیشن
│   ├── main.jsx             # نقطه ورود اپلیکیشن
│   ├── index.css            # استایل‌های کلی
│   └── App.css
│
├── public/                  # فایل‌های استاتیک
├── package.json             # وابستگی‌های پروژه
├── vite.config.js           # تنظیمات Vite
├── tailwind.config.cjs      # تنظیمات Tailwind CSS
└── README.md
```

## 🏗️ معماری کلی

### لایه‌های معماری:

```
┌─────────────────────────────────────────────────┐
│          صفحات (Pages)                          │
│  Auth | Landing | Quiz | Presentation | Report │
└───────────────────┬─────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────┐
│     کامپوننت‌های مشترک (Components)             │
│   UI | QuizHeader | LeaderboardModal | ...     │
└───────────────────┬─────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────┐
│      Context API + Custom Hooks                │
│ WebSocket | ServerData | Audio | useServerData │
└───────────────────┬─────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────┐
│     Utilities و Services                        │
│  apiFetch | auth | colorUtils | quizService    │
└───────────────────┬─────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────┐
│         Django Backend API + WebSocket          │
│  احراز هویت | کوئیز | پاسخ‌ها | لیدربورد        │
└─────────────────────────────────────────────────┘
```

## 🔄 جریان داده

### 1. احراز هویت و ورود

```
کاربر → صفحه AuthPage → API درخواست → Django Backend
                            ↓
                    توکن JWT دریافت
                            ↓
                  ذخیره در localStorage
                            ↓
                    ارجاع به داشبورد
```

### 2. ارسال درخواست‌های HTTP

```
کامپوننت/صفحه
    ↓
useServerData Hook یا مستقیم
    ↓
apiFetch() function
    ↓
getAuthHeaders() - اضافه کردن توکن
    ↓
fetch(API)
    ↓
Django Backend
    ↓
پاسخ JSON
    ↓
ServerDataContext (ذخیره سازی)
    ↓
بازرسانی کامپوننت
```

### 3. ارتباط Real-Time (WebSocket)

```
کاربر → PresentationEntry
    ↓
دریافت room_id
    ↓
WebSocketContext.connect(room_id)
    ↓
WebSocket اتصال (wss://present.proslides.ir/ws/...)
    ↓
دریافت پیام‌های type: 1, 2, 3, 7, 8, 12 ...
    ↓
ServerDataContext بروزرسانی
    ↓
UI بازرسانی خودکار
```

### 4. نوع‌های پیام‌های WebSocket

| Type | توضیح                     | استفاده                   |
| ---- | ------------------------- | ------------------------- |
| 1    | نتایج لیدربورد نهایی      | نمایش رتبه‌بندی           |
| 2    | سوال فعلی                 | نمایش سوال و گزینه‌ها     |
| 3    | نتایج جزئی سوال           | بروزرسانی پاسخ‌ها در لحظه |
| 7    | لیست کاربران متصل         | به‌روزرسانی بازیکنان      |
| 8    | نتایج کامل سوال           | نتیجه نهایی سوال          |
| 12   | نتایج لیدربورد برای Modal | نمایش در Modal            |

## 🛠️ فناوری‌های استفاده‌شده

### Frontend Framework & Tools

- **React 19**: کتابخانه UI
- **Vite**: بسته‌بندی و development server
- **React Router 7**: مسیریابی
- **Tailwind CSS 4**: استایل‌دهی
- **shadcn/ui**: کامپوننت‌های UI آماده

### State Management

- **React Context API**: مدیریت state
- **Custom Hooks**: منطق دوباستفاده‌پذیر

### WebSocket & API

- **WebSocket API**: ارتباط real-time
- **Fetch API**: درخواست‌های HTTP
- **Axios**: (در برخی قسمت‌ها)

### UI/UX

- **Framer Motion**: انیمیشن‌ها
- **Lucide React**: آیکون‌ها
- **Emoji Picker**: انتخاب emoji

### Build & Dev

- **ESLint**: کد lint کردن
- **PostCSS**: پردازش CSS
- **npm**: مدیر وابستگی‌ها

## 🚀 برای شروع

### پیش‌نیازها

- Node.js 18+
- npm یا yarn

### نصب و راه‌اندازی

```bash
# وارد شدن به پوشه فرانت‌اند
cd frontend

# نصب وابستگی‌ها
npm install

# راه‌اندازی سرور توسعه
npm run dev

# ساخت برای production
npm run build

# Preview بسته ساخته‌شده
npm run preview
```

### متغیرهای محیط

تنظیمات API در فایل [src/utils/api.js](src/utils/api.js):

```javascript
// توسعه
const API_BASE = "http://localhost:8000/api";

// Production
const API_BASE = "https://api.proslides.ir/api";
```

## 📖 مستندات بیشتر

برای اطلاعات دقیق‌تر به مستندات زیر مراجعه کنید:

- [ساختار پروژه تفصیلی](FRONTEND_STRUCTURE_FA.md)
- [راهنمای کامپوننت‌ها](FRONTEND_COMPONENTS_FA.md)
- [Context و Hooks](FRONTEND_CONTEXT_HOOKS_FA.md)
- [صفحات اصلی](FRONTEND_PAGES_FA.md)
- [بهترین روش‌ها و توسعه](FRONTEND_BEST_PRACTICES_FA.md)
