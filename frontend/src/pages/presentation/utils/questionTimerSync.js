const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const pickFirstNumber = (obj, keys) => {
  for (const key of keys) {
    const n = toNumber(obj?.[key]);
    if (n != null) return n;
  }
  return null;
};

const parseTimestampMs = (value) => {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    // Assume seconds when value looks like unix seconds.
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === "string") {
    const numeric = toNumber(value);
    if (numeric != null) {
      return numeric < 1e12 ? numeric * 1000 : numeric;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const buildIdentity = (question) =>
  `${String(question?.question_id ?? "na")}:${String(question?.run_id ?? "na")}`;

const getTimerStateKey = (roomId, role) =>
  `presentation_question_timer_v1:${String(role || "unknown")}:${String(
    roomId || "unknown"
  )}`;

const readTimerBucket = (roomId, role) => {
  try {
    const raw = localStorage.getItem(getTimerStateKey(roomId, role));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
};

const readTimerState = (roomId, role, identity) => {
  const bucket = readTimerBucket(roomId, role);
  if (!bucket) return null;

  // v2: bucketed by identity.
  if (bucket.entries && typeof bucket.entries === "object") {
    const entry = bucket.entries[identity];
    if (entry && typeof entry === "object") {
      return entry;
    }
    return null;
  }

  // v1 legacy: single identity payload.
  if (
    bucket.identity === identity &&
    Number.isFinite(Number(bucket.startMs))
  ) {
    return bucket;
  }
  return null;
};

const writeTimerState = (roomId, role, state) => {
  try {
    const bucket = readTimerBucket(roomId, role);
    const entries =
      bucket?.entries && typeof bucket.entries === "object"
        ? { ...bucket.entries }
        : {};

    entries[state.identity] = state;

    // Keep storage bounded.
    const sorted = Object.values(entries).sort(
      (a, b) => Number(b?.updatedAt ?? 0) - Number(a?.updatedAt ?? 0)
    );
    const top = sorted.slice(0, 20);
    const nextEntries = {};
    for (const item of top) {
      if (!item?.identity) continue;
      nextEntries[item.identity] = item;
    }

    localStorage.setItem(
      getTimerStateKey(roomId, role),
      JSON.stringify({
        version: 2,
        entries: nextEntries,
      })
    );
  } catch {
    // ignore storage errors
  }
};

export const resolveQuestionTimer = ({ question, roomId, role, nowMs = Date.now() }) => {
  const totalSeconds = Math.max(0, toNumber(question?.question_time) ?? 0);
  const identity = buildIdentity(question);

  // Prefer explicit remaining-time fields from server when available.
  const explicitRemainingSeconds = pickFirstNumber(question, [
    "remaining_time",
    "remaining_seconds",
    "time_left",
    "time_left_seconds",
    "question_remaining_time",
  ]);

  // Fallback: infer from explicit start timestamp.
  const explicitStartMs = parseTimestampMs(
    question?.started_at ??
      question?.start_time ??
      question?.question_started_at ??
      question?.question_start_time
  );

  let remainingSeconds = totalSeconds;
  let anchorStartMs = nowMs;

  if (explicitRemainingSeconds != null) {
    remainingSeconds = Math.max(0, Math.min(totalSeconds, explicitRemainingSeconds));
    anchorStartMs = nowMs - (totalSeconds - remainingSeconds) * 1000;
  } else if (explicitStartMs != null) {
    const elapsed = (nowMs - explicitStartMs) / 1000;
    remainingSeconds = Math.max(0, totalSeconds - elapsed);
    anchorStartMs = explicitStartMs;
  } else {
    const persisted = readTimerState(roomId, role, identity);
    if (
      persisted &&
      persisted.identity === identity &&
      Number.isFinite(Number(persisted.startMs))
    ) {
      anchorStartMs = Number(persisted.startMs);
      const elapsed = (nowMs - anchorStartMs) / 1000;
      const looksStale = elapsed < -5 || elapsed > totalSeconds + 300;
      if (!looksStale) {
        remainingSeconds = Math.max(0, totalSeconds - elapsed);
      } else {
        anchorStartMs = nowMs;
        remainingSeconds = totalSeconds;
      }
    }
  }

  writeTimerState(roomId, role, {
    identity,
    startMs: anchorStartMs,
    totalSeconds,
    updatedAt: nowMs,
  });

  return {
    identity,
    totalSeconds,
    anchorStartMs,
    remainingSeconds,
  };
};
