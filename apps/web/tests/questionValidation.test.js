import test from "node:test";
import assert from "node:assert/strict";

import { getQuestionValidationError } from "../src/pages/quiz/manager/questionValidation.js";

const validQuestion = {
  question_text: "Choose",
  question_type: "multiple",
  question_time: 30,
  min_point: 0,
  max_point: 100,
  options: [
    { text: "A", is_correct: true },
    { text: "B", is_correct: false },
  ],
};

test("accepts a complete question", () => {
  assert.equal(getQuestionValidationError(validQuestion), null);
});

test("rejects invalid scoring and timing ranges", () => {
  assert.match(getQuestionValidationError({ ...validQuestion, question_time: 0 }), /time/i);
  assert.match(getQuestionValidationError({ ...validQuestion, min_point: 101 }), /points/i);
  assert.match(getQuestionValidationError({ ...validQuestion, max_point: 0 }), /points/i);
});

test("rejects incomplete and inconsistent options", () => {
  assert.match(getQuestionValidationError({ ...validQuestion, options: [{ text: "A", is_correct: true }] }), /two options/i);
  assert.match(getQuestionValidationError({ ...validQuestion, question_type: "single", options: validQuestion.options.map((option) => ({ ...option, is_correct: true })) }), /exactly one/i);
});
