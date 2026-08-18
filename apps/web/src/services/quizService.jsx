// Compatibility adapter between the existing editor view-model and the Go presentation contract.
import { apiFetch } from "../utils/apiFetch";

const parseResponse = async (response) => {
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error || `HTTP ${response.status}`);
    error.response = { status: response.status, data: payload };
    throw error;
  }
  return payload;
};

const request = async (path, options) => parseResponse(await apiFetch(path, options));
const newID = () => globalThis.crypto.randomUUID();

const normalizeOption = (option, index) => ({
  option_id: String(option?.id ?? option?.option_id ?? index),
  text: option?.text ?? option?.option_text ?? "",
  option_text: option?.text ?? option?.option_text ?? "",
  is_correct: option?.is_correct === true,
  image_url: option?.image_url || "",
  order: Number(option?.order ?? index + 1),
});

const slideToEditor = (slide) => {
  const content = slide?.content && typeof slide.content === "object" ? slide.content : {};
  const common = { slide_id: slide.id, order: slide.position, show_leaderboard_after: content.show_leaderboard_after === true };
  if (slide.kind === "question") {
    const options = Array.isArray(content.options) ? content.options.map(normalizeOption) : [];
    const question = {
      question_id: slide.id,
      title: content.title || "",
      text: content.text || "",
      question_text: content.text || "",
      question_type: content.question_type || "single",
      time_limit: Number(content.question_time || 10),
      question_time: Number(content.question_time || 10),
      min_point: Number(content.min_point || 0),
      max_point: Number(content.max_point || 100),
      image_url: content.image_url || "",
      question_image: content.image_url || "",
      faster_answers_more_points: content.faster_answers_more_points === true,
      partial_scoring: content.partial_scoring === true,
      options,
    };
    return { ...common, slide_type: 1, question };
  }
  if (slide.kind === "question_draft") return { ...common, slide_type: 1, question: null };
  if (slide.kind === "leaderboard") return { ...common, slide_type: 3, title: content.title || "Leaderboard" };
  return {
    ...common,
    slide_type: 2,
    title: content.title || "",
    content_text: content.text || content.content_text || "",
    content_image_url: content.image_url || content.content_image_url || "",
  };
};

const presentationToEditor = (presentation) => {
  const settings = presentation.settings || {};
  return {
    quiz_id: presentation.id,
    title: presentation.title,
    quiz_name: presentation.title,
    background_color: settings.background_color || "#f7f7fb",
    background_image_url: settings.background_image_url || "",
    text_color: settings.text_color || "#111827",
    music_url: settings.music_url || "",
    background: {
      color: settings.background_color || "#f7f7fb",
      image: settings.background_image_url || "",
      text_color: settings.text_color || "#111827",
    },
    slides: (presentation.slides || []).map(slideToEditor),
    created_at: presentation.created_at,
    last_update: presentation.updated_at,
  };
};

const editorSlideToDefinition = (slide, fallbackPosition = 0) => {
  const position = Number(slide.order ?? fallbackPosition);
  if (slide.slide_type === 1 && !slide.question) {
    return { position, kind: "question_draft", content: { show_leaderboard_after: slide.show_leaderboard_after === true } };
  }
  if (slide.slide_type === 1 || slide.question) {
    const question = slide.question || {};
    return {
      position,
      kind: "question",
      content: {
        title: question.title || "",
        text: question.text ?? question.question_text ?? "",
        question_type: question.question_type || "single",
        question_time: Number(question.time_limit ?? question.question_time ?? 10),
        min_point: Number(question.min_point || 0),
        max_point: Number(question.max_point || 100),
        image_url: question.image_url || question.question_image || "",
        faster_answers_more_points: question.faster_answers_more_points === true,
        partial_scoring: question.partial_scoring === true,
        show_leaderboard_after: slide.show_leaderboard_after === true,
        options: (question.options || []).map((option, index) => ({
          id: String(option.id ?? option.option_id ?? newID()),
          text: option.text ?? option.option_text ?? "",
          is_correct: option.is_correct === true,
          image_url: option.image_url || "",
          order: Number(option.order ?? index + 1),
        })),
      },
    };
  }
  if (slide.slide_type === 3) return { position, kind: "leaderboard", content: { title: slide.title || "Leaderboard" } };
  return {
    position,
    kind: "content",
    content: {
      title: slide.title || "",
      text: slide.content_text || "",
      image_url: slide.content_image_url || "",
    },
  };
};

