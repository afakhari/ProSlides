import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import TopBar from "../../../components/TopBar";
import QRSidebar from "../../../components/QRSidebar";
import Footer from "../../../components/Footer";
import LeaderboardModal from "../../../components/LeaderboardModal";
import { useWebSocket } from "../../../hooks/useWebSocket";
import { useServerData } from "../../../hooks/useServerData";
import {
  QuizSetup,
  createNextPrevious,
  LeaderboardPlayers,
  DefaultGameCode,
  DefaultFooterStats,
  User_adding,
} from "../../../data/mockData";

function ManagerLeaderBoard({
  onNext,
  onPrevious,
  currentSlide = 1,
  totalSlides = 3,
}) {
  const { isConnected, sendNavigation, lastMessage } = useWebSocket();
  const { leaderboardResults, processMessage } = useServerData();

  // Use leaderboard from server or default
  const [players, setPlayers] = useState(LeaderboardPlayers);

  // Update players when leaderboardResults changes
  useEffect(() => {
    if (leaderboardResults && leaderboardResults.length > 0) {
      setPlayers(leaderboardResults);
    }
  }, [leaderboardResults]);

  // Calculate current question number and details from currentSlide
  const currentQuestionIndex = currentSlide - 1;
  const questionNumber = currentQuestionIndex - 1;
  const totalQuestions = QuizSetup.slides.length;
  const [hovered, setHovered] = useState(null);
  const [hiddenNames, setHiddenNames] = useState([]);
  const [displayedPlayers, setDisplayedPlayers] = useState([]);
  const [animateBars, setAnimateBars] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [_navigationData, setNavigationData] = useState(
    createNextPrevious(5, null, null)
  ); // State for tracking navigation (to be sent to server)
  const gameCode = DefaultGameCode;

  // Listen for WebSocket messages - Leaderboard updates
  useEffect(() => {
    if (!lastMessage) return;

    // Process message through ServerDataContext first
    processMessage(lastMessage);

    console.log("[LeaderBoard] Received message:", lastMessage);

    // Type 1: Leaderboard Results (from server)
    if (lastMessage.type === 1 && lastMessage.results) {
      console.log("[LeaderBoard] Leaderboard updated:", lastMessage.results);
      const updatedPlayers = lastMessage.results.map((user) => ({
        user_id: user.user_id,
        name: user.name,
        character: user.character,
        color: user.color || "#6366f1",
        rank: user.rank,
        total_points: user.total_points,
        new_points: user.new_points,
      }));
      setPlayers(updatedPlayers);
    }

    // Type 11: Leaderboard Update (فرضی)
    if (lastMessage.type === 11 && lastMessage.leaderboard) {
      console.log(
        "[LeaderBoard] Leaderboard updated:",
        lastMessage.leaderboard
      );
      setPlayers(lastMessage.leaderboard);
    }

    // Type 7: if players come with users
    if (lastMessage.type === 7 && lastMessage.users) {
      // Convert users to leaderboard format if needed
      const updatedPlayers = lastMessage.users.map((user, index) => ({
        user_id: user.user_id,
        name: user.name,
        character: user.character,
        color: user.color || LeaderboardPlayers[index]?.color || "#6366f1",
        rank: user.rank || index + 1,
        total_points: user.total_points || 0,
        new_points: user.new_points || 0,
      }));
      setPlayers(updatedPlayers);
    }
  }, [lastMessage, processMessage]);

  // Handle navigation and update server data
  const handleNext = () => {
    const newNavigationData = createNextPrevious(
      5,
      "next",
      currentQuestionIndex
    );
    setNavigationData(newNavigationData);
    console.log(
      "[LeaderBoard] Navigation data to send to server:",
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
      "[LeaderBoard] Navigation data to send to server:",
      newNavigationData
    );

    // Send navigation to WebSocket
    sendNavigation("previous");

    if (onPrevious) onPrevious();
  };

  const handleToggleBlur = (id) => {
    setHiddenNames((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleClick = (action, name) => {
    alert(`${action} clicked for ${name}`);
  };

  const maxScore = Math.max(...players.map((p) => p.total_points));
  const minScore = Math.min(...players.map((p) => p.total_points));

  const calcPercent = (score) => {
    if (maxScore === minScore) return 100;
    const percent = ((score - minScore) / (maxScore - minScore)) * 99 + 1;
    return Math.max(percent, 1);
  };

  useEffect(() => {
    const withOld = players.map((p) => ({
      ...p,
      oldScore: p.total_points - p.new_points,
    }));
    const sortedOld = [...withOld].sort((a, b) => b.oldScore - a.oldScore);
    setDisplayedPlayers(sortedOld);
    setAnimateBars(false);

    const t = setTimeout(() => {
      const sortedNew = [...players].sort(
        (a, b) => b.total_points - a.total_points
      );
      setDisplayedPlayers(sortedNew);
      setAnimateBars(true);
    }, 1200);

    return () => clearTimeout(t);
  }, [players]);

  return (
    <div
      className="bg-pink-300 min-h-screen font-semibold"
      style={{ backgroundImage: "url('/src/assets/bg.jpg')" }}
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
        className={`transition-all duration-300 ${
          showQRModal ? "ml-[20%]" : "ml-0"
        }`}
      >
        <main>
          <section className="p-4 pt-20 relative">
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

            {/* Title and player count */}
            <div className="text-center">
              <h1 className="text-5xl text-white pb-5 rounded-xl">
                Leaderboard - Question {questionNumber} of {totalQuestions}
              </h1>
              <p className="text-white/70 text-lg mt-2">
                {players.length} players
              </p>
            </div>

            <ul className="mt-6 space-y-4 w-full flex flex-col items-center">
              <AnimatePresence>
                {displayedPlayers.map((p) => {
                  const isHidden = hiddenNames.includes(p.rank);
                  const widthPercent = calcPercent(p.total_points);

                  return (
                    <motion.li
                      key={p.rank}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{
                        type: "spring",
                        stiffness: 120,
                        damping: 18,
                      }}
                      className="flex justify-start items-center relative w-[90%] max-w-3xl"
                      onMouseEnter={() => setHovered(p.rank)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      {/* Rank */}
                      <div className="text-white/90 text-lg font-semibold w-8 text-center rounded-full bg-white/20 mr-3 py-1">
                        {p.rank}
                      </div>

                      {/* Fixed-width translucent track */}
                      <div className="relative overlay-hidden bg-white/10 w-full h-14 mr-3">
                        {/* Colored fill */}
                        <motion.div
                          className={`absolute left-0 top-0 h-full z-10`}
                          style={{ backgroundColor: p.color }}
                          initial={{ width: 0 }}
                          animate={{
                            width: animateBars ? `${widthPercent}%` : 0,
                          }}
                          transition={{ duration: 1.3, ease: "easeOut" }}
                        />

                        {/* Content on top */}
                        <div className="relative z-20 flex items-center px-4 py-3 gap-4">
                          <div className="player-avatar text-2xl">
                            {p.character}
                          </div>

                          <div className="flex items-center space-x-3">
                            <div
                              className={`text-white font-medium transition-all duration-200 ${
                                isHidden ? "blur-sm select-none" : ""
                              }`}
                            >
                              {isHidden ? "****" : p.name}
                            </div>

                            {hovered === p.rank && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleToggleBlur(p.rank)}
                                  className="bg-white/90 text-gray-800 px-2 py-1 rounded-lg text-sm hover:bg-white"
                                >
                                  👁️
                                </button>
                                <button
                                  onClick={() => handleClick("✏️ Edit", p.name)}
                                  className="bg-white/90 text-blue-600 px-2 py-1 rounded-lg text-sm hover:bg-white"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => handleClick("📞 Call", p.name)}
                                  className="bg-white/90 text-green-600 px-2 py-1 rounded-lg text-sm hover:bg-white"
                                >
                                  📞
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Score */}
                      <div className="relative w-[10%] text-white font-semibold ml-3">
                        {p.total_points}p{" "}
                        <span className="text-white/60 text-sm">
                          +{p.new_points}
                        </span>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </section>
          {/* <button

          className="mt-[25px] mx-[10px] w-[calc(100%-20px)] p-[14px] border-none rounded-[10px]  font-bold cursor-pointer transition-all duration-300 text-2xl bg-white text-[#6c2bd9] disabled:opacity-60 disabled:cursor-not-allowed"
          onClick={() => navigate("/PollPage")}
        >
          leader board
        </button> */}
        </main>

        <Footer
          currentSlide={currentSlide}
          totalSlides={totalSlides}
          stats={DefaultFooterStats}
          showQRButton={true}
          onQRToggle={setShowQRModal}
          isQROpen={showQRModal}
          onShowLeaderboard={() => setShowLeaderboardModal(true)}
          onNext={handleNext}
          onPrevious={handlePrevious}
        />

        <LeaderboardModal
          isOpen={showLeaderboardModal}
          onClose={() => setShowLeaderboardModal(false)}
          players={displayedPlayers.map((p) => ({
            user_id: p.user_id,
            name: p.name,
            character: p.character,
            total_points: p.total_points,
            color: p.color,
            rank: p.rank,
          }))}
        />
      </div>
    </div>
  );
}

export default ManagerLeaderBoard;
