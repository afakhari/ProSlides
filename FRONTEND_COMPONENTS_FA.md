# راهنمای کامپوننت‌های فرانت‌اند

## 📌 انواع کامپوننت‌ها

فرانت‌اند ProSlides از سه نوع کامپوننت استفاده می‌کند:

### 1. کامپوننت‌های UI (شامل shadcn/ui)

کامپوننت‌های پایه‌ای و قابل استفاده مجدد برای رابط کاربری.

**مثال‌ها:**

```
ui/Button.jsx          # دکمه
ui/Input.jsx           # ورودی متن
ui/Modal.jsx           # پنجره
ui/Card.jsx            # کارت
ui/Badge.jsx           # نشان
```

**خصوصیات:**

- ✅ بسیار قابل تنظیم
- ✅ رفتار یکسان در سراسر پروژه
- ✅ Accessible (رعایت استاندارد‌های دسترسی)

---

### 2. کامپوننت‌های سایت (Global Components)

کامپوننت‌هایی که در چندین صفحه استفاده می‌شوند:

```
Header.jsx             # هدر صفحات
Footer.jsx             # فوتر صفحات
TopBar.jsx             # نوار بالای صفحه
SiteHeader.jsx         # هدر سایت
SiteFooter.jsx         # فوتر سایت
ShareMenu.jsx          # منوی اشتراک‌گذاری
```

**مثال استفاده:**

```jsx
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function MyPage() {
  return (
    <>
      <Header />
      <main>صفحه</main>
      <Footer />
    </>
  );
}
```

---

### 3. کامپوننت‌های مختص ارائه (Presentation Components)

کامپوننت‌هایی که برای نمایش سوالات و پاسخ‌ها در ارائه استفاده می‌شوند:

#### 3.1 QuizHeader

```jsx
import QuizHeader from "@/components/QuizHeader";

// نمایش هدر کوئیز
<QuizHeader quizTitle="درس ریاضی" currentQuestion={5} totalQuestions={10} />;
```

**Props:**

- `quizTitle`: عنوان کوئیز
- `currentQuestion`: شماره سوال فعلی
- `totalQuestions`: تعداد کل سوالات

---

#### 3.2 LeaderboardModal

پنجره نمایش رتبه‌بندی بازیکنان:

```jsx
import LeaderboardModal from "@/components/LeaderboardModal";

const { serverData } = useServerData();

<LeaderboardModal
  isOpen={showLeaderboard}
  onClose={() => setShowLeaderboard(false)}
  leaderboard={serverData.leaderboardResults}
/>;
```

**Props:**

- `isOpen`: نمایش یا عدم نمایش پنجره
- `onClose`: تابع بسته شدن پنجره
- `leaderboard`: داده‌های لیدربورد

---

#### 3.3 QuizManager

کامپوننت مدیریت کوئیز برای مدیران:

```jsx
import QuizManager from "@/components/QuizManager";

<QuizManager
  quizId={quizId}
  onQuestionChange={handleQuestionChange}
  onPlayPause={handlePlayPause}
/>;
```

---

#### 3.4 ReactionEffects

نمایش انیمیشن‌های واکنش (emoji):

```jsx
import ReactionEffects from "@/components/ReactionEffects";

<ReactionEffects
  reactions={[
    { emoji: "👍", x: 100, y: 200 },
    { emoji: "😂", x: 300, y: 150 },
  ]}
/>;
```

---

#### 3.5 QRSidebar

نوار جانبی نمایش QR Code:

```jsx
import QRSidebar from "@/components/QRSidebar";

<QRSidebar roomId={roomId} accessCode={accessCode} playerCount={playerCount} />;
```

**Props:**

- `roomId`: شناسه اتاق
- `accessCode`: کد دسترسی برای بازیکنان
- `playerCount`: تعداد بازیکنان متصل

---

## 🔧 نحوه ایجاد کامپوننت جدید

### مثال: کامپوننت درخواست‌دهندگی سوال

```jsx
// components/QuestionDisplay.jsx

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";

export default function QuestionDisplay({
  question,
  options,
  onSelectOption,
  isAnswered,
}) {
  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>{question.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {options.map((option) => (
            <Button
              key={option.id}
              onClick={() => onSelectOption(option.id)}
              disabled={isAnswered}
              variant={isAnswered ? "outline" : "default"}
              className="w-full text-right"
            >
              {option.text}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

**نکات مهم:**

- ✅ کامپوننت‌های کوچک و مستقل باشند
- ✅ تمام Props مورد نیاز را گرفتن
- ✅ Callback functions برای Events
- ✅ استایل‌دهی با Tailwind CSS

---

## 📚 Pattern‌های رایج

### Pattern 1: Controlled Component

```jsx
const [answer, setAnswer] = useState(null);

