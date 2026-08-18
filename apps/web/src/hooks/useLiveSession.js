import { useContext } from "react";
import { LiveSessionContext } from "../contexts/LiveSessionContext";

export const useLiveSession = () => {
  const context = useContext(LiveSessionContext);
  if (!context) throw new Error("useLiveSession must be used within LiveSessionProvider");
  return context;
};
