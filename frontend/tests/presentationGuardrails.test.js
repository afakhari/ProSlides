import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pickAnswerPath =
  "frontend/src/pages/presentation/manager/PickAnswerQuestion.jsx";
const managerLeaderboardPath =
  "frontend/src/pages/presentation/manager/LeaderBoard.jsx";
const managerJoinPath =
  "frontend/src/pages/presentation/manager/JoinPage.jsx";
const presentationEntryPath =
  "frontend/src/routes/PresentationEntry.jsx";
const appPath = "frontend/src/App.jsx";
const playerLeaderboardPath =
  "frontend/src/pages/presentation/player/LeaderBoard.jsx";
const playerQuestionPath =
  "frontend/src/pages/presentation/player/PickAnswerQuestion.jsx";
const playerJoinPath =
  "frontend/src/pages/presentation/player/JoinPage.jsx";
const managerQuestionPath =
  "frontend/src/pages/presentation/manager/PickAnswerQuestion.jsx";
const timerSyncPath =
  "frontend/src/pages/presentation/utils/questionTimerSync.js";

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

test("manager join page avoids resending start when session is already active", () => {
  const src = readFileSync(managerJoinPath, "utf8");
  assert.equal(src.includes("const sessionInProgress ="), true);
  assert.equal(src.includes("Session is already in progress."), true);
  assert.equal(src.includes("if (sessionInProgress)"), true);
});

test("manager join page clears stale state and waits for sync before start", () => {
  const src = readFileSync(managerJoinPath, "utf8");
  assert.equal(src.includes("clearData();"), false);
  assert.equal(src.includes("const [hasSyncedState, setHasSyncedState]"), true);
  assert.equal(src.includes("if (!hasSyncedState)"), true);
});

test("manager join next-action prefers server state over forcing question slide", () => {
  const src = readFileSync(presentationEntryPath, "utf8");
  assert.equal(src.includes("if (hasLeaderboardEntries(leaderboardResults))"), true);
  assert.equal(src.includes("if (currentContent)"), true);
  assert.equal(src.includes("if (currentQuestion)"), true);
});

test("manager route waits for initial live sync before rendering join flow", () => {
  const src = readFileSync(presentationEntryPath, "utf8");
  assert.equal(src.includes("const [managerHasSyncedState, setManagerHasSyncedState]"), true);
  assert.equal(src.includes("Waiting message=\"Syncing live session...\""), true);
  assert.equal(src.includes("isConnected ? 2500 : 3500"), true);
});

test("player should not render leaderboard before seeing an active slide", () => {
  const src = readFileSync(presentationEntryPath, "utf8");
  assert.equal(src.includes("const [playerHasSeenActiveSlide, setPlayerHasSeenActiveSlide]"), true);
  assert.equal(src.includes("if (currentQuestion || currentContent)"), true);
  assert.equal(src.includes("if (hasLeaderboard && playerHasSeenActiveSlide)"), true);
  assert.equal(src.includes("sessionStorage.setItem(playerActiveSlideSeenKey, \"1\")"), true);
  assert.equal(src.includes("requireProfileSelection={shouldPromptPlayerProfileSelection}"), true);
});

test("access-code route uses unified PresentationEntry resolver", () => {
  const src = readFileSync(appPath, "utf8");
  assert.equal(
    src.includes('<Route path="/:accessCode" element={<PresentationEntry mode="accessCode" />} />'),
    true
  );
});

test("player leaderboard guards maxScore for empty players list", () => {
  const src = readFileSync(playerLeaderboardPath, "utf8");
  assert.equal(src.includes("validPlayers.length > 0"), true);
  assert.equal(src.includes("if (maxScore <= minScore) return val > 0 ? 100 : 0;"), true);
});

test("player answer queue is room-scoped and pruned by current question", () => {
  const src = readFileSync(playerQuestionPath, "utf8");
  assert.equal(src.includes("presentation_answer_queue_v2:"), true);
  assert.equal(src.includes("pruneQueuedAnswersForCurrentQuestion"), true);
  assert.equal(src.includes("localStorage.removeItem(LEGACY_ANSWER_QUEUE_KEY)"), true);
});

test("player and manager question timers use persisted timer sync", () => {
  const playerSrc = readFileSync(playerQuestionPath, "utf8");
  const managerSrc = readFileSync(managerQuestionPath, "utf8");
  const timerSyncSrc = readFileSync(timerSyncPath, "utf8");
  assert.equal(playerSrc.includes("resolveQuestionTimer"), true);
  assert.equal(managerSrc.includes("resolveQuestionTimer"), true);
  assert.equal(managerSrc.includes("questionAnchorStartMs"), true);
  assert.equal(timerSyncSrc.includes("const looksStale ="), true);
});

test("player join supports forcing profile selection for a new run", () => {
  const src = readFileSync(playerJoinPath, "utf8");
  assert.equal(src.includes("requireProfileSelection = false"), true);
  assert.equal(src.includes("Boolean(restoredProfile) && !requireProfileSelection"), true);
  assert.equal(src.includes("setJoined(!requireProfileSelection);"), true);
});
