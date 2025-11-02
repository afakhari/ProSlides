import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import EmojiPicker from "emoji-picker-react";

export default function JoinPage(inp) {
  const [players, setPlayers] = useState([]);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🧙");
  const [showPicker, setShowPicker] = useState(false);
  // const navigate = useNavigate();

  // Loading from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("players");
      if (stored) setPlayers(JSON.parse(stored));
      else setPlayers([]);
    } catch (err) {
      console.error("Error reading players:", err);
      setPlayers([]);
    }
  }, []);

  // Adding new player
  const savePlayer = () => {
    if (!name.trim()) return alert("Please enter your name!");

    const newPlayer = {
      id: players.length + 1,
      name,
      avatar,
    };

    const updatedPlayers = [...players, newPlayer];
    setPlayers(updatedPlayers);
    localStorage.setItem("players", JSON.stringify(updatedPlayers));

    // navigate("/game", { state: newPlayer });
    //navigate("/", { state: newPlayer });
  };
  console.log(inp);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-pink-300">
      <h1 className="text-5xl text-white font-bold mb-6">ProSlides</h1>

      {/* Set name */}
      <input
        className="bg-white px-4 py-2 w-80 rounded text-center text-lg"
        placeholder="Enter your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      {/* Choosing Avatar */}
      <div className="mt-6 flex flex-col items-center relative">
        <div className="text-6xl mb-2">{avatar}</div>
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="text-white font-medium underline hover:text-purple-900"
        >
          Change Avatar
        </button>

        {/* Emoji Picker */}
        {showPicker && (
          <div className="absolute mt-4 z-10">
            <EmojiPicker
              onEmojiClick={(emojiData) => {
                setAvatar(emojiData.emoji);
                setShowPicker(false);
              }}
              theme="light"
              searchDisabled={false}
              width={300}
              height={400}
            />
          </div>
        )}
      </div>

      {/*Join Button */}
      <button
        onClick={savePlayer}
        className="mt-6 bg-purple-700 text-white px-10 py-3 rounded-lg hover:bg-purple-800 transition"
      >
        Join the game!
      </button>
    </div>
  );
}
