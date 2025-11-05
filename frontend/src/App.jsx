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
import "./App.css";

// export default function App() {
let data = { type: "leaderboard" };

data = {
  type: "question",
  question_id: 45,
  question_text: "Which country has the highest population?",
  options: [
    { option_id: 47, option_text: "Denmark 🇩🇰" },
    { option_id: 48, option_text: "Sweden 🇸🇪" },
    { option_id: 49, option_text: "United Kingdom 🇬🇧" },
    { option_id: 50, option_text: "France 🇫🇷" },
  ],
  question_time: 10,
  min_point: 0,
  max_point: 50,
};

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

// import { useState, useEffect } from "react";
// import JoinPage from "./pages/JoinPage";
// import GamePage from "./pages/GamePage";
// import PickAnswerQuestion from "./pages/pickAnswerQuestion";
// import LeaderBoard from "./pages/LeaderBoard";
// import PollPage from "./pages/manager_question";

data = { type: "join" };
function PageRenderer({ type }) {
  switch (type) {
    case "ManagerJoinPage":
      return <ManagerJoinPage />;
    case "ManagerPickAnswerQuestion":
      return <ManagerPickAnswerQuestion />;
    case "ManagerLeaderBoard":
      return <ManagerLeaderBoard />;
    case "PlayerJoinPage":
      return <PlayerJoinPage />;
    case "PlayerGamePage":
      return <PlayerGamePage />;
    case "PlayerPickAnswerQuestion":
      return <PlayerPickAnswerQuestion />;
    case "PlayerLeaderBoard":
      return <PlayerLeaderBoard />;
    case "Waiting":
      return <Waiting />;
    default:
      return <Waiting />;
  }
}

export default function App() {
  const [data, setData] = useState({ type: "game" });

  useEffect(() => {
    const interval = setInterval(() => {
      const types = [
        // "ManagerJoinPage",
        // "ManagerPickAnswerQuestion",
        // "ManagerLeaderBoard",
        "PlayerJoinPage",
        // "PlayerGamePage",
        "PlayerPickAnswerQuestion",
        "PlayerLeaderBoard",
        "Waiting",
      ];
      const randomType = types[Math.floor(Math.random() * types.length)];
      setData({ type: "PlayerPickAnswerQuestion" });
      // setData({ type: "PlayerJoinPage" });
      // setData({ type: "PlayerJoinPage" });
      // setData({ type: "PlayerLeaderBoard" });
      setData({ type: randomType });
      // setData({ type: "Waiting" });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <PageRenderer type={data.type} />
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
