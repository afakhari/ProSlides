import {
  BrowserRouter as Router,
  Routes,
  Route,
  useParams,
} from "react-router-dom";
import { useState, useEffect } from "react";

import ManagerJoinPage from "./pages/presentation/manager/JoinPage";
import ManagerPickAnswerQuestion from "./pages/presentation/manager/PickAnswerQuestion";
import ManagerLeaderBoard from "./pages/presentation/manager/LeaderBoard";

import PlayerJoinPage from "./pages/presentation/player/JoinPage";
import PlayerPickAnswerQuestion from "./pages/presentation/player/PickAnswerQuestion";
import PlayerLeaderBoard from "./pages/presentation/player/LeaderBoard";

import Waiting from "./pages/loading/LoadingPage";

import { QuizSetup } from "./data/mockData";
import { WebSocketProvider } from "./contexts/WebSocketContext";
import { ServerDataProvider } from "./contexts/ServerDataContext";
import { useServerData } from "./hooks/useServerData";
import { useWebSocket } from "./hooks/useWebSocket";

import HomePage from "./pages/quiz/manager/HomePage";
import EditorPage from "./pages/quiz/manager/EditorPage";

export default function App() {
  return (
    <Router>
      <ServerDataProvider>
        <Routes>
          <Route
            path="/:roomId/:role/presentation"
            element={<PresentationRouter />}
          />
          {/* Manager/Role panel (supports both /manager and any role param) */}
          <Route path="/:roomId/:role/panel" element={<HomePage />} />
          <Route path="/:roomId/:role/panel/editor" element={<EditorPage />} />
          {/* Catch-all route for any undefined path */}
          <Route path="*" element={<Waiting />} />
        </Routes>
      </ServerDataProvider>
    </Router>
  );
}

/* ------------------------ Router Wrapper ------------------------ */
function PresentationRouter() {
  const { roomId, role } = useParams();

  const wsRole = role === "player" ? "player" : "manager";

  return (
    <WebSocketProvider role={wsRole}>
      <AppPresentation roomId={roomId} role={role} />
      <WSMessageHandler />
    </WebSocketProvider>
  );
}

