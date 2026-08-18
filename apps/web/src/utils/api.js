const DEFAULT_API_BASE = "/api/v1";

const normalizeBase = (base) => {
  if (!base) return "";
  return base.trim().replace(/\/+$/, "");
};

export const getApiBase = () => {
  const envBase = import.meta.env?.VITE_API_BASE_URL;
  if (envBase && envBase.trim()) {
    return normalizeBase(envBase);
  }
  return normalizeBase(DEFAULT_API_BASE);
};

export const buildApiUrl = (path = "") => {
  const base = getApiBase();
  if (!path) return base;
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${base}/${normalizedPath}`;
};
