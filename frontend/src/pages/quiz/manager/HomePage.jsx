import { Button } from "../../../components/ui/button";
import { useNavigate } from "react-router-dom";
import QuizManager from "../../../components/QuizManager";

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <QuizManager
      onNewPresentation={(roomId) => navigate(`/manager/panel/${roomId}`)}
    />
  );
}
