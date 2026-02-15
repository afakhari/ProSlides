import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pickAnswerPath =
  "frontend/src/pages/presentation/manager/PickAnswerQuestion.jsx";
const managerLeaderboardPath =
  "frontend/src/pages/presentation/manager/LeaderBoard.jsx";

test("manager question page waits for server results and has no mock-vote fallback", () => {
  const src = readFileSync(pickAnswerPath, "utf8");
  assert.equal(src.includes("awaitingServerResults"), true);
  assert.equal(src.includes("Waiting for server results"), true);
  assert.equal(src.includes("mockVotes"), false);
  assert.equal(src.includes("Using mock votes"), false);
});

test("manager question page normalizes question data before rendering options", () => {
  const src = readFileSync(pickAnswerPath, "utf8");
  assert.equal(src.includes("const normalizeQuestion = (question) =>"), true);
  assert.equal(src.includes("quiz?.slides?.[currentSlide - 1]"), true);
  assert.equal(src.includes("const questionOptions = currentQuestion.options;"), true);
  assert.equal(src.includes("new Array(currentOptionCount).fill(0)"), true);
  assert.equal(src.includes("currentQuestion.options.length"), false);
});

test("manager leaderboard guards maxScore for empty players list", () => {
  const src = readFileSync(managerLeaderboardPath, "utf8");
  assert.equal(src.includes("players.length > 0 ? Math.max"), true);
  assert.equal(src.includes("if (maxScore <= minScore) return score > 0 ? 100 : 0;"), true);
});
