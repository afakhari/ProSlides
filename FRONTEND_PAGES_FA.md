# راهنمای صفحات اصلی فرانت‌اند

## 📄 نمای کلی صفحات

صفحات اصلی پروژه ProSlides:

```
pages/
├── auth/                    # صفحات احراز هویت
├── landing/                 # صفحه اول سایت
├── quiz/                    # صفحات مدیریت کوئیز
├── presentation/            # صفحات ارائه
├── report/                  # صفحات گزارش‌ها
├── team/                    # صفحات تیم
└── loading/                 # صفحات بارگذاری
```

---

## 🔐 صفحات Authentication (auth/)

### AuthPage.jsx

**مسیرها:**

- `/login` - ورود کاربری
- `/signup` - ثبت‌نام
- `/auth` - صفحه احراز هویت عمومی

**ویژگی‌ها:**

- ورود با نام کاربری و رمز عبور
- ثبت‌نام کاربران جدید
- فراموشی رمز عبور (forgot password)

**جریان:**

```
1. کاربر اطلاعات وارد می‌کند
2. apiFetch("/auth/token/") درخواست فرستاده می‌شود
3. JWT Token دریافت می‌شود
4. Token در localStorage ذخیره می‌شود
5. ارجاع به صفحه HomePage
```

**مثال استفاده:**

```jsx
// یک بازیکن وارد شده است
const handleLogin = async (username, password) => {
  const res = await apiFetch("/auth/token/", {
    method: "POST",
    auth: false,
    json: { username, password },
  });

  const { access, refresh } = await res.json();
  localStorage.setItem("auth.access", access);
  localStorage.setItem("auth.refresh", refresh);

  navigate("/manager/panel");
};
```

---

### ResetPasswordPage.jsx

**مسیر:** `/reset-password`

**ویژگی‌ها:**

- بازیابی رمز عبور فراموش‌شده
- ارسال لینک تایید به ایمیل
- تغییر رمز عبور

---

## 🏠 صفحه اول (landing/)

### LandingPage.jsx

**مسیر:** `/`

**ویژگی‌ها:**

- نمایش اطلاعات سایت
- دکمه‌های ورود/ثبت‌نام
- معرفی ویژگی‌های پروژه

**کامپوننت‌های استفاده‌شده:**

```jsx
<SiteHeader />           // هدر سایت
<HeroSection />          // بخش معرفی
<FeaturesSection />      // بخش ویژگی‌ها
<CTASection />           // دکمه‌های کال‌تو‌اکشن
<SiteFooter />           // فوتر
```

---

## 📊 صفحات کوئیز (quiz/)

### HomePage.jsx

**مسیر:** `/:role/panel`

**نقش:** درخواست‌کنندگی (Manager)

**ویژگی‌ها:**

- نمایش لیست کوئیز‌های کاربر
- ایجاد کوئیز جدید
- حذف و ویرایش کوئیز
- شروع ارائه کوئیز

**State:**

```jsx
const [quizzes, setQuizzes] = useState([]);
const [loading, setLoading] = useState(true);
const { serverData } = useServerData();
```

**مثال:**

```jsx
useEffect(() => {
  // دریافت لیست کوئیز‌ها
  const fetchQuizzes = async () => {
    const res = await apiFetch("/quizzes/");
    const data = await res.json();
    setQuizzes(data);
  };
  fetchQuizzes();
}, []);

// نمایش کوئیز‌ها در جدول
{
  quizzes.map((quiz) => <QuizCard key={quiz.id} quiz={quiz} />);
}
```

---

### EditorPage.jsx

**مسیر:** `/:role/panel/:roomId`

**نقش:** درخواست‌کنندگی

**ویژگی‌ها:**

- ویرایش سوالات کوئیز
- اضافه کردن سوال جدید
- مرتب‌سازی سوالات
- پیش‌نمایش کوئیز

**کامپوننت‌های استفاده‌شده:**

```jsx
<QuestionEditor />      // ویرایش سوال
<QuestionList />        // لیست سوالات
<PreviewPanel />        // پیش‌نمایش
```

---

## 🎮 صفحات ارائه (presentation/)

صفحات ارائه به دو دسته تقسیم می‌شوند: **Manager** و **Player**

### Manager Pages

#### manager/JoinPage.jsx

**مسیر:** `/:role/presentation/:roomId`

**ویژگی‌ها:**

- وارد شدن مدیر به اتاق
- تایید قبل از شروع
- انتخاب نقش (manager/viewer)

---

#### manager/PickAnswerQuestion.jsx

**ویژگی‌ها:**

- نمایش سوال برای مدیر
- مشاهده پاسخ‌های بازیکنان به صورت زنده
- کنترل زمان سوال
- دکمه‌های Next/Previous

**State:**

```jsx
const { serverData } = useServerData();
const { isConnected } = useWebSocket();

// نمایش سوال فعلی
const currentQuestion = serverData.currentQuestion;

// مشاهده پاسخ‌های جزئی
const partialResults = serverData.partialQuestionResults;
```

