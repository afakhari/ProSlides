import test from "node:test";
import assert from "node:assert/strict";
import {
  PLAYER_PROFILE_KEY,
  DEFAULT_AVATAR,
  readStoredProfile,
  saveStoredProfile,
  createJoinMessage,
} from "../src/pages/presentation/player/playerProfileStorage.js";

const createMemoryStorage = () => {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
};

test.beforeEach(() => {
  globalThis.localStorage = createMemoryStorage();
});

test("saveStoredProfile persists normalized room-scoped profile", () => {
  saveStoredProfile({
    room_id: 33,
    name: "  ali  ",
    avatar: "",
    user_id: 99,
  });

  const raw = globalThis.localStorage.getItem(PLAYER_PROFILE_KEY);
  const parsed = JSON.parse(raw);
  assert.equal(parsed.room_id, "33");
  assert.equal(parsed.name, "ali");
  assert.equal(parsed.avatar, DEFAULT_AVATAR);
  assert.equal(parsed.user_id, "99");
});

test("readStoredProfile returns null for different room", () => {
  saveStoredProfile({ room_id: 33, name: "ali", avatar: "🦊", user_id: "u1" });
  assert.equal(readStoredProfile(44), null);
});

test("readStoredProfile returns null for malformed payload", () => {
  globalThis.localStorage.setItem(PLAYER_PROFILE_KEY, "{not-json");
  assert.equal(readStoredProfile(33), null);
});

test("createJoinMessage includes persisted user_id only when present", () => {
  const withId = createJoinMessage({
    name: "ali",
    avatar: "🦊",
    persistedUserId: "u-1",
  });
  assert.deepEqual(withId, {
    type: 6,
    name: "ali",
    character: "🦊",
    user_id: "u-1",
  });

  const withoutId = createJoinMessage({
    name: "ali",
    avatar: "🦊",
    persistedUserId: "",
  });
  assert.deepEqual(withoutId, {
    type: 6,
    name: "ali",
    character: "🦊",
  });
});
