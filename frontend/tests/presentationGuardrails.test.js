import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pickAnswerPath =
  "frontend/src/pages/presentation/manager/PickAnswerQuestion.jsx";

test("manager question page waits for server results and has no mock-vote fallback", () => {
  const src = readFileSync(pickAnswerPath, "utf8");
  assert.equal(src.includes("awaitingServerResults"), true);
  assert.equal(src.includes("Waiting for server results"), true);
  assert.equal(src.includes("mockVotes"), false);
  assert.equal(src.includes("Using mock votes"), false);
});

