# Best Practices and Development Guide

## 📋 Table of Contents

1. [Coding and Architecture](#coding-and-architecture)
2. [State Management](#state-management)
3. [API and Data Fetching](#api--data-fetching)
4. [Performance Optimization](#performance-optimization)
5. [Testing](#testing)
6. [Common Mistakes](#common-mistakes)

---

## 💻 Coding and Architecture

### 1. Single Responsibility Principle

Each file and component should have one responsibility:

```jsx
// ❌ Bad - Large component with many responsibilities
const QuizPresentation = () => {
  // Fetch data
  // Calculate score
  // Render UI
  // Manage WebSocket
  // ... 500 lines of code
};

// ✅ Good - Small, independent components
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

### 2. Clear Naming

```jsx
// ❌ Bad
const h = () => {};
const data = serverData.users;
const x = computeScore();

// ✅ Good
const handlePlayerJoin = () => {};
const activePlayersList = serverData.users;
const playerTotalScore = computeScore();
```

---

### 3. Use Const Instead of Let

```jsx
// ❌ Bad
let userName = "Ali";
let quizId = 123;

// ✅ Good - Only use when reassignment is needed
const userName = "Ali";
const quizId = 123;
let score = 0; // Only if it changes
```

---

### 4. Destructuring

```jsx
// ❌ Bad
const user = props.user;
const name = user.name;
const email = user.email;

// ✅ Good
const {
  user: { name, email },
} = props;
// Or better:
const { user } = props;
const { name, email } = user;
```

---

## 🎯 State Management

### 1. Use State Only When Necessary

```jsx
// ❌ Bad - Unnecessary state
const MyComponent = () => {
  const { currentQuestion } = useServerData();
  const [question, setQuestion] = useState(null);

  useEffect(() => {
    setQuestion(currentQuestion);
  }, [currentQuestion]);

  return <div>{question?.title}</div>;
};

// ✅ Good
const MyComponent = () => {
  const { currentQuestion } = useServerData();
  return <div>{currentQuestion?.title}</div>;
};
```

---

### 2. Structure State Properly

```jsx
// ❌ Bad - Too many state variables
const [name, setName] = useState("");
const [email, setEmail] = useState("");
const [phone, setPhone] = useState("");
const [address, setAddress] = useState("");

// ✅ Good - Group related state
const [userInfo, setUserInfo] = useState({
  name: "",
  email: "",
  phone: "",
  address: "",
});
```

---

### 3. Minimize Effects

```jsx
// ❌ Bad - Too many effects
useEffect(() => {
  fetchUsers();
}, []);

useEffect(() => {
  fetchQuizzes();
}, []);

useEffect(() => {
  fetchReports();
}, []);

// ✅ Good - Combine into one effect
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

## 📡 API and Data Fetching

### 1. Use apiFetch Helper

```jsx
// ✅ Correct - Use apiFetch helper
import { apiFetch } from "@/utils/apiFetch";

const res = await apiFetch("/quizzes/", {
  method: "POST",
  json: { title: "New Quiz" },
});

// Token is automatically added!
```

---

### 2. Error Handling

```jsx
// ❌ Bad - No error handling
const fetchData = async () => {
  const res = await apiFetch("/data/");
  const data = await res.json();
  setData(data);
};

// ✅ Good - Proper error handling
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

### 3. Loading and Error States

```jsx
// ✅ Good - Complete state management
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

## ⚡ Performance Optimization

### 1. useMemo for Heavy Computations

```jsx
// ❌ Bad - Computation happens every render
const ProcessList = ({ items }) => {
  const processedItems = items.map((item) => expensive(item));
  return <List items={processedItems} />;
};

// ✅ Good - Computation only when items change
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

### 2. useCallback for Functions

```jsx
// ✅ Good - Function stays same across renders
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
// ✅ Good - Lazy load large pages
const HomePage = lazy(() => import("./pages/quiz/manager/HomePage"));
const EditorPage = lazy(() => import("./pages/quiz/manager/EditorPage"));

<Suspense fallback={<RouteFallback />}>
  <HomePage />
</Suspense>;
```

---

## 🧪 Testing

### 1. Unit Testing

```jsx
import { render, screen } from "@testing-library/react";
import QuizHeader from "@/components/QuizHeader";

describe("QuizHeader", () => {
  test("displays quiz title", () => {
    render(<QuizHeader title="Test" />);
    expect(screen.getByText("Test")).toBeInTheDocument();
  });
});
```

---

### 2. Integration Testing

```jsx
test("complete login flow", async () => {
  render(<AuthPage />);

  // Enter credentials
  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: "testuser" },
  });

  // Click login
  fireEvent.click(screen.getByText("Login"));

  // Check redirection
  await waitFor(() => {
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });
});
```

---

## ❌ Common Mistakes

### 1. Props Drilling

```jsx
// ❌ Bad - Props passed through multiple levels
<App>
  <Layout quizId={quizId}>
    <Section quizId={quizId}>
      <QuestionCard quizId={quizId} />
    </Section>
  </Layout>
</App>

// ✅ Good - Use Context
<ServerDataProvider>
  <App>
    <Layout>
      <Section>
        <QuestionCard /> {/* Uses useServerData */}
      </Section>
    </Layout>
  </App>
</ServerDataProvider>
```

---

### 2. Infinite Loops

```jsx
// ❌ Bad - Infinite loop!
useEffect(() => {
  setData(data); // Missing dependency
}); // No dependency array

// ✅ Good
useEffect(() => {
  fetchData();
}, []); // Runs only once
```

---

### 3. Memory Leaks

```jsx
// ❌ Bad - No cleanup
useEffect(() => {
  const interval = setInterval(() => {
    fetchData();
  }, 5000);
}, []);

// ✅ Good - Cleanup
useEffect(() => {
  const interval = setInterval(() => {
    fetchData();
  }, 5000);

  return () => clearInterval(interval);
}, []);
```

---

## 📝 Code Quality and Cleanliness

### 1. Comments and Documentation

```jsx
// ✅ Good - Explain complex logic
// When receiving leaderboard, we sort scores
const sortedLeaderboard = serverData.leaderboardResults.sort(
  (a, b) => b.score - a.score,
);
```

---

### 2. Console Logs

```jsx
// ❌ Bad - Console logs in production
console.log("Data:", data);

// ✅ Good - Use DEBUG mode
if (process.env.DEBUG) {
  console.log("Data:", data);
}
```

---

## 🚀 Recommendations for New Developers

### When Starting:

1. **Read Documentation**: [FRONTEND_ARCHITECTURE_EN.md](FRONTEND_ARCHITECTURE_EN.md)
2. **Understand Structure**: [FRONTEND_STRUCTURE_EN.md](FRONTEND_STRUCTURE_EN.md)
3. **Review Examples**: Analyze existing pages
4. **Start Small**: Create a simple component
5. **Request Code Review**: Ask team members for feedback

### Debugging Tips:

```jsx
// Use React DevTools
// Use Chrome DevTools
// Limited console logs
// Set breakpoints
// Check Network tab for API requests
```

---

## 📚 Useful Resources

- [React Documentation](https://react.dev)
- [React Patterns](https://reactpatterns.com)
- [Clean Code in JavaScript](https://github.com/ryanmcdermott/clean-code-javascript)
- [WebSocket Best Practices](https://www.ably.io/topic/websockets)
