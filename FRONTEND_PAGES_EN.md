# Frontend Main Pages Guide

## 📄 Pages Overview

Main pages in ProSlides project:

```
pages/
├── auth/                    # Authentication pages
├── landing/                 # Landing page
├── quiz/                    # Quiz management pages
├── presentation/            # Presentation pages
├── report/                  # Report pages
├── team/                    # Team pages
└── loading/                 # Loading pages
```

---

## 🔐 Authentication Pages (auth/)

### AuthPage.jsx

**Routes:**

- `/login` - User login
- `/signup` - New user registration
- `/auth` - General authentication page

**Features:**

- Login with username and password
- Register new users
- Forgot password

**Flow:**

```
1. User enters credentials
2. apiFetch("/auth/token/") sends request
3. JWT Token received
4. Token stored in localStorage
5. Redirect to HomePage
```

**Usage Example:**

```jsx
// A player login
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

**Route:** `/reset-password`

**Features:**

- Recover forgotten password
- Send verification link to email
- Change password

---

## 🏠 Landing Page (landing/)

### LandingPage.jsx

**Route:** `/`

**Features:**

- Display site information
- Login/Signup buttons
- Introduce project features

**Components Used:**

```jsx
<SiteHeader />           // Site header
<HeroSection />          // Introduction section
<FeaturesSection />      // Features section
<CTASection />           // Call-to-action buttons
<SiteFooter />           // Footer
```

---

## 📊 Quiz Pages (quiz/)

### HomePage.jsx

**Route:** `/:role/panel`

**Role:** Manager (Presenter)

**Features:**

- Display list of user's quizzes
- Create new quiz
- Delete and edit quizzes
- Start quiz presentation

**State:**

```jsx
const [quizzes, setQuizzes] = useState([]);
const [loading, setLoading] = useState(true);
const { serverData } = useServerData();
```

**Example:**

```jsx
useEffect(() => {
  // Fetch quiz list
  const fetchQuizzes = async () => {
    const res = await apiFetch("/quizzes/");
    const data = await res.json();
    setQuizzes(data);
  };
  fetchQuizzes();
}, []);

// Display quizzes in grid
{
  quizzes.map((quiz) => <QuizCard key={quiz.id} quiz={quiz} />);
}
```

---

### EditorPage.jsx

**Route:** `/:role/panel/:roomId`

**Role:** Manager

**Features:**

- Edit quiz questions
- Add new question
- Arrange questions
- Quiz preview

**Components Used:**

```jsx
<QuestionEditor />      // Question editor
<QuestionList />        // Question list
<PreviewPanel />        // Preview panel
```

---

## 🎮 Presentation Pages (presentation/)

Presentation pages divided into: **Manager** and **Player**

### Manager Pages

#### manager/JoinPage.jsx

**Route:** `/:role/presentation/:roomId`

**Features:**

- Manager enters room
- Verification before starting
- Choose role (manager/viewer)

---

#### manager/PickAnswerQuestion.jsx

**Features:**

- Display question to manager
- View player answers in real-time
- Control question timer
- Next/Previous buttons

**State:**

```jsx
const { serverData } = useServerData();
const { isConnected } = useWebSocket();

// Display current question
const currentQuestion = serverData.currentQuestion;

// View partial answers
const partialResults = serverData.partialQuestionResults;
```

---

#### manager/LeaderBoard.jsx

**Features:**

- Display live rankings
- Show player scores
- Auto-update

---

### Player Pages

#### player/JoinPage.jsx

**Features:**

- Join with access code
- Or scan QR Code
- Choose username

**Flow:**

```jsx
const handleJoin = async (accessCode, playerName) => {
  // Resolve access code
  const res = await apiFetch(
    `/quizzes/resolve-access-code/?access_code=${accessCode}`,
    { auth: false },
  );

  const { quiz_id, room_id } = await res.json();

  // Store and navigate to presentation
  navigate(`/player/presentation/${room_id}`);
};
```

---

#### player/PickAnswerQuestion.jsx

**Features:**

- Display question to player
- Select one option
- View answer status (pending/submitted)
- Countdown timer

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

**Features:**

- View own ranking
- Compare with other players
- Display current score

---

## 📈 Report Pages (report/)

### SessionDetail.jsx

**Route:** `/:role/panel/:quizId/report`

**Features:**

- Display session statistics
- Analytics graphs
- List of player answers
- Success charts

**API Calls:**

```jsx
useEffect(() => {
  const fetchReport = async () => {
    // Overall statistics
    const stats = await apiFetch(`/quizzes/${quizId}/stats/`);

    // Player answers
    const answers = await apiFetch(`/quizzes/${quizId}/answers/`);

    // Final leaderboard
    const leaderboard = await apiFetch(`/quizzes/${quizId}/leaderboard/`);
  };
}, [quizId]);
```

---

## 👥 Team Pages (team/)

### TeamPage.jsx

**Route:** `/team`

**Features:**

- Manage team members
- Add new user
- Change user roles
- Remove members

---

## ⏳ Loading Pages (loading/)

### LoadingPage.jsx

**Route:** `/loading`

**Features:**

- Show loading spinner
- Wait message
- Retry button

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

Some pages require authentication:

```jsx
// Higher Order Component for page protection
const ProtectedRoute = ({ children }) => {
  const { access } = getAuthHeaders();

  if (!access) {
    return <Navigate to="/login" />;
  }

  return children;
};

// Usage
<ProtectedRoute>
  <HomePage />
</ProtectedRoute>;
```

---

## 📊 Pages Flow

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

## 📚 Resources

- [React Router Documentation](https://reactrouter.com)
- [React Best Practices](https://react.dev/learn)
