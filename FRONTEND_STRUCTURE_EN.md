# Frontend Detailed Project Structure

## 📂 Detailed Folder Inspection

### 1️⃣ The `src/` Folder

#### 1.1 `src/pages/` - Main Pages

Each page is a separate route and usually contains more complex logic:

```
pages/
├── auth/
│   ├── AuthPage.jsx              # Login/Signup page
│   └── ResetPasswordPage.jsx     # Password recovery page
│
├── landing/
│   └── LandingPage.jsx           # Homepage
│
├── quiz/
│   └── manager/
│       ├── HomePage.jsx          # Manager quiz list
│       └── EditorPage.jsx        # Quiz editor
│
├── presentation/
│   ├── manager/
│   │   ├── JoinPage.jsx          # Manager room entry
│   │   ├── PickAnswerQuestion.jsx # Display multiple-choice question
│   │   └── LeaderBoard.jsx       # Display leaderboard
│   │
│   └── player/
│       ├── JoinPage.jsx          # Player room entry
│       ├── PickAnswerQuestion.jsx # Answer question
│       └── LeaderBoard.jsx       # View rankings
│
├── report/
│   └── SessionDetail.jsx         # Session details and report
│
├── team/
│   └── TeamPage.jsx              # Team management page
│
└── loading/
    └── LoadingPage.jsx           # Loading/Waiting page
```

**Key Points:**

- Each page can use `useServerData()` and `useWebSocket()`
- Presentation pages are usually routed through `PresentationEntry`
- Lazy loading is used for performance optimization

---

#### 1.2 `src/components/` - Shared Components

```
components/
├── ui/                           # Basic UI components (shadcn/ui)
│   ├── Button.jsx
│   ├── Input.jsx
│   ├── Modal.jsx
│   └── ... (other UI components)
│
├── presentation/
│   ├── QuestionDisplay.jsx       # Display question
│   ├── AnswerOptions.jsx         # Answer options
│   ├── QuestionTimer.jsx         # Question timer
│   └── ... (other presentation components)
│
├── Header.jsx                    # Page header
├── Footer.jsx                    # Page footer
├── SiteHeader.jsx                # Site header
├── SiteFooter.jsx                # Site footer
├── QuizHeader.jsx                # Quiz header
├── QuizManager.jsx               # Quiz management
├── LeaderboardModal.jsx          # Leaderboard modal
├── TopBar.jsx                    # Top bar
├── QRSidebar.jsx                 # QR Code sidebar
├── ShareMenu.jsx                 # Share menu
├── ReactionEffects.jsx           # Reaction animations
└── Seo.jsx                       # SEO optimization
```

**Features:**

- Reusable and independent UI components
- Presentation-specific logic components
- Props-based configuration

---

#### 1.3 `src/contexts/` - State Management

Three main contexts for state management:

```
contexts/
├── WebSocketContext.jsx          # WebSocket connection
├── ServerDataContext.jsx         # Server data
└── AudioContext.jsx              # Audio management
```

**Details:**

**WebSocketContext:**

- Manages WebSocket connection
- Send and receive messages
- Handles reconnection

**ServerDataContext:**

- Stores server data
- Manages state for users, questions, leaderboard
- Update functions for each message type

**AudioContext:**

- Play notification sounds
- Control sound effects

---

#### 1.4 `src/hooks/` - Custom Hooks

```
hooks/
├── useWebSocket.js               # WebSocket Context usage
└── useServerData.js              # ServerData Context usage
```

**Usage:**

```jsx
// Use in component
const { isConnected, sendMessage } = useWebSocket();
const { serverData, updateUsers } = useServerData();
```

---

#### 1.5 `src/utils/` - Helper Functions

```
utils/
├── api.js                        # API URL configuration
├── apiFetch.js                   # HTTP requests
├── auth.js                       # Authentication management
└── colorUtils.js                 # Color functions
```

**Details:**

**apiFetch.js:**

```javascript
// Usage:
const res = await apiFetch("/quizzes/", {
  method: "POST",
  json: { title: "Untitled" },
});
```

**auth.js:**

- Store and retrieve JWT tokens
- Manage token expiration
- Logout handling

---

#### 1.6 `src/services/` - Business Logic

```
services/
└── quizService.jsx               # Quiz-related services
```

These files contain complex logic and business operations.

---

#### 1.7 `src/lib/` and `src/data/`

```
lib/
├── utils.js                      # General utilities
└── colorUtils.js                 # Color utilities

data/
└── mockData.js                   # Sample data for development
```

---

### 2️⃣ The `public/` Folder

Static files used as-is:

```
public/
├── robots.txt                    # Search engine directives
├── sitemap.xml                   # Site sitemap
├── site.webmanifest              # PWA configuration
└── fonts/                        # Custom fonts
```

---

### 3️⃣ Configuration Files

```
frontend/
├── package.json                  # Dependencies and scripts
├── vite.config.js                # Vite configuration
├── tailwind.config.cjs           # Tailwind configuration
├── postcss.config.cjs            # PostCSS configuration
├── eslint.config.js              # ESLint configuration
├── jsconfig.json                 # JavaScript configuration
└── components.json               # shadcn/ui configuration
```

---

## 🔌 Key Connection Points

### Entry Point

```
main.jsx
  ↓
App.jsx
  ↓
<Router>
  <Suspense>
    <Routes>
```

### Complete Flow from Login to Data Display:

```
1. Page loads (e.g., AuthPage)
2. User logs in and sends credentials
3. apiFetch() sends request and receives token
4. Token is stored in localStorage
5. New page loads (e.g., HomePage)
6. WebSocketProvider activates
7. PresentationEntry router gets room ID
8. WebSocket connection established
9. Real-time messages received
10. ServerDataContext stores data
11. Components re-render
```

---

## 📊 File Reference Table

| Path          | Type         | Purpose                 |
| ------------- | ------------ | ----------------------- |
| `pages/`      | Pages        | All main routes         |
| `components/` | Component    | Reusable components     |
| `contexts/`   | State        | Global state management |
| `hooks/`      | Hook         | Reusable logic          |
| `utils/`      | Functions    | General utilities       |
| `services/`   | Logic        | Complex business logic  |
| `assets/`     | Static Files | Images and fonts        |
| `data/`       | Data         | Structured data         |
