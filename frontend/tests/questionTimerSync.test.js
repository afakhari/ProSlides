import test from "node:test";
import assert from "node:assert/strict";
import { resolveQuestionTimer } from "../src/pages/presentation/utils/questionTimerSync.js";

const createStorage = () => {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
};

test("timer state is stored per identity and not clobbered by temporary identity", () => {
  globalThis.localStorage = createStorage();

  const roomId = "33";
  const role = "manager";

  const first = resolveQuestionTimer({
    question: {
      question_id: 10,
      run_id: 500,
      question_time: 20,
      remaining_seconds: 18,
    },
    roomId,
    role,
    nowMs: 100000,
  });
  assert.equal(Math.round(first.remainingSeconds), 18);

  // Temporary question identity without run_id should not destroy the run-scoped timer state.
  resolveQuestionTimer({
    question: {
      question_id: 10,
      question_time: 20,
    },
    roomId,
    role,
    nowMs: 101000,
  });

  const resumed = resolveQuestionTimer({
    question: {
      question_id: 10,
      run_id: 500,
      question_time: 20,
    },
    roomId,
    role,
    nowMs: 101000,
  });

  assert.equal(resumed.totalSeconds, 20);
  assert.equal(resumed.remainingSeconds < 20, true);
  assert.equal(resumed.remainingSeconds > 0, true);
});
