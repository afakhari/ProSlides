import { buildApiUrl } from "./api";

const cookieValue = (name) => {
  if (typeof document === "undefined") return "";
  const prefix = `${encodeURIComponent(name)}=`;
  const item = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : "";
};

const hasHeader = (headers, key) =>
  Object.keys(headers || {}).some((header) => header.toLowerCase() === key);

export const apiFetch = (path, options = {}) => {
  const { auth: _auth = true, headers = {}, json, ...init } = options;
  const finalHeaders = { ...headers };
  let body = init.body;
  if (json !== undefined) {
    body = JSON.stringify(json);
    if (!hasHeader(finalHeaders, "content-type")) finalHeaders["Content-Type"] = "application/json";
  }
  if (!["GET", "HEAD"].includes(String(init.method || "GET").toUpperCase())) {
    const csrf = cookieValue("proslides_csrf");
    if (csrf && !hasHeader(finalHeaders, "x-csrf-token")) finalHeaders["X-CSRF-Token"] = csrf;
  }
  return fetch(buildApiUrl(path), { ...init, headers: finalHeaders, body, credentials: "include" });
};
