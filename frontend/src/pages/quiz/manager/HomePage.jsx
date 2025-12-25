import { Button } from "../../../components/ui/button";
import { useNavigate, useParams } from "react-router-dom";

export default function HomePage() {
  const navigate = useNavigate();
  const { roomId, role } = useParams();

  const handleNewPresentation = () => {
    if (roomId && role) {
      navigate(`/${roomId}/${role}/panel/editor`);
    } else {
      navigate("/editor");
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <Button className="text-lg px-6 py-3" onClick={handleNewPresentation}>
        New Presentation
      </Button>
    </div>
  );
}
