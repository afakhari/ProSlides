/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useCallback, useRef } from "react";

export const ServerDataContext = createContext(null);

const debugLog = (...args) => {
  if (import.meta.env.DEV) console.log(...args);
};

const debugWarn = (...args) => {
  if (import.meta.env.DEV) console.warn(...args);
};

const hasNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const isContentPayloadMessage = (message) => {
  if (!message || typeof message !== "object") return false;
  if (message.slide_type === 2) return true;

  const hasQuestionIdentity =
    message.question_id != null ||
    Array.isArray(message.options) ||
    Array.isArray(message.options_result);
  if (hasQuestionIdentity) return false;

  return (
    hasNonEmptyString(message.content_text) ||
    hasNonEmptyString(message.text) ||
    hasNonEmptyString(message.content_image_url) ||
    hasNonEmptyString(message.image_url) ||
    hasNonEmptyString(message.image) ||
    hasNonEmptyString(message.title) ||
    hasNonEmptyString(message.content_title)
  );
};

const normalizeContentPayload = (message) => ({
  ...message,
  slide_type: 2,
  title: message?.title || message?.content_title || "",
  content_text: message?.content_text || message?.text || "",
  content_image_url:
    message?.content_image_url || message?.image_url || message?.image || "",
});

export const ServerDataProvider = ({ children }) => {
  const lastProcessedMessageRef = useRef({ signature: null, at: 0 });
  // State برای ذخیره داده‌های دریافتی از سرور
  const [serverData, setServerData] = useState({
    users: [], // Type 7: لیست بازیکنان
    questionResults: null, // Type 8: نتایج سوال
    partialQuestionResults: null, // Type 3: partial/result for current question (options_result)
    leaderboardResults: null, // Type 1: نتایج لیدربورد
    managerLastLeaderboard: null, // آخرین لیدربورد معتبر برای منیجر
    modalLeaderboardResults: null, // Type 12: نتایج لیدربورد برای modal
    currentQuestion: null, // Type 2: سوال فعلی
    currentContent: null, // Slide type 2: content فعلی
    lastMessageType: null, // آخرین type دریافتی
    lastUpdateTime: null, // زمان آخرین به‌روزرسانی
  });

  // تابع برای به‌روزرسانی داده‌های بازیکنان (Type 7)
  const updateUsers = useCallback((users) => {
    setServerData((prev) => ({
      ...prev,
      users: users || [],
      lastMessageType: 7,
      lastUpdateTime: new Date().toISOString(),
    }));
    debugLog("[ServerData] Users updated:", users);
  }, []);

  // تابع برای به‌روزرسانی نتایج سوال (Type 8)
  const updateQuestionResults = useCallback((results) => {
    setServerData((prev) => ({
      ...prev,
      questionResults: results,
      lastMessageType: 8,
      lastUpdateTime: new Date().toISOString(),
    }));
    debugLog("[ServerData] Question results updated:", results);
  }, []);

  // تابع برای به‌روزرسانی نتایج جزئی (Type 3)
  const updatePartialQuestionResults = useCallback((results) => {
    setServerData((prev) => ({
      ...prev,
      partialQuestionResults: results,
      lastMessageType: 3,
      lastUpdateTime: new Date().toISOString(),
    }));
    debugLog(
      "[ServerData] Partial question results (type 3) updated:",
      results
    );
  }, []);

  // تابع برای به‌روزرسانی لیدربورد (Type 1)
  const updateLeaderboard = useCallback((results) => {
    setServerData((prev) => ({
      ...prev,
      leaderboardResults: results,
      managerLastLeaderboard: results, // ذخیره آخرین لیدربورد معتبر
      currentQuestion: null, // پاک کردن سوال فعلی تا لیدربورد نمایش داده شود
      currentContent: null,
      lastMessageType: 1,
      lastUpdateTime: new Date().toISOString(),
    }));
    debugLog("[ServerData] Leaderboard updated:", results);
  }, []);

  // تابع برای به‌روزرسانی لیدربورد modal (Type 12)
  const updateModalLeaderboard = useCallback((results) => {
    setServerData((prev) => ({
      ...prev,
      modalLeaderboardResults: results,
      lastMessageType: 12,
      lastUpdateTime: new Date().toISOString(),
    }));
    debugLog("[ServerData] Modal Leaderboard (Type 12) updated:", results);
  }, []);

  // تابع برای به‌روزرسانی سوال فعلی (Type 2)
  const updateCurrentQuestion = useCallback((question) => {
    setServerData((prev) => ({
      ...prev,
      currentQuestion: question,
      currentContent: null,
      leaderboardResults: null, // پاک کردن لیدربورد تا سوال نمایش داده شود
      questionResults: null,
      // reset any partial results from previous question when a new question arrives
      partialQuestionResults: null,
      lastMessageType: 2,
      lastUpdateTime: new Date().toISOString(),
    }));
    debugLog("[ServerData] Current question updated:", question);
  }, []);

  const updateCurrentContent = useCallback((content) => {
    setServerData((prev) => ({
      ...prev,
      currentContent: content,
      currentQuestion: null,
      leaderboardResults: null,
      partialQuestionResults: null,
      lastMessageType: 2,
      lastUpdateTime: new Date().toISOString(),
    }));
    debugLog("[ServerData] Current content updated:", content);
  }, []);

  // تابع کلی برای پردازش پیام از WebSocket
  const processMessage = useCallback(
    (message) => {
      if (!message) return;
      // Deduplicate exact same websocket payload arriving back-to-back.
      // This protects UI state from accidental double-processing.
      let signature = null;
      try {
        signature = JSON.stringify(message);
      } catch {
        signature = null;
      }
      if (signature) {
        const now = Date.now();
        const last = lastProcessedMessageRef.current;
        if (last.signature === signature && now - last.at < 300) {
          return;
        }
        lastProcessedMessageRef.current = { signature, at: now };
      }

      // اگر پیام فقط results دارد و type ندارد، آن را به عنوان لیدربورد در نظر بگیر
      if (!message.type && message.results && Array.isArray(message.results)) {
        debugLog(
          "[ServerData] Leaderboard message received (no type field):",
          message.results.length,
          "players"
        );
        updateLeaderboard(message.results);
        return;
      }

      // Content payload can arrive with/without type=2 depending on backend path.
      if ((!message.type || message.type === 2) && isContentPayloadMessage(message)) {
        updateCurrentContent(normalizeContentPayload(message));
        return;
      }

      if (!message.type) return;

      switch (message.type) {
        case 1: // Leaderboard Results
        case 11: // Leaderboard Results (Type 11)
          debugLog("[ServerData] Type 1/11 received, message:", message);
          if (message.results) {
            updateLeaderboard(message.results);
          } else {
            debugWarn(
              "[ServerData] Type 1/11 received but no results field"
            );
          }
          break;

        case 12: // Modal Leaderboard Results
          debugLog("[ServerData] Type 12 received, message:", message);
          if (message.results) {
            updateModalLeaderboard(message.results);
          } else {
            debugWarn("[ServerData] Type 12 received but no results field");
          }
          break;

        case 2: // New Question
          if (isContentPayloadMessage(message)) {
            updateCurrentContent(normalizeContentPayload(message));
          } else {
            updateCurrentQuestion(message);
          }
          break;

        case 3: // Partial question result/update (options_result)
          // Some servers send type 3 with only options_result (complementary to type 2)
          // Normalize to { question_id, optionsResult: [...] }
          updatePartialQuestionResults({
            question_id: message.question_id,
            optionsResult:
              message.options_result || message.optionsResult || [],
          });
          break;

        case 7: // Players List
          if (message.users) {
            updateUsers(message.users);
          }
          break;

        case 8: // Question Results
          updateQuestionResults({
            question_id: message.question_id,
            optionsResult: message.options || message.submit || [],
          });
          break;

        default:
          debugLog("[ServerData] Unhandled message type:", message.type);
      }
    },
    [
      updateUsers,
      updateQuestionResults,
      updateLeaderboard,
      updateModalLeaderboard,
      updateCurrentQuestion,
      updateCurrentContent,
      updatePartialQuestionResults,
    ]
  );

  // تابع برای پاک کردن داده‌ها
  const clearData = useCallback(() => {
    setServerData({
      users: [],
      questionResults: null,
      partialQuestionResults: null,
      leaderboardResults: null,
      managerLastLeaderboard: null,
      modalLeaderboardResults: null,
      currentQuestion: null,
      currentContent: null,
      lastMessageType: null,
      lastUpdateTime: null,
    });
    debugLog("[ServerData] Data cleared");
  }, []);

  const value = {
    // State
    serverData,
    users: serverData.users,
    questionResults: serverData.questionResults,
    partialQuestionResults: serverData.partialQuestionResults,
    leaderboardResults: serverData.leaderboardResults,
    managerLastLeaderboard: serverData.managerLastLeaderboard,
    modalLeaderboardResults: serverData.modalLeaderboardResults,
    currentQuestion: serverData.currentQuestion,
    currentContent: serverData.currentContent,
    lastMessageType: serverData.lastMessageType,
    lastUpdateTime: serverData.lastUpdateTime,

    // Actions
    updateUsers,
    updateQuestionResults,
    updatePartialQuestionResults,
    updateLeaderboard,
    updateModalLeaderboard,
    updateCurrentQuestion,
    updateCurrentContent,
    processMessage,
    clearData,
  };

  return (
    <ServerDataContext.Provider value={value}>
      {children}
    </ServerDataContext.Provider>
  );
};
