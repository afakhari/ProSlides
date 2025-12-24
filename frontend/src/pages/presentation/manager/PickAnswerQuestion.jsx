import { useState, useEffect } from "react";
import TopBar from "../../../components/TopBar";
import QRSidebar from "../../../components/QRSidebar";
import Footer from "../../../components/Footer";
// LeaderboardModal was removed; modal UI now lives on Manager LeaderBoard page
import { useWebSocket } from "../../../hooks/useWebSocket";
import { useServerData } from "../../../hooks/useServerData";
import {
  QuizSetup,
  createNextPrevious,
  DefaultFooterStats,
  QuestionResult,
} from "../../../data/mockData";
// import { useLocation, useNavigate } from "react-router-dom";

export default function ManagerPickAnswerQuestion({
  onNext,
  onPrevious,
  currentSlide = 1,
  totalSlides = 5,
  quiz,
  isRemoteReady,
  roomId,
}) {
  const { isConnected, sendNavigation, sendEnd, lastMessage } = useWebSocket();
  const { questionResults, processMessage } = useServerData();

  // Calculate current question number and details from currentSlide
  const currentQuestionIndex = currentSlide - 1;
  // const questionNumber = currentQuestionIndex + 1;
  // const totalQuestions = QuizSetup.slides.length;

  const currentQuestion = isRemoteReady
    ? quiz.slides[currentSlide - 1]
    : {
        slide_type: 1,
        question_id: null,
        question_text: "",
        question_time: 0,
        max_point: 0,
        min_point: 0,
        options: [],
      };
  const options = currentQuestion.options?.map((opt) => opt.option_text) || [];

  // پیدا کردن همه گزینه‌های صحیح (نه فقط یکی)
  const correctIndexes =
    currentQuestion?.options?.reduce((arr, opt, idx) => {
      if (opt.answer === true) arr.push(idx);
      return arr;
    }, []) ?? [];

  const [selected, setSelected] = useState(null);
  const [voted, setVoted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [timer, setTimer] = useState(currentQuestion.question_time);
  const [votes, setVotes] = useState(
    new Array(currentQuestion.options.length).fill(0)
  );
  const [hasReceivedResults, setHasReceivedResults] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [_navigationData, setNavigationData] = useState(
    createNextPrevious(5, null, null)
  ); // State for tracking navigation (to be sent to server)
  const gameCode = roomId;
  // const navigate = useNavigate();

  // Reset state when slide changes (new question)
  useEffect(() => {
    if (!isRemoteReady) return;
    console.log("[PickAnswerQuestion] Slide changed to:", currentSlide);
    console.log("[PickAnswerQuestion] Resetting state...");
    setShowResults(false);
    setVotes(new Array(currentQuestion.options.length).fill(0));
    setTimer(currentQuestion.question_time);
    setHasReceivedResults(false);
  }, [
    currentSlide,
    currentQuestion.options.length,
    currentQuestion.question_time,
    isRemoteReady,
  ]);

  // Listen for WebSocket messages and save to ServerData
  useEffect(() => {
    if (!lastMessage) return;

    console.log("[PickAnswerQuestion] Received message:", lastMessage);

    // ذخیره پیام در ServerData
    processMessage(lastMessage);

    // Type 8: Question Results
    if (lastMessage.type === 8) {
      console.log("[PickAnswerQuestion] Type 8 received!");
      setHasReceivedResults(true);

      // Check if options array exists (from server)
      const serverResults = lastMessage.options || lastMessage.submit || [];
      console.log("[PickAnswerQuestion] Question results:", serverResults);
      console.log(
        "[PickAnswerQuestion] Current question options:",
        currentQuestion.options
      );

      // Combine mock data (previous results) with server results (new results)
      const newVotes = currentQuestion.options.map((option) => {
        // Get mock data (if available)
        const mockVote = option.number_of_submits ?? 0;

        // Get server data
        const serverResult = serverResults.find(
          (s) => s.option_id === option.option_id
        );
        const serverVote = serverResult
          ? serverResult.number_of_submits ?? serverResult.number_of_submit ?? 0
          : 0;

        // Combine: mock + server
        const combinedVote = mockVote + serverVote;
        console.log(
          `[PickAnswerQuestion] Option ${option.option_id}: mock=${mockVote} + server=${serverVote} = ${combinedVote}`
        );

        return combinedVote;
      });

      console.log("[PickAnswerQuestion] Combined votes:", newVotes);
      console.log("[PickAnswerQuestion] Setting showResults to true");
      setVotes(newVotes);
      setShowResults(true);
    }
  }, [lastMessage, currentQuestion.options, processMessage]);

  // Update votes from questionResults in ServerDataContext
  useEffect(() => {
    if (
      questionResults &&
      questionResults.options &&
      questionResults.options.length > 0
    ) {
      console.log(
        "[PickAnswerQuestion] Checking questionResults:",
        questionResults
      );
      console.log(
        "[PickAnswerQuestion] Current question_id:",
        currentQuestion.question_id
      );

      // Match question_id (handle both string and number comparisons)
      const questResultId = String(questionResults.question_id);
      const currentQId = String(currentQuestion.question_id);

      if (questResultId === currentQId) {
        console.log(
          "[PickAnswerQuestion] Question IDs match! Updating votes..."
        );

        // Combine mock data (previous results) with server results (new results)
        const newVotes = currentQuestion.options.map((option) => {
          // Get mock data (if available)
          const mockVote = option.number_of_submits ?? 0;

          // Get server data
          const serverResult = questionResults.options.find(
            (s) => s.option_id === option.option_id
          );
          const serverVote = serverResult
            ? serverResult.number_of_submits ??
              serverResult.number_of_submit ??
              0
            : 0;

          // Combine: mock + server
          const combinedVote = mockVote + serverVote;
          console.log(
            `[PickAnswerQuestion] Option ${option.option_id}: mock=${mockVote} + server=${serverVote} = ${combinedVote}`
          );

          return combinedVote;
        });

        console.log(
          "[PickAnswerQuestion] Combined votes from questionResults:",
          newVotes
        );
        setVotes(newVotes);
        setShowResults(true);
        setHasReceivedResults(true);
      } else {
        console.log(
          "[PickAnswerQuestion] Question IDs don't match. Ignoring old results."
        );
      }
    }
  }, [questionResults, currentQuestion.options, currentQuestion.question_id]);

  // Handle navigation and update server data
  const handleNext = () => {
    const newNavigationData = createNextPrevious(
      5,
      "next",
      currentQuestionIndex
    );
    setNavigationData(newNavigationData);
    console.log(
      "[PollPage] Navigation data to send to server:",
      newNavigationData
    );

    // Send navigation to WebSocket
    sendNavigation("next");

    if (onNext) onNext();
  };

  const handlePrevious = () => {
    const newNavigationData = createNextPrevious(
      5,
      "previous",
      currentQuestionIndex
    );
    setNavigationData(newNavigationData);
    console.log(
      "[PollPage] Navigation data to send to server:",
      newNavigationData
    );

    // Send navigation to WebSocket
    sendNavigation("previous");

    if (onPrevious) onPrevious();
  };

  const handleEnd = () => {
    console.log("[PickAnswerQuestion] Sending end command to server");
    sendEnd();
  };

  // Debug: Log state changes
  useEffect(() => {
    console.log("[PickAnswerQuestion] State update:", {
      showResults,
      votes,
      totalVotes: votes.reduce((sum, v) => sum + v, 0),
      timer,
    });
  }, [showResults, votes, timer]);

  // تایمر
  useEffect(() => {
    if (!isRemoteReady) return; // don't start timer until remote quiz is ready
    if (showResults) {
      console.log(
        "[PickAnswerQuestion] Timer skipped - results already showing"
      );
      return;
    }

    console.log(
      "[PickAnswerQuestion] Starting timer for",
      currentQuestion.question_time,
      "seconds"
    );
    setTimer(currentQuestion.question_time);

    const interval = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(interval);
          // Show results when timer ends (fallback if server doesn't send message)
          console.log("[PickAnswerQuestion] Timer ended, showing results");

          // Use mock data from currentQuestion.options if available
          const mockVotes = currentQuestion.options.map(
            (opt) => opt.number_of_submits ?? 0
          );
          console.log("[PickAnswerQuestion] Using mock votes:", mockVotes);
          setVotes(mockVotes);
          setShowResults(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      console.log("[PickAnswerQuestion] Cleaning up timer");
      clearInterval(interval);
    };
  }, [
    showResults,
    currentSlide,
    currentQuestion.question_time,
    currentQuestion.options,
    isRemoteReady,
  ]);

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat flex flex-col justify-around items-center font-semibold"
      style={{ backgroundImage: "url('/bg.jpg')" }}
    >
      <TopBar
        gameCode={gameCode}
        showQRButton={true}
        onQRToggle={setShowQRModal}
        isQROpen={showQRModal}
      />

      <QRSidebar
        gameCode={gameCode}
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
      />

      <div
        className={` min-h-screen flex flex-col justify-around items-center transition-all duration-300 pt-20 ${
          showQRModal ? "ml-[20%] w-[80%]" : "ml-0 w-full"
        }`}
      >
        {/* WebSocket Connection Status */}
        <div className="absolute top-20 right-4 flex items-center gap-2 text-xs z-50">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-green-500" : "bg-red-500"
            }`}
          ></div>
          <span className="text-white/80">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>

        {isRemoteReady ? (
          <>
            <h2 className="text-6xl font-bold text-white mb-10 mt-12">
              {currentQuestion.question_text}
            </h2>

            {/* تایمر */}
            {!showResults && timer > 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-8xl font-bold text-white">
                {timer}
              </div>
            )}
            {/* نمودار */}
            <div className="flex justify-around items-end w-full h-[700px] mb-10 px-4">
              {currentQuestion.options.map((opt, index) => {
                const isCorrect = correctIndexes.includes(index);
                const isSelected = index === selected;
                const totalVotes = votes.reduce((sum, v) => sum + v, 0);
                const height =
                  showResults && totalVotes > 0
                    ? (votes[index] / totalVotes) * 100
                    : 0;

                return (
                  <div
                    key={index}
                    className="flex flex-col items-center justify-end w-1/5 h-full"
                  >
                    {showResults && (
                      <div className="mb-2 text-center text-4xl text-white font-semibold">
                        {votes[index]}
                      </div>
                    )}
                    <div
                      className={`w-3/4 rounded-t-lg transition-all duration-1000
                      ${isCorrect ? "bg-green-500" : "bg-pink-600"}
                      ${
                        isSelected && !isCorrect ? "ring-2 ring-pink-800" : ""
                      }`}
                      style={{ height: `${height}%` }}
                    ></div>
                    <p className="mt-5 text-gray-700 text-3xl font-semibold text-center">
                      {opt.option_text}
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center w-full h-[700px] mb-10 px-4">
            <div className="text-white/80 text-2xl">Loading quiz…</div>
          </div>
        )}

        {/* دکمه‌های رأی دادن */}
        {/* {!voted && !showResults && (
          <div className="flex flex-wrap justify-center gap-4">
            {options.map((opt, index) => (
              <button
                key={index}
                onClick={() => handleVote(index)}
                className="bg-pink-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-pink-600 transition shadow-md"
              >
                {opt}
              </button>
            ))}
          </div>
        )} */}

        {voted && !showResults && (
          <p className="mt-6 text-pink-700 font-medium">
            You voted for <b>{options[selected]}</b>
          </p>
        )}
      </div>

      <Footer
        currentSlide={currentSlide}
        totalSlides={totalSlides}
        stats={DefaultFooterStats}
        showQRButton={true}
        onQRToggle={setShowQRModal}
        isQROpen={showQRModal}
        onShowLeaderboard={() => setShowLeaderboard(true)}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onEnd={handleEnd}
      />

      {/* Leaderboard modal removed - manager LeaderBoard page now contains modal UI */}
    </div>
  );
}
