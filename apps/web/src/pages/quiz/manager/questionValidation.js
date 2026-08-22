export const getQuestionValidationError = (question) => {
  if (!question || typeof question !== "object") return "Add a question before presenting.";

  const text = String(question.text ?? question.question_text ?? "").trim();
  if (!text) return "Enter the question text.";

  const options = Array.isArray(question.options) ? question.options : [];
  if (options.length < 2) return "Add at least two options.";
  if (options.some((option) => !String(option.text ?? option.option_text ?? "").trim())) {
    return "Every option must have text.";
  }

  const type = question.question_type;
  if (type !== "single" && type !== "multiple") return "Select a valid question type.";
  const correctCount = options.filter((option) => option.is_correct === true).length;
  if (correctCount === 0) return "Select at least one correct option.";
  if (type === "single" && correctCount !== 1) return "Single choice questions need exactly one correct option.";

  const duration = Number(question.question_time ?? question.time_limit);
  if (!Number.isInteger(duration) || duration < 1 || duration > 86400) {
    return "Question time must be between 1 and 86400 seconds.";
  }

  const minPoints = Number(question.min_point);
  const maxPoints = Number(question.max_point);
  if (!Number.isInteger(minPoints) || minPoints < 0 || !Number.isInteger(maxPoints) || maxPoints < 1 || minPoints > maxPoints) {
    return "Points must be whole numbers with 0 <= minimum <= maximum.";
  }

  return null;
};
