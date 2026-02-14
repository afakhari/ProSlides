/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useEffect, useRef, useState } from "react";

export const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children, role = "manager" }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [type8Message, setType8Message] = useState(null); // type:8 message stash
  const [connectionError, setConnectionError] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const manualCloseRef = useRef(false);
  const [sessionId, setSessionId] = useState(null);
  const sessionIdRef = useRef(null);

  const connect = (sessionIdInput) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("[WS] Already connected");
      return;
    }
    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      console.log("[WS] Already connecting");
      return;
    }

    sessionIdRef.current = sessionIdInput;
    manualCloseRef.current = false;

    try {
      // const wsUrl = `ws://localhost:8080/ws/${sessionIdInput}/${role}`;
      const wsUrl = `wss://present.proslides.ir/ws/${sessionIdInput}/${role}`;
      console.log(`[WS] Connecting to: ${wsUrl}`);

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("[WS] Connected as", role);
        setIsConnected(true);
        setConnectionError(null);
        setSessionId(sessionIdInput);
      };

      ws.onclose = (event) => {
        const reason = event?.reason ? `: ${event.reason}` : "";
        console.log(`[WS] Disconnected (${event?.code ?? "unknown"}${reason})`);
        setIsConnected(false);
        wsRef.current = null;

        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }

        if (manualCloseRef.current) {
          console.log("[WS] Manual close detected; reconnect skipped");
          return;
        }

        reconnectTimeoutRef.current = setTimeout(() => {
          const idToUse = sessionIdRef.current || sessionId;
          if (idToUse) {
            console.log("[WS] Attempting to reconnect...");
            connect(idToUse);
          }
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error("[WS] Error:", error);
        setConnectionError("\u062e\u0637\u0627\u06cc \u0627\u062a\u0635\u0627\u0644 \u0648\u0628\u200c\u0633\u0648\u06a9\u062a");
      };

      ws.onmessage = (event) => {
        console.log("[WS] Received:", event.data);

        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          if (data.type === 8) {
            console.log("[WS] Type 8 stored separately");
            setType8Message({ ...data, _timestamp: Date.now() });
          }
        } catch {
          console.log("[WS] Text message:", event.data);
          if (!event.data.startsWith("OK")) {
            setLastMessage({ type: "text", content: event.data });
          }
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("[WS] Failed to create WebSocket:", error);
      setConnectionError(error.message);
    }
  };

  const disconnect = () => {
    manualCloseRef.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setSessionId(null);
    sessionIdRef.current = null;
  };

  const sendMessage = (message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const messageStr =
        typeof message === "string" ? message : JSON.stringify(message);
      wsRef.current.send(messageStr);
      console.log("[WS] Sent:", messageStr);
      return true;
    }

    console.error("[WS] WebSocket is not connected");
    return false;
  };

  const sendNavigation = (action) => {
    const msg = {
      type: 9,
      action: action,
    };
    return sendMessage(msg);
  };

  const sendEnd = () => {
    const msg = {
      type: 9,
      action: "end",
    };
    return sendMessage(msg);
  };

  useEffect(() => {
    return () => {
      manualCloseRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const value = {
    isConnected,
    lastMessage,
    type8Message,
    connectionError,
    sessionId,
    connect,
    disconnect,
    sendMessage,
    sendNavigation,
    sendEnd,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
