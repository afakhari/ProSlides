import { buildApiUrl } from "./api";
import { getAuthHeaders } from "./auth";

const hasHeader = (headers, key) =>
  Object.keys(headers || {}).some((header) => header.toLowerCase() === key);

export const apiFetch = (path, options = {}) => {
  const { auth = true, headers = {}, json, ...init } = options;
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

  return fetch(buildApiUrl(path), {
    ...init,
    headers: finalHeaders,
    body,
  });
};
