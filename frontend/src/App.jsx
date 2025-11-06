import { useState } from "react";
import JoinPage2 from "./pages/JoinPage2";
import LeaderBoard from "./pages/LeaderBoard";
import PollPage from "./pages/manager_question";
import "./App.css";

// Page flow state machine
// join -> pollpage (no slide increment) -> leaderboard (slide +1) -> join (slide +1)
// Navigation rules:
// - From join: Start/> goes to pollpage (slide stays same)
// - From pollpage: > goes to leaderboard (slide +1)
// - From leaderboard: > goes to join (slide +1)
// - < button: goes back and decrements slide when appropriate

export default function App() {
  const [currentPage, setCurrentPage] = useState("join"); // join | pollpage | leaderboard
  const [currentSlide, setCurrentSlide] = useState(1);
  const [totalSlides] = useState(3);

  // Handle next navigation
  const handleNext = () => {
    if (currentPage === "join") {
      // Join -> PollPage (no slide increment)
      setCurrentPage("pollpage");
    } else if (currentPage === "pollpage") {
      // PollPage -> Leaderboard (slide +1)
      setCurrentPage("leaderboard");
      setCurrentSlide((prev) => Math.min(prev + 1, totalSlides));
    } else if (currentPage === "leaderboard") {
      // Leaderboard -> Join (slide +1)
      setCurrentPage("join");
      setCurrentSlide((prev) => Math.min(prev + 1, totalSlides));
    }
  };

  // Handle previous navigation
  const handlePrevious = () => {
    if (currentPage === "join") {
      // Join -> Leaderboard (slide -1)
      setCurrentPage("leaderboard");
      setCurrentSlide((prev) => Math.max(prev - 1, 1));
    } else if (currentPage === "pollpage") {
      // PollPage -> Join (no slide decrement)
      setCurrentPage("join");
    } else if (currentPage === "leaderboard") {
      // Leaderboard -> PollPage (slide -1)
      setCurrentPage("pollpage");
      setCurrentSlide((prev) => Math.max(prev - 1, 1));
    }
  };

  // Render appropriate page
  const renderPage = () => {
    switch (currentPage) {
      case "join":
        return (
          <JoinPage2
            onNext={handleNext}
            onPrevious={handlePrevious}
            currentSlide={currentSlide}
            totalSlides={totalSlides}
          />
        );
      case "pollpage":
        return (
          <PollPage
            onNext={handleNext}
            onPrevious={handlePrevious}
            currentSlide={currentSlide}
            totalSlides={totalSlides}
          />
        );
      case "leaderboard":
        return (
          <LeaderBoard
            onNext={handleNext}
            onPrevious={handlePrevious}
            currentSlide={currentSlide}
            totalSlides={totalSlides}
          />
        );
      default:
        return <JoinPage2 onNext={handleNext} onPrevious={handlePrevious} />;
    }
  };

  return <div>{renderPage()}</div>;
}
