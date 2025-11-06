import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import ManagerJoinPage from "./pages/presentation/manager/JoinPage";
import ManagerPickAnswerQuestion from "./pages/presentation/manager/PickAnswerQuestion";
import ManagerLeaderBoard from "./pages/presentation/manager/LeaderBoard";
import PlayerJoinPage from "./pages/presentation/player/JoinPage";
import PlayerGamePage from "./pages/presentation/player/GamePage";
import PlayerPickAnswerQuestion from "./pages/presentation/player/PickAnswerQuestion";
import PlayerLeaderBoard from "./pages/presentation/player/LeaderBoard";
import Waiting from "./pages/loading/LoadingPage";
import DataWatcher from "./DataWatcher";
// import "./App.css";

// export default function App() {
//   return (
//     <Router>
//       <DataWatcher data={data} />
//       <Routes>
//         <Route path="" element={<JoinPage />} />
//         <Route path="/join" element={<JoinPage2 />} />
//         <Route path="/game" element={<GamePage />} />
//         <Route
//           path="/question"
//           element={<PickAnswerQuestion /*question={data}*/ />}
//         />
//         <Route path="/leaderboard" element={<LeaderBoard />} />
//         <Route path="/PollPage" element={<PollPage />} />
//       </Routes>
//     </Router>
//   );
// }

