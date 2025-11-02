import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import JoinPage2 from "./pages/JoinPage2";
import JoinPage from "./pages/JoinPage";
import GamePage from "./pages/GamePage";
import PickAnswerQuestion from "./pages/pickAnswerQuestion";
import LeaderBoard from "./pages/LeaderBoard";
import PollPage from "./pages/manager_question";
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
    case "game":
      return <JoinPage />;
    case "join":
      return <JoinPage2 />;
    case "question":
      return <PickAnswerQuestion />;
    case "leaderboard":
      return <LeaderBoard />;
    case "pollpage":
      return <PollPage />;
    default:
      return <GamePage />;
  }
}

export default function App() {
  // const [data, setData] = useState({ type: "game" });

  // useEffect(() => {
  //   // شبیه‌سازی داده زنده (مثلاً از WebSocket)
  //   const interval = setInterval(() => {
  //     const types = ["game", "question", "leaderboard", "PollPage"];
  //     const randomType = types[Math.floor(Math.random() * types.length)];
  //     setData({ type: randomType });
  //   }, 5000);
  //   return () => clearInterval(interval);
  // }, []);

  return (
    <div>
      <PageRenderer type={data.type} />
    </div>
  );
}
