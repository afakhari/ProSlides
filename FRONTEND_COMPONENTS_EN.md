# Frontend Components Guide

## 📌 Component Types

ProSlides frontend uses three types of components:

### 1. UI Components (Including shadcn/ui)

Basic and reusable components for user interface.

**Examples:**

```
ui/Button.jsx          # Button
ui/Input.jsx           # Text input
ui/Modal.jsx           # Modal
ui/Card.jsx            # Card
ui/Badge.jsx           # Badge
```

**Features:**

- ✅ Highly customizable
- ✅ Consistent behavior across project
- ✅ Accessible (follows accessibility standards)

---

### 2. Global Components

Components used across multiple pages:

```
Header.jsx             # Page header
Footer.jsx             # Page footer
TopBar.jsx             # Top bar
SiteHeader.jsx         # Site header
SiteFooter.jsx         # Site footer
ShareMenu.jsx          # Share menu
```

**Usage Example:**

```jsx
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function MyPage() {
  return (
    <>
      <Header />
      <main>Page Content</main>
      <Footer />
    </>
  );
}
```

---

### 3. Presentation-Specific Components

Components for displaying questions and answers:

#### 3.1 QuizHeader

```jsx
import QuizHeader from "@/components/QuizHeader";

// Display quiz header
<QuizHeader quizTitle="Math Lesson" currentQuestion={5} totalQuestions={10} />;
```

**Props:**

- `quizTitle`: Quiz title
- `currentQuestion`: Current question number
- `totalQuestions`: Total number of questions

---

#### 3.2 LeaderboardModal

Modal for displaying player rankings:

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

- `isOpen`: Show/hide modal
- `onClose`: Close modal function
- `leaderboard`: Leaderboard data

---

#### 3.3 QuizManager

Component for managing quizzes by managers:

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

Display reaction animations (emoji):

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

Sidebar for displaying QR Code:

```jsx
import QRSidebar from "@/components/QRSidebar";

<QRSidebar roomId={roomId} accessCode={accessCode} playerCount={playerCount} />;
```

**Props:**

- `roomId`: Room ID
- `accessCode`: Access code for players
- `playerCount`: Connected player count

---

## 🔧 Creating New Components

### Example: Question Display Component

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
              className="w-full text-left"
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

**Important Points:**

- ✅ Components should be small and independent
- ✅ Accept all necessary Props
- ✅ Callback functions for Events
- ✅ Style with Tailwind CSS

---

## 📚 Common Patterns

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

  return <div>{isConnected ? "Connected" : "Disconnected"}</div>;
}
```

---

## 🎨 Tailwind and Styling Configuration

### Project Standard Colors

All colors are defined in `tailwind.config.cjs`:

```jsx
// Usage:
<div className="bg-primary text-white">Content</div>
<button className="bg-secondary hover:bg-secondary-dark">Button</button>
<span className="text-accent">Accent Text</span>
```

### Responsive Design

```jsx
<div
  className="
  grid 
  grid-cols-1       // 1 column on mobile
  sm:grid-cols-2    // 2 columns on tablet
  lg:grid-cols-3    // 3 columns on desktop
"
>
  {/* Content */}
</div>
```

---

## 📦 Component Dependencies

```
┌─────────────────────────────────────────┐
│     Pages                               │
│  - Uses multiple components             │
│  - Props drilling (may occur)           │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│  Composite Components                   │
│  - Uses UI + multiple components        │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│     UI Components                       │
│  - Independent and reusable             │
└─────────────────────────────────────────┘
```

---

## ⚠️ Common Mistakes

### ❌ Mistake 1: Component Too Large

```jsx
// ❌ Bad
export default function QuizPage() {
  // 500 lines of code!
  return (...)
}

// ✅ Good
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

### ❌ Mistake 2: Props Drilling

```jsx
// ❌ Bad - Props passed through multiple levels
<Page quizId={quizId}>
  <Layout quizId={quizId}>
    <QuestionCard quizId={quizId} />
  </Layout>
</Page>

// ✅ Good - Use Context
<ServerDataContext>
  <Page>
    <Layout>
      <QuestionCard /> {/* Uses useServerData */}
    </Layout>
  </Page>
</ServerDataContext>
```

### ❌ Mistake 3: Unnecessary State

```jsx
// ❌ Bad - Extra state
const [userData, setUserData] = useState(null);
const { serverData } = useServerData(); // Contains userData

// ✅ Good - Use Context directly
const { serverData } = useServerData();
const userData = serverData.users; // Extract from Context
```

---

## 🧪 Testing Components

### Simple Test Example

```jsx
import { render, screen, fireEvent } from "@testing-library/react";
import QuestionDisplay from "@/components/QuestionDisplay";

test("Display question and options", () => {
  const mockQuestion = {
    id: 1,
    title: "Test Question",
  };
  const mockOptions = [
    { id: 1, text: "Option 1" },
    { id: 2, text: "Option 2" },
  ];

  render(
    <QuestionDisplay
      question={mockQuestion}
      options={mockOptions}
      onSelectOption={jest.fn()}
    />,
  );

  expect(screen.getByText("Test Question")).toBeInTheDocument();
  expect(screen.getByText("Option 1")).toBeInTheDocument();
});
```

---

## 📖 Useful Resources

- [shadcn/ui Documentation](https://ui.shadcn.com)
- [React Patterns](https://reactpatterns.com)
- [Tailwind CSS Documentation](https://tailwindcss.com)
- [React Best Practices](https://react.dev/learn)
