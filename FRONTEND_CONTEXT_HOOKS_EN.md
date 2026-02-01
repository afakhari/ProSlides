# Context and Hooks Guide

## 🌍 Context API - Global State Management

Three main contexts are used in the project for state management:

---

## 1️⃣ WebSocketContext

**Responsibility**: Manage WebSocket connection and receive real-time messages

### Structure:

```jsx
// src/contexts/WebSocketContext.jsx

export const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children, role = "manager" }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [connectionError, setConnectionError] = useState(null);

  // Connection function
  const connect = (sessionId) => { ... };

  // Send message function
  const sendMessage = (message) => { ... };

  // Disconnect function
  const disconnect = () => { ... };

  return (
    <WebSocketContext.Provider value={{ ... }}>
      {children}
    </WebSocketContext.Provider>
  );
};
```

### Usage:

```jsx
import { useWebSocket } from "@/hooks/useWebSocket";

export default function MyComponent() {
  const { isConnected, lastMessage, sendMessage, connectionError } =
    useWebSocket();

  return (
    <div>
      <p>Status: {isConnected ? "Connected ✓" : "Disconnected ✗"}</p>
      {connectionError && <p>Error: {connectionError}</p>}
      <button onClick={() => sendMessage({ type: 1, data: "Hello" })}>
        Send Message
      </button>
    </div>
  );
}
```

### Basic Methods:

| Method               | Description          | Example                  |
| -------------------- | -------------------- | ------------------------ |
| `connect(sessionId)` | Connect to WebSocket | `connect("room123")`     |
| `sendMessage(msg)`   | Send message         | `sendMessage({type: 1})` |
| `disconnect()`       | Disconnect           | `disconnect()`           |

### Message Reception:

WebSocket automatically receives messages and forwards them to `ServerDataContext`:

```javascript
// Sample received message
{
  type: 1,           // Message type
  data: {
    leaderboard: [...]
  }
}
```

---

## 2️⃣ ServerDataContext

**Responsibility**: Store and manage all data received from the server

### Structure:

```jsx
// src/contexts/ServerDataContext.jsx

export const ServerDataContext = createContext(null);

export const ServerDataProvider = ({ children }) => {
  const [serverData, setServerData] = useState({
    users: [],                      // Type 7
    questionResults: null,          // Type 8
    partialQuestionResults: null,   // Type 3
    leaderboardResults: null,       // Type 1
    currentQuestion: null,          // Type 2
    lastMessageType: null,
    lastUpdateTime: null,
  });

  // Update functions
  const updateUsers = (users) => { ... };
  const updateQuestionResults = (results) => { ... };
  const updateCurrentQuestion = (question) => { ... };
  const updateLeaderboardResults = (results) => { ... };

  return (
    <ServerDataContext.Provider value={{ serverData, updateUsers, ... }}>
      {children}
    </ServerDataContext.Provider>
  );
};
```

### Usage:

```jsx
import { useServerData } from "@/hooks/useServerData";

export default function LeaderboardDisplay() {
  const { serverData, updateLeaderboardResults, updateCurrentQuestion } =
    useServerData();

  return (
    <div>
      <h2>Players ({serverData.users.length})</h2>
      <ul>
        {serverData.users.map((user) => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>

      {serverData.currentQuestion && (
        <div>
          <h3>{serverData.currentQuestion.title}</h3>
          <p>{serverData.currentQuestion.description}</p>
        </div>
      )}
    </div>
  );
}
```

### Stored Data:

| Key                      | Type   | Description               |
| ------------------------ | ------ | ------------------------- |
| `users`                  | Array  | List of connected users   |
| `currentQuestion`        | Object | Current question          |
| `questionResults`        | Object | Complete question results |
| `partialQuestionResults` | Object | Partial results (live)    |
| `leaderboardResults`     | Array  | Final rankings            |
| `lastMessageType`        | Number | Last message type         |
| `lastUpdateTime`         | String | Time of last update       |

---

## 3️⃣ AudioContext

**Responsibility**: Manage notification sounds and sound effects

### Structure:

```jsx
// src/contexts/AudioContext.jsx

export const AudioContext = createContext(null);

export const AudioProvider = ({ children }) => {
  const [isEnabled, setIsEnabled] = useState(true);

  const playSound = (soundName) => { ... };
  const toggleAudio = () => { ... };

  return (
    <AudioContext.Provider value={{ playSound, toggleAudio, isEnabled }}>
      {children}
    </AudioContext.Provider>
  );
};
```

### Usage:

```jsx
import { useAudio } from "@/contexts/AudioContext";

export default function QuestionComponent() {
  const { playSound, isEnabled } = useAudio();

  const handleNewQuestion = () => {
    if (isEnabled) {
      playSound("new-question");
    }
  };

  return (
    <div>
      <button onClick={handleNewQuestion}>New Question</button>
      <input
        type="checkbox"
        checked={isEnabled}
        onChange={() => playSound("toggle")}
      />
    </div>
  );
}
```

---

## 🪝 Custom Hooks

### useWebSocket

Hook to access WebSocket Context:

```jsx
// src/hooks/useWebSocket.js

import { useContext } from "react";
import { WebSocketContext } from "../contexts/WebSocketContext";

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within WebSocketProvider");
  }
  return context;
};
```

**Usage:**

```jsx
const { isConnected, sendMessage } = useWebSocket();
```

---

### useServerData

Hook to access ServerData Context:

```jsx
// src/hooks/useServerData.js

import { useContext } from "react";
import { ServerDataContext } from "../contexts/ServerDataContext";

export const useServerData = () => {
  const context = useContext(ServerDataContext);
  if (!context) {
    throw new Error("useServerData must be used within ServerDataProvider");
  }
  return context;
};
```

**Usage:**

```jsx
const { serverData, updateUsers } = useServerData();
```

---

## 🔄 Context Flow

### Initial Setup (in App.jsx)

```jsx
// App.jsx

import { AudioProvider } from "./contexts/AudioContext";
import { WebSocketProvider } from "./contexts/WebSocketContext";
import { ServerDataProvider } from "./contexts/ServerDataContext";

export default function App() {
  return (
    <AudioProvider>
      <WebSocketProvider role="manager">
        <ServerDataProvider>
          <Router>{/* Routes */}</Router>
        </ServerDataProvider>
      </WebSocketProvider>
    </AudioProvider>
  );
}
```

### Data Flow

```
WebSocketProvider
  ↓ (Receive message)
  ↓
ServerDataProvider
  ↓ (Store and update)
  ↓
Components (useServerData)
  ↓ (render)
UI Update
```

---

## 📋 Complete Example: Leaderboard Component

```jsx
import React, { useEffect, useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useServerData } from "@/hooks/useServerData";
import { useAudio } from "@/contexts/AudioContext";
import LeaderboardModal from "@/components/LeaderboardModal";

export default function LeaderboardDisplay() {
  const { isConnected } = useWebSocket();
  const { serverData } = useServerData();
  const { playSound, isEnabled } = useAudio();
  const [showModal, setShowModal] = useState(false);

  // Play sound when leaderboard updates
  useEffect(() => {
    if (serverData.leaderboardResults && isEnabled) {
      playSound("leaderboard-updated");
    }
  }, [serverData.leaderboardResults]);

  if (!isConnected) {
    return <div className="text-red-500">Disconnected from server</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Rankings</h2>

      <button
        onClick={() => setShowModal(true)}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Show Leaderboard
      </button>

      <LeaderboardModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        leaderboard={serverData.leaderboardResults}
      />

      <div className="mt-4">
        <p className="text-gray-600">
          {serverData.users.length} players connected
        </p>
        <p className="text-sm text-gray-400">
          Last update: {serverData.lastUpdateTime}
        </p>
      </div>
    </div>
  );
}
```

---

## ⚠️ Important Notes

### ✅ Best Practices

1. **Use Hooks only in Components**

   ```jsx
   // ✅ Correct
   function MyComponent() {
     const { serverData } = useServerData(); // Inside component
     return <div>{serverData.users.length}</div>;
   }
   ```

2. **Place Context Providers at the root**

   ```jsx
   // ✅ Correct
   <ServerDataProvider>
     <App />
   </ServerDataProvider>
   ```

3. **Use Dependencies Array**
   ```jsx
   // ✅ Correct
   useEffect(() => {
     // ...
   }, [serverData.currentQuestion]); // When question changes
   ```

### ❌ Common Mistakes

1. **Using Hook outside Provider**

   ```jsx
   // ❌ Wrong - Error!
   const x = useServerData(); // Outside ServerDataProvider
   ```

2. **Forgetting error handling**

   ```jsx
   // ❌ Wrong
   const { serverData } = useServerData();
   return <div>{serverData.users.length}</div>; // May be null

   // ✅ Correct
   const { serverData } = useServerData();
   return <div>{serverData?.users?.length || 0}</div>;
   ```

---

## 📊 Reference Table

| Context           | Purpose              | Hook          |
| ----------------- | -------------------- | ------------- |
| WebSocketContext  | Real-time connection | useWebSocket  |
| ServerDataContext | Server data          | useServerData |
| AudioContext      | Audio management     | useAudio      |

---

## 📚 Resources

- [React Context Documentation](https://react.dev/reference/react/useContext)
- [Custom Hooks in React](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