---

#### manager/LeaderBoard.jsx

**ویژگی‌ها:**

- نمایش رتبه‌بندی لحظه‌ای
- نمایش امتیازات بازیکنان
- به‌روزرسانی خودکار

---

### Player Pages

#### player/JoinPage.jsx

**ویژگی‌ها:**

- وارد شدن بازیکن با کد دسترسی
- یا اسکن QR Code
- انتخاب اسم کاربری

**Flow:**

```jsx
const handleJoin = async (accessCode, playerName) => {
  // حل کردن کد دسترسی
  const res = await apiFetch(
    `/quizzes/resolve-access-code/?access_code=${accessCode}`,
    { auth: false },
  );

  const { quiz_id, room_id } = await res.json();

  // ذخیره و انتقال به ارائه
  navigate(`/player/presentation/${room_id}`);
};
```

---

#### player/PickAnswerQuestion.jsx

**ویژگی‌ها:**

- نمایش سوال برای بازیکن
- انتخاب یکی از گزینه‌ها
- مشاهده وضعیت پاسخ (انتظار/ثبت‌شده)
- تایمر شمارش معکوس

**Interaction:**

```jsx
const handleSelectOption = async (optionId) => {
  const response = await apiFetch("/answers/", {
    method: "POST",
    json: {
      question_id: currentQuestion.id,
      option_id: optionId,
      player_id: playerId,
    },
  });

  setAnswerSubmitted(true);
  playSound("answer-submitted");
};
```

---

#### player/LeaderBoard.jsx

**ویژگی‌ها:**

- دیدن رتبه‌بندی خود
- مقایسه با دیگر بازیکنان
- نمایش امتیاز فعلی

---

## 📈 صفحات گزارش (report/)

### SessionDetail.jsx

**مسیر:** `/:role/panel/:quizId/report`

**ویژگی‌ها:**

- نمایش آمار جلسه
- گراف‌های تجزیه و تحلیلی
- لیست پاسخ‌های بازیکنان
- نمودار کامیابی

**API Calls:**

```jsx
useEffect(() => {
  const fetchReport = async () => {
    // آمار کلی
    const stats = await apiFetch(`/quizzes/${quizId}/stats/`);

    // پاسخ‌های بازیکنان
    const answers = await apiFetch(`/quizzes/${quizId}/answers/`);

    // لیدربورد نهایی
    const leaderboard = await apiFetch(`/quizzes/${quizId}/leaderboard/`);
  };
}, [quizId]);
```

---

## 👥 صفحات تیم (team/)

### TeamPage.jsx

**مسیر:** `/team`

**ویژگی‌ها:**

- مدیریت اعضای تیم
- اضافه کردن کاربر جدید
- تغییر نقش کاربران
- حذف اعضا

---

## ⏳ صفحات بارگذاری (loading/)

### LoadingPage.jsx

**مسیر:** `/loading`

**ویژگی‌ها:**

- نمایش اسپینر بارگذاری
- پیغام انتظار
- بازتاب برای دوباره‌تلاش

---

## 🔗 Router Configuration (App.jsx)

```jsx
<Routes>
  {/* Public Routes */}
  <Route path="/" element={<LandingPage />} />
  <Route path="/login" element={<AuthPage />} />
  <Route path="/signup" element={<AuthPage />} />
  <Route path="/reset-password" element={<ResetPasswordPage />} />

  {/* Private Routes */}
  <Route path="/:role/panel" element={<HomePage />} />
  <Route path="/:role/panel/:roomId" element={<EditorPage />} />
  <Route path="/:role/panel/:quizId/report" element={<SessionDetail />} />

  {/* Presentation Routes */}
  <Route
    path="/:role/presentation/:roomId"
    element={<PresentationEntry mode="presentation" />}
  />

  {/* Team & Other */}
  <Route path="/team" element={<TeamPage />} />

  {/* Error Routes */}
  <Route path="*" element={<NotFoundPage />} />
</Routes>
```

---

## 🔐 Protected Routes

برخی صفحات نیاز به احراز هویت دارند:

```jsx
// Higher Order Component برای محافظت صفحات
const ProtectedRoute = ({ children }) => {
  const { access } = getAuthHeaders();

  if (!access) {
    return <Navigate to="/login" />;
  }

  return children;
};

// استفاده
<ProtectedRoute>
  <HomePage />
</ProtectedRoute>;
```

---

## 📊 جریان صفحات

```
LandingPage
  ↓
AuthPage (Login/Signup)
  ↓
HomePage (Dashboard)
  ├→ EditorPage (Edit Quiz)
  │ └→ PresentationEntry
  │    ├→ manager/PickAnswerQuestion
  │    ├→ manager/LeaderBoard
  │    └→ manager/JoinPage
  │
  ├→ SessionDetail (Report)
  │
  └→ TeamPage
```

---

## 📚 منابع

- [React Router Documentation](https://reactrouter.com)
- [React Best Practices](https://react.dev/learn)
