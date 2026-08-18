import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { apiFetch } from "../utils/apiFetch";

export default function RequireSession({ children }) {
  const location = useLocation();
  const [state, setState] = useState("loading");

  useEffect(() => {
    const controller = new AbortController();
    void apiFetch("/auth/me", { signal: controller.signal }).then(async (response) => {
      if (!response.ok) {
        setState("anonymous");
        return;
      }
      const user = await response.json();
      localStorage.setItem("auth.name", user.display_name || "You");
      localStorage.setItem("auth.email", user.email || "");
      setState("authenticated");
    }).catch((error) => {
      if (error.name !== "AbortError") setState("anonymous");
    });
    return () => controller.abort();
  }, []);

  if (state === "loading") return <div className="min-h-screen bg-white" aria-busy="true" />;
  if (state === "anonymous") return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  return children;
}
