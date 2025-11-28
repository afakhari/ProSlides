import { Button } from "../../../components/ui/button";
import { useNavigate, useParams } from "react-router-dom";

export default function HomePage() {
  const navigate = useNavigate();
  const { roomId, role } = useParams();

  const goEditor = () => {
    // Navigate to dynamic editor route under panel
    navigate(`/${roomId}/${role}/panel/editor`);
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-50 gap-6">
      <h1 className="text-3xl font-bold text-gray-800">Quiz Panel</h1>
      <p className="text-gray-600">
        Room: {roomId} | Role: {role}
      </p>
      <Button className="text-lg px-6 py-3" onClick={goEditor}>
        New Presentation
      </Button>
    </div>
  );
}
