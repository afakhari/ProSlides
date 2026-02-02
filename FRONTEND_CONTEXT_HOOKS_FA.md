# راهنمای Context و Hooks

## 🌍 Context API - مدیریت State سراسری

سه Context اصلی در پروژه وجود دارد که برای مدیریت state استفاده می‌شوند:

---

## 1️⃣ WebSocketContext

**مسئولیت**: مدیریت اتصال WebSocket و دریافت پیام‌های real-time

### ساختار:

```jsx
// src/contexts/WebSocketContext.jsx

export const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children, role = "manager" }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [connectionError, setConnectionError] = useState(null);

  // تابع اتصال
  const connect = (sessionId) => { ... };

  // تابع ارسال پیام
  const sendMessage = (message) => { ... };

  // تابع قطع اتصال
  const disconnect = () => { ... };

  return (
    <WebSocketContext.Provider value={{ ... }}>
      {children}
    </WebSocketContext.Provider>
  );
};
```

### نحوه استفاده:

```jsx
import { useWebSocket } from "@/hooks/useWebSocket";

export default function MyComponent() {
  const { isConnected, lastMessage, sendMessage, connectionError } =
    useWebSocket();

  return (
    <div>
      <p>وضعیت: {isConnected ? "متصل ✓" : "قطع شده ✗"}</p>
      {connectionError && <p>خطا: {connectionError}</p>}
      <button onClick={() => sendMessage({ type: 1, data: "سلام" })}>
        ارسال پیام
      </button>
    </div>
  );
}
```

### متدهای اساسی:

| متد                  | توضیح              | مثال                     |
| -------------------- | ------------------ | ------------------------ |
| `connect(sessionId)` | اتصال به WebSocket | `connect("room123")`     |
| `sendMessage(msg)`   | ارسال پیام         | `sendMessage({type: 1})` |
| `disconnect()`       | قطع اتصال          | `disconnect()`           |

### دریافت پیام‌ها:

WebSocket خودکار پیام‌ها را دریافت می‌کند و به `ServerDataContext` منتقل می‌کند:

```javascript
// نمونه پیام دریافتی
{
  type: 1,           // نوع پیام
  data: {
    leaderboard: [...]
  }
}
```

---

## 2️⃣ ServerDataContext

**مسئولیت**: ذخیره و مدیریت تمام داده‌های دریافتی از سرور

### ساختار:

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

  // تابع‌های بروزرسانی
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

### نحوه استفاده:

```jsx
import { useServerData } from "@/hooks/useServerData";

export default function LeaderboardDisplay() {
  const { serverData, updateLeaderboardResults, updateCurrentQuestion } =
    useServerData();

  return (
    <div>
      <h2>بازیکنان ({serverData.users.length})</h2>
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

### داده‌های ذخیره‌شده:

| کلید                     | نوع    | توضیح                |
| ------------------------ | ------ | -------------------- |
| `users`                  | Array  | لیست کاربران متصل    |
| `currentQuestion`        | Object | سوال فعلی            |
| `questionResults`        | Object | نتایج کامل سوال      |
| `partialQuestionResults` | Object | نتایج جزئی (زنده)    |
| `leaderboardResults`     | Array  | رتبه‌بندی نهایی      |
| `lastMessageType`        | Number | آخرین نوع پیام       |
| `lastUpdateTime`         | String | زمان آخرین بروزرسانی |

---

## 3️⃣ AudioContext

**مسئولیت**: مدیریت صدا‌های notification و sound effects

### ساختار:

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

### نحوه استفاده:

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
      <button onClick={handleNewQuestion}>سوال جدید</button>
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

Hook برای دسترسی به WebSocket Context:

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

**استفاده:**

```jsx
const { isConnected, sendMessage } = useWebSocket();
```

---

### useServerData

Hook برای دسترسی به ServerData Context:

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

**استفاده:**

```jsx
const { serverData, updateUsers } = useServerData();
```

---

## 🔄 جریان Context

### Setup اولیه (در App.jsx)

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

### جریان داده‌ها

```
WebSocketProvider
  ↓ (دریافت پیام)
  ↓
ServerDataProvider
  ↓ (ذخیره و بروزرسانی)
  ↓
Components (استفاده از useServerData)
  ↓ (render)
UI Update
```

---

## 📋 مثال کامل: Leaderboard Component

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

  // هنگام تغییر لیدربورد، صدا پخش کن
  useEffect(() => {
    if (serverData.leaderboardResults && isEnabled) {
      playSound("leaderboard-updated");
    }
  }, [serverData.leaderboardResults]);

  if (!isConnected) {
    return <div className="text-red-500">قطع شده از سرور</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">رتبه‌بندی</h2>

      <button
        onClick={() => setShowModal(true)}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        نمایش لیدربورد
      </button>

      <LeaderboardModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        leaderboard={serverData.leaderboardResults}
      />

      <div className="mt-4">
        <p className="text-gray-600">{serverData.users.length} بازیکن متصل</p>
        <p className="text-sm text-gray-400">
          آخرین بروزرسانی: {serverData.lastUpdateTime}
        </p>
      </div>
    </div>
  );
}
```

---

## ⚠️ نکات مهم

### ✅ بهترین روش‌ها

1. **Hooks را فقط در Components استفاده کنید**

   ```jsx
   // ✅ صحیح
   function MyComponent() {
     const { serverData } = useServerData(); // داخل component
     return <div>{serverData.users.length}</div>;
   }
   ```

2. **Context Providers را سرتاسری قرار دهید**

   ```jsx
   // ✅ صحیح
   <ServerDataProvider>
     <App />
   </ServerDataProvider>
   ```

3. **Dependencies Array استفاده کنید**
   ```jsx
   // ✅ صحیح
   useEffect(() => {
     // ...
   }, [serverData.currentQuestion]); // وقتی سوال تغییر کرد
   ```

### ❌ اشتباهات رایج

1. **استفاده از Hook خارج از Provider**

   ```jsx
   // ❌ غلط - Error!
   const x = useServerData(); // خارج از ServerDataProvider
   ```

2. **فراموش کردن error handling**

   ```jsx
   // ❌ غلط
   const { serverData } = useServerData();
   return <div>{serverData.users.length}</div>; // ممکن null باشد

   // ✅ صحیح
   const { serverData } = useServerData();
   return <div>{serverData?.users?.length || 0}</div>;
   ```

---

## 📊 جدول مرجع

| Context           | هدف             | Hook          |
| ----------------- | --------------- | ------------- |
| WebSocketContext  | اتصال real-time | useWebSocket  |
| ServerDataContext | داده‌های سرور   | useServerData |
| AudioContext      | مدیریت صدا      | useAudio      |

---

## 📚 منابع

- [React Context Documentation](https://react.dev/reference/react/useContext)
- [Custom Hooks in React](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
