/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useEffect, useRef, useState } from "react";
import {
  LiveAPIError,
  applyLiveAction,
  createLiveSession,
  createRequestId,
  getLiveSnapshot,
  getRosterPage,
  joinLiveSession,
  streamLiveEvents,
  submitLiveAnswer,
} from "../live/liveApi";
import { advanceLiveCursor, liveCursorFromSnapshot, planLiveEnd, planLiveNavigation, shouldApplyLiveEvent } from "../live/protocol";

export const LiveSessionContext = createContext(null);

const delay = (milliseconds, signal) =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });

export const LiveSessionProvider = ({ children, role = "manager" }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [lastEvent, setLastEvent] = useState(null);
  const [lastMessage, setLastMessage] = useState(null);
  const [roster, setRoster] = useState([]);
  const [rosterOrder, setRosterOrder] = useState("joined");
  const [hasMoreRoster, setHasMoreRoster] = useState(false);
  const [isRosterLoading, setIsRosterLoading] = useState(false);

  const sessionIdRef = useRef(null);
  const snapshotRef = useRef(null);
  const cursorRef = useRef({ eventId: 0, stateVersion: 0 });
  const rosterCursorRef = useRef("");
  const rosterOrderRef = useRef("joined");
  const rosterRef = useRef([]);
  const streamEnabledRef = useRef(false);
  const refreshPromiseRef = useRef(null);
  const commandInFlightRef = useRef(false);

  const storeSnapshot = useCallback((next) => {
    snapshotRef.current = next;
    cursorRef.current = liveCursorFromSnapshot(next);
    setSnapshot(next);
    setLastMessage(next);
  }, []);

  const loadRoster = useCallback(async (order = rosterOrderRef.current, append = false) => {
    const id = sessionIdRef.current;
    if (!id || role !== "manager") return false;
    setIsRosterLoading(true);
    try {
      const cursor = append && order === rosterOrderRef.current ? rosterCursorRef.current : "";
      const page = await getRosterPage(id, order, cursor, 100);
      const nextItems = append ? [...rosterRef.current, ...page.items] : page.items;
      rosterRef.current = nextItems;
      rosterCursorRef.current = page.next_cursor || "";
      rosterOrderRef.current = order;
      setRoster(nextItems);
      setRosterOrder(order);
      setHasMoreRoster(page.has_more);
      return true;
    } catch (error) {
      setConnectionError(error.message);
      return false;
    } finally {
      setIsRosterLoading(false);
    }
  }, [role]);

  const refreshAuthoritative = useCallback(async () => {
    const id = sessionIdRef.current;
    if (!id) throw new Error("Live session is not selected");
    if (refreshPromiseRef.current) return refreshPromiseRef.current;
    refreshPromiseRef.current = (async () => {
      const next = await getLiveSnapshot(id);
      storeSnapshot(next);
      if (next.role === "manager") {
        await loadRoster(["leaderboard", "ended"].includes(next.session.state) ? "score" : "joined", false);
      } else {
        rosterRef.current = [];
        setRoster([]);
        setHasMoreRoster(false);
      }
      return next;
    })();
    try {
      return await refreshPromiseRef.current;
    } finally {
      refreshPromiseRef.current = null;
    }
  }, [loadRoster, storeSnapshot]);

  const connect = useCallback(async (identifier) => {
    if (!identifier) return false;
    setConnectionError(null);
    sessionIdRef.current = String(identifier);
    setSessionId(String(identifier));
    try {
      let next;
      if (role === "manager") {
        const key = `proslides_live_create_request:${identifier}`;
        let requestId = sessionStorage.getItem(key);
        if (!requestId) {
          requestId = createRequestId();
          sessionStorage.setItem(key, requestId);
        }
        let created = await createLiveSession(String(identifier), requestId);
        sessionIdRef.current = created.id;
        setSessionId(created.id);
        next = await getLiveSnapshot(created.id);
        if (next.session.state === "ended") {
          requestId = createRequestId();
          sessionStorage.setItem(key, requestId);
          created = await createLiveSession(String(identifier), requestId);
          sessionIdRef.current = created.id;
          setSessionId(created.id);
          next = await getLiveSnapshot(created.id);
        }
      } else {
        // A participant has no snapshot authorization until the idempotent
        // join command establishes their identity. Mark the transport ready so
        // PlayerJoinPage can issue that command without a guaranteed 401 probe.
        streamEnabledRef.current = false;
        setIsConnected(true);
        return true;
      }
      if (next.role === "manager" && next.session.state === "draft") {
        const lobbyKey = `proslides_live_lobby_request:${next.session.id}`;
        let lobbyRequestId = sessionStorage.getItem(lobbyKey);
        if (!lobbyRequestId) {
          lobbyRequestId = createRequestId();
          sessionStorage.setItem(lobbyKey, lobbyRequestId);
        }
        try {
          await applyLiveAction(next.session.id, {
            request_id: lobbyRequestId,
            expected_state_version: next.session.state_version,
            action: "start",
          });
        } catch (error) {
          if (!(error instanceof LiveAPIError) || error.status !== 409) throw error;
        }
        next = await getLiveSnapshot(next.session.id);
        if (next.session.state === "draft") throw new Error("Live session could not enter the lobby");
      }
      streamEnabledRef.current = true;
      storeSnapshot(next);
      if (next.role === "manager") await loadRoster(["leaderboard", "ended"].includes(next.session.state) ? "score" : "joined", false);
      setIsConnected(true);
      return true;
    } catch (error) {
      setConnectionError(error.message);
      setIsConnected(false);
      return false;
    }
  }, [loadRoster, role, storeSnapshot]);

  const disconnect = useCallback(() => {
    streamEnabledRef.current = false;
    sessionIdRef.current = null;
    snapshotRef.current = null;
    setSessionId(null);
    setSnapshot(null);
    setRoster([]);
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (!sessionId || !streamEnabledRef.current || !snapshot?.role) return;
    const controller = new AbortController();
    let retry = 500;
    const run = async () => {
      while (!controller.signal.aborted) {
        try {
          setIsConnected(true);
          setConnectionError(null);
          await streamLiveEvents(sessionId, cursorRef.current.eventId, {
            signal: controller.signal,
            onEvent: (event) => {
              if (!shouldApplyLiveEvent(cursorRef.current, event)) return;
              cursorRef.current = advanceLiveCursor(cursorRef.current, event);
              setLastEvent(event);
              setLastMessage(event);
              retry = 500;
              if (["session.created", "presence.updated", "session.state_changed", "leaderboard.updated"].includes(event.name)) {
                void refreshAuthoritative().catch((error) => setConnectionError(error.message));
              }
            },
          });
          if (!controller.signal.aborted) throw new Error("event_stream_closed");
        } catch (error) {
          if (controller.signal.aborted) return;
          setIsConnected(false);
          setConnectionError(error.message);
          await delay(retry, controller.signal);
          retry = Math.min(retry * 2, 10_000);
          if (controller.signal.aborted) return;
          try {
            await refreshAuthoritative();
          } catch (snapshotError) {
            setConnectionError(snapshotError.message);
          }
        }
      }
    };
    void run();
    return () => controller.abort();
  }, [sessionId, snapshot?.role, refreshAuthoritative]);

  const runAction = useCallback(async (action, slide) => {
    const id = sessionIdRef.current;
    const current = snapshotRef.current;
    if (!id || current?.role !== "manager") return false;
    const result = await applyLiveAction(id, {
      request_id: createRequestId(),
      expected_state_version: current.session.state_version,
      action,
      ...(slide?.slide_id ? { slide_id: String(slide.slide_id) } : {}),
      ...(action === "open_question" && slide?.question_time ? { duration_seconds: Number(slide.question_time) } : {}),
    });
    const next = { ...current, session: result };
    snapshotRef.current = next;
    setSnapshot(next);
    return true;
  }, []);

  const sendNavigation = useCallback(async (command, options = {}) => {
    if (commandInFlightRef.current) return false;
    commandInFlightRef.current = true;
    try {
      const actions = planLiveNavigation(snapshotRef.current?.session?.state, command, options.slide);
      for (const action of actions) {
        const applied = await runAction(action, action === "open_question" || action === "open_content" ? options.slide : undefined);
        if (!applied) throw new Error("Live action was not authorized");
      }
      await refreshAuthoritative();
      return true;
    } catch (error) {
      setConnectionError(error.message);
      return false;
    } finally {
      commandInFlightRef.current = false;
    }
  }, [refreshAuthoritative, runAction]);

  const sendEnd = useCallback(async () => {
    if (commandInFlightRef.current) return false;
    commandInFlightRef.current = true;
    try {
      for (const action of planLiveEnd(snapshotRef.current?.session?.state)) {
        if (!(await runAction(action))) throw new Error("Live end action was not authorized");
      }
      await refreshAuthoritative();
      return true;
    } catch (error) {
      setConnectionError(error.message);
      return false;
    } finally {
      commandInFlightRef.current = false;
    }
  }, [refreshAuthoritative, runAction]);

  const sendMessage = useCallback(async (message) => {
    const id = sessionIdRef.current;
    if (!id || !message) return false;
    try {
      if (message.type === 6) {
        const requestId = /^[0-9a-f-]{36}$/i.test(String(message.user_id || "")) ? String(message.user_id) : createRequestId();
        try {
          const participant = await joinLiveSession(id, { request_id: requestId, display_name: message.name, avatar: message.character || "" });
          setLastMessage({ type: 10, user_id: requestId, participant_id: participant.id, name: participant.display_name, character: participant.avatar || "" });
          streamEnabledRef.current = true;
          await refreshAuthoritative();
          setIsConnected(true);
          return true;
        } catch (error) {
          setConnectionError(error.message);
          if (error instanceof LiveAPIError && [400, 409].includes(error.status)) return "rejected";
          setIsConnected(false);
          return false;
        }
      }
      if (message.type === 4) {
        const selected = (message.options_result || []).map((option, index) => ({ option, index })).filter(({ option }) => option.picked).map(({ option, index }) => Number(option.option_index ?? option.option_id ?? index));
        try {
          await submitLiveAnswer(id, { request_id: message.request_id || createRequestId(), question_slide_id: String(message.question_id), selected_option_indexes: selected });
          return true;
        } catch (error) {
          setConnectionError(error.message);
          if (error instanceof LiveAPIError && [400, 401, 409].includes(error.status)) return "rejected";
          return false;
        }
      }
      return false;
    } catch (error) {
      setConnectionError(error.message);
      return false;
    }
  }, [refreshAuthoritative]);

  return (
    <LiveSessionContext.Provider value={{
      isConnected, connectionError, sessionId, snapshot, lastEvent, lastMessage,
      roster, rosterOrder, hasMoreRoster, isRosterLoading,
      participantCount: snapshot?.participant_count || 0,
      connect, disconnect, sendMessage, sendNavigation, sendEnd,
      loadMoreRoster: () => loadRoster(rosterOrderRef.current, true),
    }}>
      {children}
    </LiveSessionContext.Provider>
  );
};
