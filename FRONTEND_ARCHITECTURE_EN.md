# ProSlides Frontend Architecture

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Project Structure](#project-structure)
3. [Architecture Overview](#architecture-overview)
4. [Data Flow](#data-flow)
5. [Technologies Used](#technologies-used)
6. [Getting Started](#getting-started)

## 🎯 Project Overview

**ProSlides** is an interactive platform for conducting live Q&A sessions that provides the ability to present lessons and conduct real-time questions to large groups.

### Key Features:

- **Interactive Questions**: Respondents can answer multiple-choice or drawing questions
- **Live Leaderboard**: Real-time player rankings
- **Chat and Emoji Reactions**: Interaction between participants
- **Different Roles**: Manager (presenter) and Players (participants)
- **WebSocket Communication**: Real-time data transfer

## 📁 Project Structure

```
frontend/
├── src/
│   ├── assets/              # Images, icons
│   │   ├── avatars/         # User avatars
│   │   └── patterns/        # Background patterns
│   │
│   ├── components/          # Reusable components
│   │   ├── ui/              # Basic UI components (shadcn/ui)
│   │   ├── presentation/    # Presentation-related components
│   │   ├── Footer.jsx
│   │   ├── Header.jsx
│   │   ├── QuizHeader.jsx
│   │   ├── QuizManager.jsx
│   │   ├── LeaderboardModal.jsx
│   │   └── ... (other components)
│   │
│   ├── contexts/            # State Management (Context API)
│   │   ├── AudioContext.jsx      # Audio management
│   │   ├── WebSocketContext.jsx  # WebSocket connection
│   │   └── ServerDataContext.jsx # Server data
│   │
│   ├── hooks/               # Custom React Hooks
│   │   ├── useWebSocket.js      # WebSocket Context usage
│   │   └── useServerData.js     # Server Data usage
│   │
│   ├── pages/               # Main Pages (Page Components)
│   │   ├── auth/            # Authentication pages
│   │   │   ├── AuthPage.jsx
│   │   │   └── ResetPasswordPage.jsx
│   │   ├── landing/         # Landing page
│   │   ├── quiz/            # Quiz pages
│   │   │   └── manager/
│   │   ├── presentation/    # Presentation pages
│   │   │   ├── manager/
│   │   │   └── player/
│   │   ├── report/          # Report pages
│   │   ├── team/            # Team pages
│   │   └── loading/         # Loading pages
│   │
│   ├── routes/              # Route handlers
│   │   └── PresentationEntry.jsx
│   │
│   ├── services/            # Services and business logic
│   │   └── quizService.jsx
│   │
│   ├── utils/               # Utility functions
│   │   ├── api.js           # API URL configuration
│   │   ├── apiFetch.js      # HTTP requests
│   │   ├── auth.js          # Authentication management
│   │   └── colorUtils.js
│   │
│   ├── lib/                 # Helper libraries
│   │   └── utils.js
│   │
│   ├── data/                # Structured data
│   │   └── mockData.js      # Sample data
│   │
│   ├── App.jsx              # Root application component
│   ├── main.jsx             # Application entry point
│   ├── index.css            # Global styles
│   └── App.css
│
├── public/                  # Static files
├── package.json             # Project dependencies
├── vite.config.js           # Vite configuration
├── tailwind.config.cjs      # Tailwind CSS configuration
└── README.md
```

## 🏗️ Architecture Overview

### Architecture Layers:

```
┌────────────────────────────────────────────────────┐
│         Pages (Page Components)                    │
│ Auth | Landing | Quiz | Presentation | Report     │
└──────────────────┬────────────────────────────────┘
                   │
┌──────────────────▼────────────────────────────────┐
│      Shared Components (Components)                │
│  UI | QuizHeader | LeaderboardModal | ...         │
└──────────────────┬────────────────────────────────┘
                   │
┌──────────────────▼────────────────────────────────┐
│     Context API + Custom Hooks                    │
│ WebSocket | ServerData | Audio | useServerData    │
└──────────────────┬────────────────────────────────┘
                   │
┌──────────────────▼────────────────────────────────┐
│     Utilities and Services                        │
│  apiFetch | auth | colorUtils | quizService      │
└──────────────────┬────────────────────────────────┘
                   │
┌──────────────────▼────────────────────────────────┐
│      Django Backend API + WebSocket               │
│ Authentication | Quiz | Answers | Leaderboard     │
└────────────────────────────────────────────────────┘
```

## 🔄 Data Flow

### 1. Authentication and Login Flow

```
User → AuthPage → API Request → Django Backend
                       ↓
               JWT Token Received
                       ↓
            Store in localStorage
                       ↓
              Redirect to Dashboard
```

### 2. HTTP Request Flow

```
Component/Page
    ↓
useServerData Hook or Direct
    ↓
apiFetch() function
    ↓
getAuthHeaders() - Add JWT token
    ↓
fetch(API)
    ↓
Django Backend
    ↓
JSON Response
    ↓
ServerDataContext (Storage)
    ↓
Component Re-render
```

### 3. Real-Time Communication (WebSocket)

```
User → PresentationEntry
    ↓
Get room_id
    ↓
WebSocketContext.connect(room_id)
    ↓
WebSocket Connection (wss://present.proslides.ir/ws/...)
    ↓
Receive Messages (type: 1, 2, 3, 7, 8, 12...)
    ↓
ServerDataContext Update
    ↓
Automatic UI Re-render
```

### 4. WebSocket Message Types

| Type | Description                   | Usage                        |
| ---- | ----------------------------- | ---------------------------- |
| 1    | Final leaderboard results     | Display rankings             |
| 2    | Current question              | Display question and options |
| 3    | Partial question results      | Update answers in real-time  |
| 7    | List of connected users       | Update player count          |
| 8    | Complete question results     | Final question result        |
| 12   | Leaderboard results for Modal | Display in Modal             |

## 🛠️ Technologies Used

### Frontend Framework & Tools

- **React 19**: UI library
- **Vite**: Build tool and development server
- **React Router 7**: Routing
- **Tailwind CSS 4**: Styling
- **shadcn/ui**: Pre-built UI components

### State Management

- **React Context API**: State management
- **Custom Hooks**: Reusable logic

### WebSocket & API

- **WebSocket API**: Real-time communication
- **Fetch API**: HTTP requests
- **Axios**: (Used in some parts)

### UI/UX

- **Framer Motion**: Animations
- **Lucide React**: Icons
- **Emoji Picker**: Emoji selection

### Build & Dev

- **ESLint**: Code linting
- **PostCSS**: CSS processing
- **npm**: Dependency manager

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation and Setup

```bash
# Navigate to frontend folder
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Variables

API configuration in [src/utils/api.js](src/utils/api.js):

```javascript
// Development
const API_BASE = "http://localhost:8000/api";

// Production
const API_BASE = "https://api.proslides.ir/api";
```

## 📖 Additional Documentation

For detailed information, refer to the following documentation:

- [Detailed Project Structure](FRONTEND_STRUCTURE_EN.md)
- [Components Guide](FRONTEND_COMPONENTS_EN.md)
- [Context and Hooks](FRONTEND_CONTEXT_HOOKS_EN.md)
- [Main Pages](FRONTEND_PAGES_EN.md)
- [Best Practices and Development](FRONTEND_BEST_PRACTICES_EN.md)
