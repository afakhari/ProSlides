import React, { useState, useEffect, lazy } from "react";
import { useParams } from "react-router-dom";

import { QuizSetup } from "../data/mockData";
import { WebSocketProvider } from "../contexts/WebSocketContext";
import { ServerDataProvider } from "../contexts/ServerDataContext";
import { useServerData } from "../hooks/useServerData";
import { useWebSocket } from "../hooks/useWebSocket";
import { AudioProvider, useAudio } from "../contexts/AudioContext";
import { apiFetch } from "../utils/apiFetch";
import { hasLeaderboardEntries } from "../pages/presentation/utils/leaderboardUtils";

import Waiting from "../pages/loading/LoadingPage";
import FinalLeaderboard from "../pages/presentation/manager/FinalLeaderboard";

const ManagerJoinPage = lazy(() =>
  import("../pages/presentation/manager/JoinPage")
);
const ManagerPickAnswerQuestion = lazy(() =>
  import("../pages/presentation/manager/PickAnswerQuestion")
);
const ManagerLeaderBoard = lazy(() =>
  import("../pages/presentation/manager/LeaderBoard")
);
const ManagerContentSlide = lazy(() =>
  import("../pages/presentation/manager/ContentSlide")
);
const PlayerJoinPage = lazy(() =>
  import("../pages/presentation/player/JoinPage")
);
const PlayerPickAnswerQuestion = lazy(() =>
  import("../pages/presentation/player/PickAnswerQuestion")
);
const PlayerLeaderBoard = lazy(() =>
  import("../pages/presentation/player/LeaderBoard")
);
const PlayerContentSlide = lazy(() =>
  import("../pages/presentation/player/ContentSlide")
);

export default function PresentationEntry({ mode }) {
  return (
    <ServerDataProvider>
      {mode === "accessCode" ? <AccessCodeResolver /> : <PresentationRouter />}
    </ServerDataProvider>
  );
}

/* ------------------------ Access Code Resolver ------------------------ */
function AccessCodeResolver() {
  const { accessCode } = useParams();
  const [status, setStatus] = useState("loading"); // loading | error | success
  const [resolvedData, setResolvedData] = useState(null);
  const [resolvedMeta, setResolvedMeta] = useState(null);

  useEffect(() => {
    let mounted = true;
    const resolveCode = async () => {
      try {
        const res = await apiFetch(
          `/quizzes/resolve-access-code/?access_code=${encodeURIComponent(
            accessCode
          )}`,
          { auth: false }
        );
        const data = await res.json();

        if (!mounted) return;

        if (data.quiz_id) {
          // Access code valid - store quiz_id and show player presentation
          setResolvedData(data);
          setResolvedMeta({
            quiz_id: data.quiz_id,
            title: data.title || "",
            access_code: accessCode,
            background: {
              color: data.background_color || "#1e1e2e",
              image: data.background_image_url || "",
              text_color: data.text_color || "#111827",
            },
            music_url: data.music_url || "",
            slides: [],
            text_color: data.text_color || "#111827",
          });
          setStatus("success");
        } else {
          // Invalid access code
          setStatus("error");
        }
      } catch (err) {
        console.error("[AccessCodeResolver] Error:", err);
        if (mounted) setStatus("error");
      }
    };

    resolveCode();
    return () => {
      mounted = false;
    };
  }, [accessCode]);

  // Loading state
  if (status === "loading") {
    return <Waiting message="Joining..." />;
  }

  // Error state
  if (status === "error") {
    return <Waiting message="Invalid access code" />;
  }

  // Success - render player presentation directly (URL stays the same)
  if (status === "success" && resolvedData) {
    return (
      <AudioProvider>
        <WebSocketProvider role="player">
          <AppPresentation
            roomId={String(resolvedData.quiz_id)}
            role="player"
            initialQuizData={resolvedMeta}
          />
          <WSMessageHandler />
        </WebSocketProvider>
      </AudioProvider>
    );
  }

  return <Waiting />;
}

