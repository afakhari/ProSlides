import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";

import LandingPage from "./pages/landing/LandingPage";

const AuthPage = lazy(() => import("./pages/auth/AuthPage"));
const SessionDetail = lazy(() => import("./pages/report/SessionDetail"));
const HomePage = lazy(() => import("./pages/quiz/manager/HomePage"));
const EditorPage = lazy(() => import("./pages/quiz/manager/EditorPage"));
const WaitingPage = lazy(() => import("./pages/loading/LoadingPage"));
const PresentationEntry = lazy(() => import("./routes/PresentationEntry"));

function RouteFallback() {
  return <div className="min-h-screen bg-white" aria-busy="true" />;
}

export default function App() {
  return (
    <Router>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/signup" element={<AuthPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/:role/presentation/:roomId"
            element={<PresentationEntry mode="presentation" />}
          />
          <Route path="/" element={<AuthPage />} />
          <Route
            path="/:accessCode"
            element={<PresentationEntry mode="accessCode" />}
          />
          <Route path="/:role/panel" element={<HomePage />} />
          <Route path="/:role/panel/:roomId" element={<EditorPage />} />
          <Route
            path="/:role/panel/:quizId/report"
            element={<SessionDetail />}
          />
          <Route path="*" element={<WaitingPage />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
