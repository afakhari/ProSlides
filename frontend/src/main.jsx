import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { AudioProvider } from "./contexts/AudioContext";

const root = createRoot(document.getElementById("root"));

root.render(
  <AudioProvider>
    <App />
  </AudioProvider>
);
