import { buildApiUrl } from "./api";
import {
  clearAuthStorage,
  getAuthHeaders,
  getRefreshToken,
  notifyAuthExpired,
  notifyAppNotice,
} from "./auth";

const isAuthFailureStatus = (status) => status === 401 || status === 419;
const isForbiddenStatus = (status) => status === 403;
const isRateLimitStatus = (status) => status === 429;

const hasHeader = (headers, key) =>
  Object.keys(headers || {}).some((header) => header.toLowerCase() === key);

let refreshPromise = null;

const refreshAccessToken = async () => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refresh = getRefreshToken();
    if (!refresh) return null;

    const response = await fetch(buildApiUrl("/auth/token/refresh/"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!response.ok) {
      clearAuthStorage();
      return null;
    }
    const payload = await response.json().catch(() => null);
    if (payload?.access) {
      localStorage.setItem("auth.access", payload.access);
      return payload.access;
    }
    clearAuthStorage();
    return null;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
};

const executeFetch = async (path, options, didRefresh) => {
  const { auth = true, headers = {}, json, silent = false, ...init } = options;
  const finalHeaders = { ...headers };

  if (auth && !hasHeader(finalHeaders, "authorization")) {
    Object.assign(finalHeaders, getAuthHeaders());
  }

  let body = init.body;
  if (json !== undefined) {
    body = JSON.stringify(json);
    if (!hasHeader(finalHeaders, "content-type")) {
      finalHeaders["Content-Type"] = "application/json";
    }
  }

  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: finalHeaders,
    body,
  });

  if (auth && isAuthFailureStatus(response.status) && !didRefresh) {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearAuthStorage();
      if (!silent) {
        notifyAuthExpired("auth-required");
      }
      return response;
    }

    const newAccess = await refreshAccessToken();
    if (newAccess) {
      return executeFetch(path, { ...options }, true);
    }
    clearAuthStorage();
    if (!silent) {
      notifyAuthExpired("session-expired");
    }
  }

  if (auth && isAuthFailureStatus(response.status) && didRefresh) {
    clearAuthStorage();
    if (!silent) {
      notifyAuthExpired("session-expired");
    }
  }

  if (!silent && isForbiddenStatus(response.status)) {
    notifyAppNotice("access-denied", "error");
  }

  if (!silent && isRateLimitStatus(response.status)) {
    notifyAppNotice("rate-limit", "warning");
  }

  return response;
};

export const apiFetch = (path, options = {}) =>
  executeFetch(path, options, false);