/* ------------------------ Main Flow ------------------------ */
function AppPresentation({ roomId, role }) {
  const [data, setData] = useState({ type: "ManagerJoinPage" });
  const [currentSlide, setCurrentSlide] = useState(1);

  // Fetch full quiz once at top-level and transform to internal shape
  const [remoteQuiz, setRemoteQuiz] = useState(null);
  useEffect(() => {
    let mounted = true;
    const fetchQuiz = async () => {
      try {
        if (!roomId) return;
        const res = await fetch(
          `https://api.proslides.ir/api/quizzes/${roomId}/export/`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!mounted) return;
        if (data && Array.isArray(data.slides)) {
          // transform same as manager expects
          const mappedSlides = data.slides.map((slide) => {
            if (slide.slide_type === 1 && slide.question) {
              return {
                slide_type: 1,
                question_id: slide.slide_id,
                question_text: slide.question.text,
                question_time: slide.question.time_limit,
                max_point: slide.question.max_point,
                min_point: slide.question.min_point,
                options: (slide.question.options || []).map((opt) => ({
                  option_id: opt.option_id,
                  option_text: opt.text,
                  answer: opt.is_correct,
                  number_of_submits: opt.votes || 0,
                })),
              };
            }
            return { slide_type: 2 };
          });
          setRemoteQuiz({ slides: mappedSlides });
          console.log("[AppPresentation] remote quiz loaded", mappedSlides);
        }
      } catch (err) {
        console.warn("[AppPresentation] could not load remote quiz", err);
      }
    };
    fetchQuiz();
    return () => {
      mounted = false;
    };
  }, [roomId]);

  const quiz = remoteQuiz ?? QuizSetup;
  const isRemoteReady = !!quiz; // Always ready (remote or fallback)
  const totalSlides = quiz.slides.length;

  const {
    currentQuestion,
    leaderboardResults,
    questionResults,
    partialQuestionResults,
  } = useServerData();

  /* ------------------ EXACT NEXT/PREVIOUS FROM YOUR CODE ------------------ */

  const handleNext = () => {
    if (data.type === "ManagerJoinPage") {
      setData({ type: "ManagerPickAnswerQuestion" });
    } else {
      if (quiz.slides[currentSlide].slide_type === 2) {
        setData({ type: "ManagerLeaderBoard" });
      } else if (quiz.slides[currentSlide].slide_type === 1) {
        setData({ type: "ManagerPickAnswerQuestion" });
      }
      setCurrentSlide((prev) => Math.min(prev + 1, totalSlides));
    }
  };

  const handlePrevious = () => {
    if (data.type === "ManagerPickAnswerQuestion" && currentSlide === 1) {
      setData({ type: "ManagerJoinPage" });
    } else {
      if (quiz.slides[currentSlide - 2].slide_type === 2) {
        setData({ type: "ManagerLeaderBoard" });
      } else if (quiz.slides[currentSlide - 2].slide_type === 1) {
        setData({ type: "ManagerPickAnswerQuestion" });
      }
      setCurrentSlide((prev) => Math.max(prev - 1, 1));
    }
  };

  /* ---------------- Manager Rendering (EXACT LIKE ORIGINAL) ---------------- */
  const renderManager = () => {
    switch (data.type) {
      case "ManagerJoinPage":
        return (
          <ManagerJoinPage
            roomId={roomId}
            onNext={handleNext}
            onPrevious={handlePrevious}
            currentSlide={currentSlide}
            totalSlides={totalSlides}
          />
        );
      case "ManagerPickAnswerQuestion":
        return (
          <ManagerPickAnswerQuestion
            roomId={roomId}
            onNext={handleNext}
            onPrevious={handlePrevious}
            currentSlide={currentSlide}
            totalSlides={totalSlides}
            quiz={quiz}
            isRemoteReady={isRemoteReady}
          />
        );
      case "ManagerLeaderBoard":
        return (
          <ManagerLeaderBoard
            roomId={roomId}
            onNext={handleNext}
            onPrevious={handlePrevious}
            currentSlide={currentSlide}
            totalSlides={totalSlides}
            quiz={quiz}
            isRemoteReady={isRemoteReady}
          />
        );
      default:
        return <Waiting />;
    }
  };

  /* ---------------- Player Rendering (Server Driven) ---------------- */
  const renderPlayer = () => {
    console.log(
      "[App renderPlayer] currentQuestion:",
      !!currentQuestion,
      "leaderboardResults:",
      !!leaderboardResults
    );

    if (currentQuestion) {
      const result = questionResults || partialQuestionResults;
      return (
        <PlayerPickAnswerQuestion
          roomId={roomId}
          question={currentQuestion}
          result={result}
        />
      );
    }

    if (leaderboardResults) {
      console.log(
        "[App renderPlayer] Showing PlayerLeaderBoard with",
        (leaderboardResults.results || leaderboardResults)?.length,
        "players"
      );
      return (
        <PlayerLeaderBoard
          roomId={roomId}
          players={leaderboardResults.results || leaderboardResults}
        />
      );
    }

    return <PlayerJoinPage roomId={roomId} />;
  };

  /* ----------- Final Conditional Rendering ----------- */
  if (role === "manager") return renderManager();

  if (role === "player") return renderPlayer();

  return <Waiting />;
}

/* ---------------- WebSocket Handler ---------------- */
function WSMessageHandler() {
  const { lastMessage } = useWebSocket();
  const { processMessage } = useServerData();

  useEffect(() => {
    if (!lastMessage) return;
    processMessage(lastMessage);
  }, [lastMessage, processMessage]);

  return null;
}