export default function App() {
  // for pick answer question
  const [data, setData] = useState({ type: "ManagerJoinPage" });
  const [currentPage, setCurrentPage] = useState("join"); // join | pollpage | leaderboard
  const [currentSlide, setCurrentSlide] = useState(1);
  const [totalSlides] = useState(3);

  // Handle next navigation
  const handleNext = () => {
    if (data.type === "ManagerJoinPage") {
      // Join -> PollPage (no slide increment)
      setData({ type: "ManagerPickAnswerQuestion" });
    } else if (data.type === "ManagerPickAnswerQuestion") {
      // PollPage -> Leaderboard (slide +1)
      setData({ type: "ManagerLeaderBoard" });
      setCurrentSlide((prev) => Math.min(prev + 1, totalSlides));
    } else if (data.type === "ManagerLeaderBoard") {
      // Leaderboard -> Join (slide +1)
      setData({ type: "ManagerJoinPage" });
      setCurrentSlide((prev) => Math.min(prev + 1, totalSlides));
    }
  };

  // Handle previous navigation
  const handlePrevious = () => {
    if (data.type === "ManagerJoinPage") {
      // Join -> Leaderboard (slide -1)
      setData({ type: "ManagerLeaderBoard" });
      setCurrentSlide((prev) => Math.max(prev - 1, 1));
    } else if (data.type === "ManagerPickAnswerQuestion") {
      // PollPage -> Join (no slide decrement)
      setData({ type: "ManagerJoinPage" });
    } else if (data.type === "ManagerLeaderBoard") {
      // Leaderboard -> PollPage (slide -1)
      setData({ type: "ManagerPickAnswerQuestion" });
      setCurrentSlide((prev) => Math.max(prev - 1, 1));
    }
  };

  function PageRenderer({ data }) {
    const type = data.type;
    switch (type) {
      case "ManagerJoinPage":
        return (
          <ManagerJoinPage
            onNext={handleNext}
            onPrevious={handlePrevious}
            currentSlide={currentSlide}
            totalSlides={totalSlides}
          />
        );
      case "ManagerPickAnswerQuestion":
        return (
          <ManagerPickAnswerQuestion
            onNext={handleNext}
            onPrevious={handlePrevious}
            currentSlide={currentSlide}
            totalSlides={totalSlides}
          />
        );
      case "ManagerLeaderBoard":
        return (
          <ManagerLeaderBoard
            onNext={handleNext}
            onPrevious={handlePrevious}
            currentSlide={currentSlide}
            totalSlides={totalSlides}
          />
        );
      case "PlayerJoinPage":
        return <PlayerJoinPage />;
      case "PlayerGamePage":
        return <PlayerGamePage />;
      case "PlayerPickAnswerQuestion":
        return <PlayerPickAnswerQuestion question={data} />;
      case "PlayerLeaderBoard":
        return <PlayerLeaderBoard players={data.results} />;
      case "Waiting":
        return <Waiting />;
      default:
        return <Waiting />;
    }
  }

  // // for quetsion
  // const [data, setData] = useState({
  //   type: "PlayerPickAnswerQuestion",
  //   question_id: 45,
  //   question_text: "Which country has the highest population?",
  //   options: [
  //     { option_id: 47, option_text: "Denmark 🇩🇰" },
  //     { option_id: 48, option_text: "Sweden 🇸🇪" },
  //     { option_id: 49, option_text: "United Kingdom 🇬🇧" },
  //     { option_id: 50, option_text: "France 🇫🇷" },
  //   ],
  //   question_time: 10,
  //   min_point: 0,
  //   max_point: 50,
  // });

  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     // for leaderboard data
  //     setData({
  //       type: "PlayerLeaderBoard",
  //       results: [
  //         {
  //           user_id: 1,
  //           name: "Chloe",
  //           character: "👑",
  //           color: "#db2777",
  //           rank: 1,
  //           total_points: 153,
  //           new_points: 61,
  //         },
  //         {
  //           user_id: 2,
  //           name: "Trang",
  //           character: "🌸",
  //           color: "#059669",
  //           rank: 3,
  //           total_points: 149,
  //           new_points: 49,
  //         },
  //         {
  //           user_id: 3,
  //           name: "Alex",
  //           character: "🐱",
  //           color: "#65a30d",
  //           rank: 4,
  //           total_points: 34,
  //           new_points: 34,
  //         },
  //         {
  //           user_id: 4,
  //           name: "Jenny",
  //           character: "🧁",
  //           color: "#2563eb",
  //           rank: 6,
  //           total_points: 0,
  //           new_points: 0,
  //         },
  //         {
  //           user_id: 5,
  //           name: "Kian",
  //           character: "😂",
  //           color: "#4563bb",
  //           rank: 5,
  //           total_points: 20,
  //           new_points: 20,
  //         },
  //         {
  //           user_id: 6,
  //           name: "ALireza",
  //           character: "🫠",
  //           color: "#120854",
  //           rank: 2,
  //           total_points: 150,
  //           new_points: 88,
  //         },
  //       ],
  //     });

  //     // for join page
  //     // setData({ type: "PlayerJoinPage" });
  //   }, 2000);
  //   return () => clearInterval(interval);
  // }, []);

  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     const types = [
  //       // "ManagerJoinPage",
  //       // "ManagerPickAnswerQuestion",
  //       // "ManagerLeaderBoard",
  //       "PlayerJoinPage",
  //       // "PlayerGamePage",
  //       "PlayerPickAnswerQuestion",
  //       "PlayerLeaderBoard",
  //       "Waiting",
  //     ];
  //     const randomType = types[Math.floor(Math.random() * types.length)];
  //     // setData({ type: "PlayerPickAnswerQuestion" });
  //     // setData({ type: "PlayerJoinPage" });
  //     // setData({ type: "PlayerJoinPage" });
  //     // setData({ type: "PlayerLeaderBoard" });
  //     setData({ type: randomType });
  //     // setData({ type: "Waiting" });
  //   }, 2000);
  //   return () => clearInterval(interval);
  // }, []);

  return (
    <div>
      <PageRenderer data={data} />
    </div>
  );
}

// export default function App() {
//   const [data, setData] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);

//   useEffect(() => {
//     async function fetchData() {
//       try {
//         setLoading(true);
//         setError(null);

//         const res = await fetch("https://your-backend.com/api/status"); // ✅ آدرس API واقعی تو
//         if (!res.ok) throw new Error("خطا در پاسخ سرور");
//         const result = await res.json();

//         setData(result);
//       } catch (err) {
//         console.error(err);
//         setError(err.message);
//       } finally {
//         setLoading(false);
//       }
//     }

//     // اولین بار اجرا کن
//     fetchData();

//     // هر چند ثانیه یک بار رفرش کن (مثلاً هر ۵ ثانیه)
//     const interval = setInterval(fetchData, 5000);
//     return () => clearInterval(interval);
//   }, []);

//   if (loading && !data) return <div>در حال بارگذاری...</div>;
//   if (error) return <div>⚠️ خطا در ارتباط با سرور: {error}</div>;

//   return (
//     <div>
//       <PageRenderer data={data} />
//     </div>
//   );
// }

// export default function App() {

// Render appropriate page
//   const renderPage = () => {
//     switch (currentPage) {
//       case "join":
//         return (
//           <ManagerJoinPage
//             onNext={handleNext}
//             onPrevious={handlePrevious}
//             currentSlide={currentSlide}
//             totalSlides={totalSlides}
//           />
//         );
//       case "pollpage":
//         return (
//           <ManagerPickAnswerQuestion
//             onNext={handleNext}
//             onPrevious={handlePrevious}
//             currentSlide={currentSlide}
//             totalSlides={totalSlides}
//           />
//         );
//       case "leaderboard":
//         return (
//           <ManagerLeaderBoard
//             onNext={handleNext}
//             onPrevious={handlePrevious}
//             currentSlide={currentSlide}
//             totalSlides={totalSlides}
//           />
//         );
//       default:
//         return <JoinPage2 onNext={handleNext} onPrevious={handlePrevious} />;
//     }
//   };

//   return <div>{renderPage()}</div>;
// }