<AnswerOptions
  options={options}
  selectedOption={answer}
  onChange={setAnswer}
/>;
```

### Pattern 2: Conditional Rendering

```jsx
{
  isLoading ? (
    <LoadingSpinner />
  ) : isError ? (
    <ErrorMessage error={error} />
  ) : (
    <Content data={data} />
  );
}
```

### Pattern 3: Using Hooks

```jsx
export default function MyComponent() {
  const { serverData } = useServerData();
  const { isConnected } = useWebSocket();

  return <div>{isConnected ? "متصل" : "قطع شده"}</div>;
}
```

---

## 🎨 تنظیمات Tailwind و Styling

### رنگ‌های استاندارد پروژه

تمام رنگ‌ها در `tailwind.config.cjs` تعریف شده‌اند:

```jsx
// استفاده:
<div className="bg-primary text-white">محتوا</div>
<button className="bg-secondary hover:bg-secondary-dark">دکمه</button>
<span className="text-accent">متن تاکیدی</span>
```

### Responsive Design

```jsx
<div
  className="
  grid 
  grid-cols-1       // 1 ستون در موبایل
  sm:grid-cols-2    // 2 ستون در tablet
  lg:grid-cols-3    // 3 ستون در دسکتاپ
"
>
  {/* محتوا */}
</div>
```

---

## 📦 وابستگی‌های کامپوننت‌ها

```
┌─────────────────────────────────────────┐
│     صفحات (Pages)                       │
│  - استفاده از چند کامپوننت              │
│  - Props drilling (ممکن است)           │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│  کامپوننت‌های ترکیب شده                │
│  - استفاده از UI + چند کامپوننت         │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│     کامپوننت‌های UI                     │
│  - مستقل و بازاستفاده‌پذیر              │
└─────────────────────────────────────────┘
```

---

## ⚠️ اشتباهات رایج

### ❌ اشتباه 1: Component خیلی بزرگ

```jsx
// ❌ بد
export default function QuizPage() {
  // 500 خط کد!
  return (...)
}

// ✅ خوب
export default function QuizPage() {
  return (
    <>
      <QuizHeader />
      <QuestionDisplay />
      <AnswerOptions />
      <LeaderboardModal />
    </>
  );
}
```

### ❌ اشتباه 2: Props Drilling

```jsx
// ❌ بد - Props در چندین سطح
<Page quizId={quizId}>
  <Layout quizId={quizId}>
    <QuestionCard quizId={quizId} />
  </Layout>
</Page>

// ✅ خوب - استفاده از Context
<ServerDataContext>
  <Page>
    <Layout>
      <QuestionCard /> {/* از useServerData استفاده می‌کند */}
    </Layout>
  </Page>
</ServerDataContext>
```

### ❌ اشتباه 3: State غیر لازم

```jsx
// ❌ بد - State اضافی
const [userData, setUserData] = useState(null);
const { serverData } = useServerData(); // که شامل userData است

// ✅ خوب - استفاده مستقیم از Context
const { serverData } = useServerData();
const userData = serverData.users; // استخراج از Context
```

---

## 🧪 تست کردن کامپوننت‌ها

### مثال تست ساده

```jsx
import { render, screen, fireEvent } from "@testing-library/react";
import QuestionDisplay from "@/components/QuestionDisplay";

test("نمایش سوال و گزینه‌ها", () => {
  const mockQuestion = {
    id: 1,
    title: "سوال تستی",
  };
  const mockOptions = [
    { id: 1, text: "گزینه 1" },
    { id: 2, text: "گزینه 2" },
  ];

  render(
    <QuestionDisplay
      question={mockQuestion}
      options={mockOptions}
      onSelectOption={jest.fn()}
    />,
  );

  expect(screen.getByText("سوال تستی")).toBeInTheDocument();
  expect(screen.getByText("گزینه 1")).toBeInTheDocument();
});
```

---

## 📖 منابع مفید

- [shadcn/ui Documentation](https://ui.shadcn.com)
- [React Patterns](https://reactpatterns.com)
- [Tailwind CSS Documentation](https://tailwindcss.com)
- [React Best Practices](https://react.dev/learn)
