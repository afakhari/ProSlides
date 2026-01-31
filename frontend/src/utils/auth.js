export const getAuthHeaders = (headers = {}) => {
  const token = localStorage.getItem("auth.access");
  if (!token) {
    return headers;
  }
  return { ...headers, Authorization: `Bearer ${token}` };
};

export const getRefreshToken = () => localStorage.getItem("auth.refresh");

export const clearAuthStorage = () => {
  localStorage.removeItem("auth.access");
  localStorage.removeItem("auth.refresh");
  localStorage.removeItem("auth.name");
  localStorage.removeItem("auth.email");
  localStorage.removeItem("auth.promptSetPassword");
};

export const notifyAuthExpired = (reason = "session-expired") => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("auth-expired", {
      detail: { reason },
    })
  );
};

export const notifyAppNotice = (key, tone = "info") => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("app-notice", {
      detail: { key, tone },
    })
  );
};
