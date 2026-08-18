/**
 * Generate a consistent color based on user_id
 * Uses a simple hash function to ensure the same user_id always gets the same color
 */

// پالت رنگ‌های زیبا و متنوع
const PLAYER_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#eab308", // yellow
  "#84cc16", // lime
  "#22c55e", // green
  "#10b981", // emerald
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#0ea5e9", // sky
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#d946ef", // fuchsia
  "#ec4899", // pink
  "#f43f5e", // rose
  "#78716c", // stone
];

/**
 * Simple hash function for strings/numbers
 * @param {string|number} input
 * @returns {number}
 */
function simpleHash(input) {
  const str = String(input);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Get a consistent color for a user based on their user_id
 * @param {string|number} userId - The user's unique identifier
 * @returns {string} - A hex color code
 */
export function getColorForUser(userId) {
  if (!userId) return PLAYER_COLORS[0];

  const hash = simpleHash(userId);
  const colorIndex = hash % PLAYER_COLORS.length;
  return PLAYER_COLORS[colorIndex];
}

/**
 * Get a consistent color with optional server color override
 * If server provides a color, use it; otherwise generate from user_id
 * @param {string|number} userId - The user's unique identifier
 * @param {string|null} serverColor - Optional color from server
 * @returns {string} - A hex color code
 */
export function getPlayerColor(userId, serverColor) {
  // اگه سرور رنگ داده، از رنگ سرور استفاده کن
  // اگه نداده، از user_id رنگ بساز
  if (serverColor && serverColor !== "#6366f1") {
    return serverColor;
  }
  return getColorForUser(userId);
}

function normalizeHex(input) {
  if (!input) return null;
  const value = String(input).trim();
  if (!value.startsWith("#")) return null;
  if (value.length === 4) {
    const r = value[1];
    const g = value[2];
    const b = value[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (value.length === 7) return value;
  return null;
}

export function isLightColor(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) return false;
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  // Relative luminance (sRGB)
  const srgb = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  return luminance > 0.6;
}

export default getColorForUser;
