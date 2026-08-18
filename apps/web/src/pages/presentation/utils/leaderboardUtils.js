export function hasLeaderboardEntries(payload) {
  if (!payload) return false;
  if (Array.isArray(payload)) return payload.length > 0;
  if (Array.isArray(payload.results)) return payload.results.length > 0;
  return false;
}