const mutationQueues = new Map();
const mutateSlide = (presentationId, slideId, mutate) => {
  const key = `${presentationId}:${slideId}`;
  const previous = mutationQueues.get(key) || Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    const presentation = await request(`/presentations/${presentationId}`);
    const source = presentation.slides.find((item) => item.id === String(slideId));
    if (!source) throw new Error("not_found");
    const editorSlide = slideToEditor(source);
    const changed = mutate(editorSlide) || editorSlide;
    const definition = editorSlideToDefinition(changed, source.position);
    const saved = await request(`/presentations/${presentationId}/slides/${slideId}`, { method: "PUT", json: definition });
    return slideToEditor(saved);
  });
  const queued = next.finally(() => { if (mutationQueues.get(key) === queued) mutationQueues.delete(key); });
  mutationQueues.set(key, queued);
  return next;
};

const patchSettings = async (quizId, fields) => {
  const current = await request(`/presentations/${quizId}`);
  return presentationToEditor(await request(`/presentations/${quizId}`, {
    method: "PATCH",
    json: { settings: { ...(current.settings || {}), ...fields } },
  }));
};

export const quizService = {
  listPresentations: () => request("/presentations"),
  createPresentation: (title = "Untitled Presentation") => request("/presentations", { method: "POST", json: { title, settings: {} } }),
  deletePresentation: (id) => request(`/presentations/${id}`, { method: "DELETE" }),
  duplicatePresentation: (id, title) => request(`/presentations/${id}/duplicate`, { method: "POST", json: { title } }),
  resetPresentationResults: (id) => request(`/presentations/${id}/results`, { method: "DELETE" }),
  getLatestSession: (id) => request(`/presentations/${id}/latest-session`),

  getQuiz: async (quizId) => presentationToEditor(await request(`/presentations/${quizId}`)),
  getEditorQuiz: async (quizId) => presentationToEditor(await request(`/presentations/${quizId}`)),
  updateQuiz: async (quizId, data) => {
    const current = await request(`/presentations/${quizId}`);
    const settings = { ...(current.settings || {}) };
    if (data.background_color !== undefined || data.background?.color !== undefined) settings.background_color = data.background_color ?? data.background.color;
    if (data.background_image_url !== undefined || data.background?.image !== undefined) settings.background_image_url = data.background_image_url ?? data.background.image;
    if (data.text_color !== undefined || data.background?.text_color !== undefined) settings.text_color = data.text_color ?? data.background.text_color;
    if (data.music_url !== undefined) settings.music_url = data.music_url;
    return presentationToEditor(await request(`/presentations/${quizId}`, {
      method: "PATCH",
      json: { title: data.title || data.quiz_name || current.title, settings },
    }));
  },
  updateQuizMusic: (quizId, musicUrl) => patchSettings(quizId, { music_url: musicUrl || "" }),
  updateQuizBackground: (quizId, data) => patchSettings(quizId, data),

  createSlide: async (quizId, slideData) => {
    const current = await request(`/presentations/${quizId}`);
    const definition = editorSlideToDefinition({ ...slideData, order: current.slides.length }, current.slides.length);
    return slideToEditor(await request(`/presentations/${quizId}/slides`, { method: "POST", json: definition }));
  },
  updateSlide: (quizId, slideId, data) => mutateSlide(quizId, slideId, (current) => ({ ...current, ...data, question: data.question ?? current.question })),
  deleteSlide: (quizId, slideId) => request(`/presentations/${quizId}/slides/${slideId}`, { method: "DELETE" }),
  reorderSlides: (quizId, slideIds) => request(`/presentations/${quizId}/slides/reorder`, { method: "POST", json: { slide_ids: slideIds.map(String) } }),

  getQuestion: async (quizId, slideId) => {
    const quiz = await quizService.getQuiz(quizId);
    return quiz.slides.find((slide) => slide.slide_id === String(slideId))?.question || null;
  },
  createQuestion: (quizId, slideId, data) => mutateSlide(quizId, slideId, (slide) => ({
    ...slide,
    slide_type: 1,
    question: {
      question_id: String(slideId),
      text: data.text || "New Question",
      question_text: data.text || "New Question",
      question_type: data.question_type || "single",
      time_limit: Number(data.time_limit || 10),
      min_point: Number(data.min_point || 0),
      max_point: Number(data.max_point || 100),
      image_url: data.image_url || "",
      faster_answers_more_points: data.faster_answers_more_points === true,
      partial_scoring: data.partial_scoring === true,
      options: data.options || [],
    },
  })).then((slide) => slide.question),
  updateQuestion: (quizId, slideId, data) => mutateSlide(quizId, slideId, (slide) => ({
    ...slide,
    slide_type: 1,
    question: { ...(slide.question || { question_id: String(slideId), options: [] }), ...data,
      text: data.text ?? slide.question?.text ?? "", question_text: data.text ?? slide.question?.question_text ?? "",
      time_limit: Number(data.time_limit ?? slide.question?.time_limit ?? 10) },
  })).then((slide) => slide.question),

  getOptions: async (quizId, slideId) => (await quizService.getQuestion(quizId, slideId))?.options || [],
  createOption: (quizId, slideId, data) => {
    const id = newID();
    return mutateSlide(quizId, slideId, (slide) => ({ ...slide, question: { ...slide.question, options: [...(slide.question?.options || []), normalizeOption({ ...data, id }, slide.question?.options?.length || 0)] } })).then((slide) => slide.question.options.find((option) => option.option_id === id));
  },
  updateOption: (quizId, slideId, optionId, data) => mutateSlide(quizId, slideId, (slide) => ({
    ...slide,
    question: { ...slide.question, options: (slide.question?.options || []).map((option) => String(option.option_id) === String(optionId) ? normalizeOption({ ...option, ...data, id: option.option_id }, Number(data.order ?? option.order) - 1) : option) },
  })).then((slide) => slide.question.options.find((option) => String(option.option_id) === String(optionId))),
  deleteOption: (quizId, slideId, optionId) => mutateSlide(quizId, slideId, (slide) => ({ ...slide, question: { ...slide.question, options: (slide.question?.options || []).filter((option) => String(option.option_id) !== String(optionId)) } })),

  getQuestionResults: async (quizId, slideId, limit = 100) => {
    try {
      const locator = await request(`/presentations/${quizId}/latest-session`);
      return await request(`/presentations/${quizId}/sessions/${locator.session_id}/questions/${slideId}/results?limit=${limit}`);
    } catch (error) {
      if (error?.response?.status === 404) return null;
      throw error;
    }
  },
  getQuestionLeaderboard: async (quizId, slideId) => {
    try {
      const page = await quizService.getQuestionResults(quizId, slideId, 100);
      return (page?.leaderboard || []).map((item) => ({
        rust_session_id: item.participant_id,
        player_name: item.display_name,
        avatar: item.avatar || "",
        score: Number(item.score || 0),
        rank: Number(item.rank || 0),
        time_taken: item.time_taken_ms == null ? null : Number(item.time_taken_ms) / 1000,
      }));
    } catch (error) {
      if (error?.response?.status === 404) return [];
      throw error;
    }
  },
  getSlidesFromAPI: (quizId) => quizService.getQuiz(quizId),
  deleteLeaderboardSlide: (quizId, slideId) => mutateSlide(quizId, slideId, (slide) => ({ ...slide, show_leaderboard_after: false })),
};
