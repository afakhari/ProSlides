import React, { useState, useEffect } from "react";

// Source data for lobby and players
const User_adding = {
  type: 13,
  Users: [
    // { user_id: 1, name: "ali", character: "@" },
    // { user_id: 2, name: "ahmad", character: "😊" },
    // { user_id: 4, name: "mike", character: "⭐" },
    // { user_id: 5, name: "mike", character: "⭐" },
    // { user_id: 6, name: "mike", character: "⭐" },
    // { user_id: 7, name: "mike", character: "⭐" },
    // { user_id: 8, name: "mike", character: "⭐" },
    // { user_id: 9, name: "mike", character: "⭐" },
    // { user_id: 10, name: "mike", character: "⭐" },
    // { user_id: 11, name: "mike", character: "⭐" },
    // { user_id: 12, name: "mike", character: "⭐" },
    // { user_id: 13, name: "mike", character: "⭐" },
    // { user_id: 14, name: "mike", character: "⭐" },
    // { user_id: 15, name: "mike", character: "⭐" },
    // { user_id: 16, name: "mike", character: "⭐" },
    // { user_id: 17, name: "mike", character: "⭐" },
  ],
};

// Calculate players ready based on the User_adding.type
function calculatePlayersReady({ type, Users }) {
  // Extendable rule-set; for now, type 1 => count all users
  switch (type) {
    case 1:
    default:
      return Users?.length ?? 0;
  }
}

export default function App() {
  const [page, setPage] = useState("lobby"); // 'lobby' | 'quiz'
  const [newUserId, setNewUserId] = useState(null);
  const [previousUserCount, setPreviousUserCount] = useState(
    User_adding.Users.length
  );

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
              background: data.background || { color: "#1e1e2e", image: "" },
              music_url: data.music_url || "",
              slides: mappedSlides,
            };

            setRemoteQuiz(quizData);
            console.log("[AppPresentation] remote quiz loaded", quizData);
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

    // Set quiz music when loaded
    const { setQuizMusic } = useAudio();
    useEffect(() => {
      if (remoteQuiz?.music_url) {
        setQuizMusic(remoteQuiz.music_url);
      }
    }, [remoteQuiz?.music_url, setQuizMusic]);

    const {
      currentQuestion,
      leaderboardResults,
      questionResults,
      partialQuestionResults,
    } = useServerData();

    // 🟢 وقتی manager است و type:1 از سرور می‌رسد، به لیدربورد برو
    useEffect(() => {
      if (role === "manager" && leaderboardResults) {
        setData({ type: "ManagerLeaderBoard" });
      }
    }, [leaderboardResults, role]);

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
              quiz={quiz}
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
            quiz={quiz}
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
            quiz={quiz}
          />
        );
      }

      return <PlayerJoinPage roomId={roomId} quiz={quiz} />;
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
}
