const DEFAULT_API_BASE = "/api/v1";

const normalizeBase = (base: string): string => base.trim().replace(/\/+$/, "");

export const getApiBase = (): string => {
  const envBase = import.meta.env?.VITE_API_BASE_URL;
  return envBase && envBase.trim() ? normalizeBase(envBase) : DEFAULT_API_BASE;
};

export const buildApiUrl = (path = ""): string => {
  const base = getApiBase();
  if (!path) return base;
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${base}/${normalizedPath}`;
};
