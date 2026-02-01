# بهترین روش‌ها و راهنمای توسعه

## 📋 فهرست مطالب

1. [کدنویسی و معمارsolid](#کدنویسی)
2. [مدیریت State](#مدیریت-state)
3. [API و DataFetching](#api--datafetching)
4. [عملکرد و بهینه‌سازی](#عملکرد)
5. [تست کردن](#تست‌کردن)
6. [خطاهای رایج](#خطاهای-رایج)

---

## 💻 کدنویسی و معمار

### 1. تقسیم مسئولیت‌ها

هر فایل و کامپوننت باید مسئولیت واحدی داشته باشد:

```jsx
// ❌ بد - کامپوننت بزرگ با مسئولیت‌های زیادی
const QuizPresentation = () => {
  // دریافت داده‌ها
  // محاسبه امتیاز
  // رندر UI
  // مدیریت WebSocket
  // ... 500 خط کد
};

// ✅ خوب - کامپوننت‌های کوچک و مستقل
const QuizPresentation = () => (
  <>
    <QuizHeader />
    <QuestionDisplay />
    <ScoreCalculator />
    <WebSocketManager />
  </>
);
```

---

### 2. نام‌گذاری واضح

```jsx
// ❌ بد
const h = () => {};
const data = serverData.users;
const x = computeScore();

// ✅ خوب
const handlePlayerJoin = () => {};
const activePlayersList = serverData.users;
const playerTotalScore = computeScore();
```

---

### 3. استفاده از Const به جای Let

```jsx
// ❌ بد
let userName = "علی";
let quizId = 123;

// ✅ خوب - فقط زمانی استفاده کن که نیاز باشد تغییر دهی
const userName = "علی";
const quizId = 123;
let score = 0; // فقط اگر تغییر کند
```

---

### 4. Destructuring

```jsx
// ❌ بد
const user = props.user;
const name = user.name;
const email = user.email;

// ✅ خوب
const {
  user: { name, email },
} = props;
// یا بهتر:
const { user } = props;
const { name, email } = user;
```

---

## 🎯 مدیریت State

### 1. State را تنها اگر لازم است استفاده کن

```jsx
// ❌ بد - state غیر لازم
const MyComponent = () => {
  const { currentQuestion } = useServerData();
  const [question, setQuestion] = useState(null);

  useEffect(() => {
    setQuestion(currentQuestion);
  }, [currentQuestion]);

  return <div>{question?.title}</div>;
};

// ✅ خوب
const MyComponent = () => {
  const { currentQuestion } = useServerData();
  return <div>{currentQuestion?.title}</div>;
};
```

---

### 2. State معقول

```jsx
// ❌ بد - state‌های زیادی و نامرتبط
const [name, setName] = useState("");
const [email, setEmail] = useState("");
const [phone, setPhone] = useState("");
const [address, setAddress] = useState("");

// ✅ خوب - گروپ کردن مرتبط
const [userInfo, setUserInfo] = useState({
  name: "",
  email: "",
  phone: "",
  address: "",
});
```

---

### 3. Effects را کمینه کن

```jsx
// ❌ بد - effects زیادی
useEffect(() => {
  fetchUsers();
}, []);

useEffect(() => {
  fetchQuizzes();
}, []);

useEffect(() => {
  fetchReports();
}, []);

// ✅ خوب - یک effect برای همه
useEffect(() => {
  const fetchAllData = async () => {
    const [users, quizzes, reports] = await Promise.all([
      apiFetch("/users/"),
      apiFetch("/quizzes/"),
      apiFetch("/reports/"),
    ]);
  };
  fetchAllData();
}, []);
```

---

## 📡 API و DataFetching

### 1. استفاده از apiFetch

```jsx
// ✅ صحیح - استفاده از apiFetch helper
import { apiFetch } from "@/utils/apiFetch";

const res = await apiFetch("/quizzes/", {
  method: "POST",
  json: { title: "کوئیز جدید" },
});

// توکن خودکار اضافه می‌شود!
```

---

### 2. Error Handling

```jsx
// ❌ بد - بدون error handling
const fetchData = async () => {
  const res = await apiFetch("/data/");
  const data = await res.json();
  setData(data);
};

// ✅ خوب - error handling مناسب
const fetchData = async () => {
  try {
    const res = await apiFetch("/data/");

    if (!res.ok) {
      throw new Error(`API Error: ${res.status}`);
    }

    const data = await res.json();
    setData(data);
  } catch (error) {
    console.error("Failed to fetch:", error);
    setError(error.message);
  } finally {
    setLoading(false);
  }
};
```

---

### 3. Loading و Error States

```jsx
// ✅ خوب - مدیریت کامل
const MyComponent = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return <EmptyState />;

  return <DataDisplay data={data} />;
};
```

---

## ⚡ عملکرد و بهینه‌سازی

### 1. useMemo برای محاسبات سنگین

```jsx
// ❌ بد - محاسبه هر بار
const ProcessList = ({ items }) => {
  const processedItems = items.map((item) => expensive(item));
  return <List items={processedItems} />;
};

// ✅ خوب - محاسبه تنها اگر items تغییر کند
import { useMemo } from "react";

const ProcessList = ({ items }) => {
  const processedItems = useMemo(
    () => items.map((item) => expensive(item)),
    [items],
  );
  return <List items={processedItems} />;
};
```

---

### 2. useCallback برای functions

```jsx
// ✅ خوب - تابع ثابت می‌ماند
const Parent = () => {
  const handleClick = useCallback(() => {
    console.log("Clicked");
  }, []);

  return <Child onClick={handleClick} />;
};
```

---

### 3. Lazy Loading

```jsx
// ✅ خوب - صفحات بزرگ را به صورت lazy load کن
const HomePage = lazy(() => import("./pages/quiz/manager/HomePage"));
const EditorPage = lazy(() => import("./pages/quiz/manager/EditorPage"));

<Suspense fallback={<RouteFallback />}>
  <HomePage />
</Suspense>;
```

---

## 🧪 تست‌کردن

### 1. Unit Testing

```jsx
import { render, screen } from "@testing-library/react";
import QuizHeader from "@/components/QuizHeader";

describe("QuizHeader", () => {
  test("نمایش عنوان کوئیز", () => {
    render(<QuizHeader title="تست" />);
    expect(screen.getByText("تست")).toBeInTheDocument();
  });
});
```

---

### 2. Integration Testing

```jsx
test("جریان کامل ورود", async () => {
  render(<AuthPage />);

  // وارد کردن اطلاعات
  fireEvent.change(screen.getByLabelText("نام کاربری"), {
    target: { value: "testuser" },
  });

  // کلیک بر روی ورود
  fireEvent.click(screen.getByText("ورود"));

  // بررسی شدن redirectها
  await waitFor(() => {
    expect(screen.getByText("داشبورد")).toBeInTheDocument();
  });
});
```

---

## ❌ خطاهای رایج

### 1. Props Drilling

```jsx
// ❌ بد - props از چندین سطح عبور می‌کند
<App>
  <Layout quizId={quizId}>
    <Section quizId={quizId}>
      <QuestionCard quizId={quizId} />
    </Section>
  </Layout>
</App>

// ✅ خوب - استفاده از Context
<ServerDataProvider>
  <App>
    <Layout>
      <Section>
        <QuestionCard /> {/* از useServerData استفاده می‌کند */}
      </Section>
    </Layout>
  </App>
</ServerDataProvider>
```

---

### 2. Infinite Loops

```jsx
// ❌ بد - infinite loop!
useEffect(() => {
  setData(data); // وابستگی انجام نشده
}); // بدون dependency array

// ✅ خوب
useEffect(() => {
  fetchData();
}, []); // تنها یک بار
```

---

### 3. Memory Leaks

```jsx
// ❌ بد - cleanup نشده
useEffect(() => {
  const interval = setInterval(() => {
    fetchData();
  }, 5000);
}, []);

// ✅ خوب - cleanup کردن
useEffect(() => {
  const interval = setInterval(() => {
    fetchData();
  }, 5000);

  return () => clearInterval(interval);
}, []);
```

---

## 📝 کوتاهی کد و کیفیت

### 1. Comments و Documentation

```jsx
// ✅ خوب - توضیح logic پیچیده
// هنگام دریافت لیدربورد، امتیازات را رتبه‌بندی می‌کنیم
const sortedLeaderboard = serverData.leaderboardResults.sort(
  (a, b) => b.score - a.score,
);
```

---

### 2. Console Logs

```jsx
// ❌ بد - console logs در production
console.log("Data:", data);

// ✅ خوب - استفاده از DEBUG mode
if (process.env.DEBUG) {
  console.log("Data:", data);
}
```

---

## 🚀 پیشنهادات برای توسعه‌دهندگان جدید

### وقتی شروع می‌کنی:

1. **مستندات را بخوان**: [FRONTEND_ARCHITECTURE_FA.md](FRONTEND_ARCHITECTURE_FA.md)
2. **ساختار را درک کن**: [FRONTEND_STRUCTURE_FA.md](FRONTEND_STRUCTURE_FA.md)
3. **مثال‌ها را بررسی کن**: صفحات موجود را تحلیل کن
4. **کوچک شروع کن**: یک کامپوننت ساده ایجاد کن
5. **Code Review طلب کن**: از اعضای تیم کمک بخواه

### Debugging Tips:

```jsx
// React DevTools استفاده کن
// Chrome DevTools
// Console logs (محدود)
// Breakpoints
// Network tab برای API requests
```

---

## 📚 منابع مفید

- [React Documentation](https://react.dev)
- [React Patterns](https://reactpatterns.com)
- [Clean Code in JavaScript](https://github.com/ryanmcdermott/clean-code-javascript)
- [WebSocket Best Practices](https://www.ably.io/topic/websockets)