/* ------------------------ Router Wrapper ------------------------ */
function PresentationRouter() {
  const { roomId, role } = useParams();
  const wsRole = role === "player" ? "player" : "manager";

  return (
    <AudioProvider>
      <WebSocketProvider role={wsRole}>
        <AppPresentation roomId={roomId} role={role} />
        <WSMessageHandler />
      </WebSocketProvider>
    </AudioProvider>
  );
}

/* ------------------------ Main Flow ------------------------ */
function AppPresentation({ roomId, role, initialQuizData }) {
  const playerActiveSlideSeenKey = `presentation_player_seen_active_v1:${String(
    roomId || "unknown"
  )}`;
  const getInitialSeenActive = () => {
    if (role !== "player") return false;
    try {
      return sessionStorage.getItem(playerActiveSlideSeenKey) === "1";
    } catch {
      return false;
    }
  };
  const [data, setData] = useState({ type: "ManagerJoinPage" });
  const [currentSlide, setCurrentSlide] = useState(1);
  const [playerHasSeenActiveSlide, setPlayerHasSeenActiveSlide] = useState(
    getInitialSeenActive
  );

  // Fetch full quiz once at top-level and transform to internal shape
  const [remoteQuiz, setRemoteQuiz] = useState(initialQuizData || null);

  // Initialize remoteQuiz with initialQuizData if available (for player)
  useEffect(() => {
    if (initialQuizData && role === "player") {
      // Handle potential flat structure or nested structure for background
      const rawBg = initialQuizData.background || {};
      const background = {
        color: rawBg.color || initialQuizData.background_color || "#1e1e2e",
        image:
          rawBg.image ||
          initialQuizData.background_image ||
          initialQuizData.background_image_url ||
          "",
      };

      setRemoteQuiz((prev) => prev || {
        quiz_id: initialQuizData.quiz_id,
        title: initialQuizData.title || "",
        access_code: initialQuizData.access_code || "",
        background: background,
        music_url: initialQuizData.music_url || "",
        slides: [], // Player doesn't need full slides initially
      });
    }
  }, [initialQuizData, role]);

  useEffect(() => {
    let mounted = true;
    const fetchQuiz = async () => {
      try {
        if (!roomId) return;

        // If we already have initial data for player, we might skip full fetch or do it in background
        // But if user wants ONLY this API for player, we skip fetch for player
        if (role === "player") return;

        const res = await apiFetch(`/quizzes/${roomId}/export/`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!mounted) return;
        if (data && Array.isArray(data.slides)) {
          // Transform API format to internal format
          const mappedSlides = data.slides.map((slide) => {
            if (slide.slide_type === 1 && slide.question) {
              const q = slide.question;
              return {
                slide_type: 1,
                slide_id: slide.slide_id,
                question_id: q.question_id,
                question_text: q.text,
                question_title: q.title || "",
                question_time: q.time_limit,
                max_point: q.max_point,
                min_point: q.min_point,
                access_code: q.access_code,
                // New fields from API
                question_type: q.question_type, // "single" or "multiple"
                has_multiple: q.question_type === "multiple",
                image_url: q.image_url || "",
                faster_answers_more_points: q.faster_answers_more_points,
                partial_scoring: q.partial_scoring,
                show_leaderboard_after: slide.show_leaderboard_after,
                // Leaderboard data from API
                leaderboard: slide.leaderboard || [],
                options: (q.options || []).map((opt) => ({
                  option_id: opt.option_id,
                  option_text: opt.text,
                  answer: opt.is_correct,
                  number_of_submits: opt.votes || 0,
                  image_url: opt.image_url || "",
                  order: opt.order,
                })),
              };
            }
            // Content slide or leaderboard slide
            return {
              slide_type: slide.slide_type || 2,
              slide_id: slide.slide_id,
              title: slide.title || "",
              content_text: slide.content_text || "",
              content_image_url: slide.content_image_url || "",
              leaderboard: slide.leaderboard || [],
            };
          });

          // Store quiz metadata as well
          const quizData = {
            quiz_id: data.quiz_id,
            title: data.title,
            access_code: data.access_code || "",
            background: data.background || { color: "#1e1e2e", image: "", text_color: "#111827" },
            music_url: data.music_url || "",
            slides: mappedSlides,
            text_color: data.text_color || data.background?.text_color || "#111827",
          };

          setRemoteQuiz(quizData);
        }
      } catch (err) {
        console.error("[AppPresentation] could not load remote quiz", err);
      }
    };
    fetchQuiz();
    return () => {
      mounted = false;
    };
  }, [role, roomId, initialQuizData]);

  const quiz = remoteQuiz ?? QuizSetup;
  const isRemoteReady = !!quiz; // Always ready (remote or fallback)
  const totalSlides = quiz.slides.length;

  // Set quiz music when loaded
  const { setQuizMusic } = useAudio();
  useEffect(() => {
    if (remoteQuiz?.music_url) {
      setQuizMusic(remoteQuiz.music_url);
    }
  }, [remoteQuiz?.music_url, setQuizMusic]);

  const {
    users,
    currentQuestion,
    currentContent,
    leaderboardResults,
    questionResults,
    partialQuestionResults,
    modalLeaderboardResults,
    lastMessageType,
  } = useServerData();
  const { isConnected } = useWebSocket();
  const [managerHasSyncedState, setManagerHasSyncedState] = useState(
    role !== "manager"
  );
  useEffect(() => {
    if (role !== "player") return;
    if (currentQuestion || currentContent) {
      setPlayerHasSeenActiveSlide(true);
      try {
        sessionStorage.setItem(playerActiveSlideSeenKey, "1");
      } catch {
        // ignore storage errors
      }
    }
  }, [role, currentQuestion, currentContent, playerActiveSlideSeenKey]);

  useEffect(() => {
    if (role !== "manager") return;
    if (managerHasSyncedState) return;

    const hasLiveSignal =
      lastMessageType != null ||
      !!currentQuestion ||
      !!currentContent ||
      hasLeaderboardEntries(leaderboardResults) ||
      (Array.isArray(users) && users.length > 0);

    if (hasLiveSignal) {
      setManagerHasSyncedState(true);
      return;
    }

    const timer = setTimeout(() => {
      setManagerHasSyncedState(true);
    }, isConnected ? 1200 : 2200);

    return () => clearTimeout(timer);
  }, [
    role,
    managerHasSyncedState,
    lastMessageType,
    currentQuestion,
    currentContent,
    leaderboardResults,
    users,
    isConnected,
  ]);

  // Sync manager slide index with server question id to avoid UI mismatches
  useEffect(() => {
    if (role !== "manager") return;
    if (!currentQuestion || !quiz?.slides?.length) return;

    const idx = quiz.slides.findIndex(
      (slide) =>
        String(slide.question_id ?? slide.question?.question_id ?? "") ===
        String(currentQuestion.question_id ?? "")
    );

    if (idx >= 0 && currentSlide !== idx + 1) {
      setCurrentSlide(idx + 1);
    }

    if (data.type !== "ManagerPickAnswerQuestion") {
      setData({ type: "ManagerPickAnswerQuestion" });
    }
  }, [role, currentQuestion, quiz, currentSlide, data.type]);

  useEffect(() => {
    if (role !== "manager") return;
    if (!currentContent || !quiz?.slides?.length) return;

    const idx = quiz.slides.findIndex(
      (slide) => slide.slide_id === currentContent.slide_id
    );

    if (idx >= 0 && currentSlide !== idx + 1) {
      setCurrentSlide(idx + 1);
    }

    if (data.type !== "ManagerContentSlide") {
      setData({ type: "ManagerContentSlide" });
    }
  }, [role, currentContent, quiz, currentSlide, data.type]);

  // dYYâ€º U^U,OÂ¦UO manager OO3OÂ¦ U^ type:1 OOÃ½ O3OÃ±U^OÃ± U.UOÆ’?OOÃ±O3O_OO O"UÃ˜ U,UOO_OÃ±O"U^OÃ±O_ O"OÃ±U^
  useEffect(() => {
    if (role === "manager" && hasLeaderboardEntries(leaderboardResults)) {
      setData({ type: "ManagerLeaderBoard" });
    }
  }, [leaderboardResults, role]);

  /* ------------------ EXACT NEXT/PREVIOUS FROM YOUR CODE ------------------ */

  const handleNext = () => {
    if (data.type === "ManagerJoinPage") {
      if (hasLeaderboardEntries(leaderboardResults)) {
        setData({ type: "ManagerLeaderBoard" });
        return;
      }
      if (currentContent) {
        setData({ type: "ManagerContentSlide" });
        return;
      }
      if (currentQuestion) {
        setData({ type: "ManagerPickAnswerQuestion" });
        return;
      }
      setData({ type: "ManagerPickAnswerQuestion" });
    } else {
      const nextSlide = quiz.slides[currentSlide];
      if (!nextSlide) {
        setCurrentSlide((prev) => Math.min(prev + 1, totalSlides));
        return;
      }
      if (nextSlide.slide_type === 3) {
        setData({ type: "ManagerLeaderBoard" });
      } else if (nextSlide.slide_type === 2) {
        setData({ type: "ManagerContentSlide" });
      } else if (nextSlide.slide_type === 1) {
        setData({ type: "ManagerPickAnswerQuestion" });
      }
      setCurrentSlide((prev) => Math.min(prev + 1, totalSlides));
    }
  };

  // Product requirement: presentation flow is forward-only (no previous step).
  const handlePrevious = () => {};

  const handleEndGame = () => {
    setData({ type: "ManagerFinalLeaderboard" });
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
            quiz={quiz}
            onEndGame={handleEndGame}
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
            onEndGame={handleEndGame}
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
            onEndGame={handleEndGame}
          />
        );
      case "ManagerContentSlide":
        return (
          <ManagerContentSlide
            roomId={roomId}
            onNext={handleNext}
            onPrevious={handlePrevious}
            currentSlide={currentSlide}
            totalSlides={totalSlides}
            quiz={quiz}
            onEndGame={handleEndGame}
          />
        );
      case "ManagerFinalLeaderboard":
        return (
          <FinalLeaderboard
            leaderboardData={modalLeaderboardResults || leaderboardResults}
            onExit={() => (window.location.href = "/manager/panel")}
          />
        );
      default:
        return <Waiting />;
    }
  };

  /* ---------------- Player Rendering (Server Driven) ---------------- */
  const renderPlayer = () => {
    const hasLeaderboard = hasLeaderboardEntries(leaderboardResults);
    if (currentContent) {
      return <PlayerContentSlide roomId={roomId} quiz={quiz} content={currentContent} />;
    }
    if (currentQuestion) {
      const hasMatchingQuestion = (candidate) =>
        !!candidate &&
        candidate.question_id != null &&
        String(candidate.question_id) === String(currentQuestion.question_id);
      let result = null;
      if (hasMatchingQuestion(questionResults)) {
        result = questionResults;
      } else if (hasMatchingQuestion(partialQuestionResults)) {
        result = partialQuestionResults;
      }
      return (
        <PlayerPickAnswerQuestion
          roomId={roomId}
          question={currentQuestion}
          result={result}
          quiz={quiz}
        />
      );
    }
    // Do not show stale leaderboard to a fresh player before the quiz has actually started.
    if (hasLeaderboard && playerHasSeenActiveSlide) {
      return (
        <PlayerLeaderBoard
          roomId={roomId}
          players={leaderboardResults.results || leaderboardResults}
          quiz={quiz}
        />
      );
    }
    return <PlayerJoinPage roomId={roomId} quiz={quiz} />;
  };  /* ----------- Final Conditional Rendering ----------- */
  if (role === "manager") {
    return (
      <PresentationErrorBoundary key={`manager-${roomId ?? "unknown"}`}>
        {managerHasSyncedState ? renderManager() : <Waiting message="Syncing live session..." />}
      </PresentationErrorBoundary>
    );
  }

  if (role === "player") {
    return (
      <PresentationErrorBoundary key={`player-${roomId ?? "unknown"}`}>
        {renderPlayer()}
      </PresentationErrorBoundary>
    );
  }

  return <Waiting />;
}

class PresentationErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[PresentationErrorBoundary] Runtime error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 px-4 text-white">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <h2 className="text-xl font-bold">Presentation Error</h2>
          <p className="mt-2 text-sm text-white/70">
            A runtime error occurred. Please reload to recover the session.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-5 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
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
