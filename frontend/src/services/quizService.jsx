// This component manages the connection to the back-end components of the pages/quiz/manger folder

import axios from "axios";
import { buildApiUrl, getApiBase } from "../utils/api";
import {
  clearAuthStorage,
  getAuthHeaders,
  getRefreshToken,
} from "../utils/auth";


const api = axios.create({ baseURL: getApiBase() });

const refreshAccessToken = async () => {
  const refresh = getRefreshToken();
  if (!refresh) return null;

  const response = await fetch(buildApiUrl("/auth/token/refresh/"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });

  if (!response.ok) {
    clearAuthStorage();
    return null;
  }

  const payload = await response.json().catch(() => null);
  if (payload?.access) {
    localStorage.setItem("auth.access", payload.access);
    return payload.access;
  }

  clearAuthStorage();
  return null;
};

api.interceptors.request.use((config) => {
  config.headers = { ...config.headers, ...getAuthHeaders() };
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config;

    if (status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const newAccess = await refreshAccessToken();
      if (newAccess) {
        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${newAccess}`,
        };
        return api(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);


export const quizService = {

  // Getting a quiz
  getQuiz: async (quizId) => {
    try {
      const response = await api.get(`/quizzes/${quizId}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching quiz:', error);
      throw error;
    }
  },

  // Getting quiz data for the editor
  getEditorQuiz: async (quizId) => {
    try {
      const response = await api.get(`/quizzes/${quizId}/editor-data/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching editor quiz:', error);
      throw error;
    }
  },


  // Updating a quiz
  updateQuiz: async (quizId, quizData) => {
    try {
      const response = await api.put(`/quizzes/${quizId}/`, quizData);
      return response.data;
    } catch (error) {
      console.error('Error updating quiz:', error);
      throw error;
    }
  },


  // Just update the quiz music
  updateQuizMusic: async (quizId, musicUrl) => {
    try {
      const response = await api.patch(
        `/quizzes/${quizId}/`,
        { music_url: musicUrl } 
      );
      return response.data;
    } catch (error) {
      console.error('Error updating quiz music:', error);
      throw error;
    }
  },


  // Just Update the quiz background 
  updateQuizBackground: async (quizId, backgroundData) => {
    try {
      const payload = {};
      
      if (backgroundData.background_color !== undefined) {
        payload.background_color = backgroundData.background_color;
      }
      
      if (backgroundData.background_image_url !== undefined) {
        payload.background_image_url = backgroundData.background_image_url;
      }
      
      const response = await api.patch(
        `/quizzes/${quizId}/`,
        payload
      );
      return response.data;
    } catch (error) {
      console.error('Error updating quiz background:', error);
      throw error;
    }
  },


  // Getting question of a slide of a quiz
  getQuestion: async (quizId, slideId) => {
    try {
      const response = await api.get(
        `/quizzes/${quizId}/slides/${slideId}/question/`
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error('Error fetching question:', error);
      throw error;
    }
  },


  // Create a new question for a quiz slide
  createQuestion: async (quizId, slideId, questionData) => {
    try {
      const response = await api.post(
        `/quizzes/${quizId}/slides/${slideId}/question/`,
        questionData
      );
      return response.data;
    } catch (error) {
      console.error('Error creating question:', error);
      throw error;
    }
  },


  // Update existing question
  updateQuestion: async (quizId, slideId, questionData) => {
    try {
      const response = await api.put(
        `/quizzes/${quizId}/slides/${slideId}/question/`,
        questionData
      );
      return response.data;
    } catch (error) {
      console.error('Error updating question:', error);
      throw error;
    }
  },


  // Getting options of a question of a quiz slide
  getOptions: async (quizId, slideId) => {
    try {
      const response = await api.get(
        `/quizzes/${quizId}/slides/${slideId}/question/options/`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching options:', error);
      throw error;
    }
  },


  // Create a new option for question
  createOption: async (quizId, slideId, optionData) => {
    try {
      const response = await api.post(
        `/quizzes/${quizId}/slides/${slideId}/question/options/`,
        optionData
      );
      return response.data;
    } catch (error) {
      console.error('Error creating option:', error);
      throw error;
    }
  },


  // Update an existing option
  updateOption: async (quizId, slideId, optionId, optionData) => {
    try {
      const response = await api.put(
        `/quizzes/${quizId}/slides/${slideId}/question/options/${optionId}/`,
        optionData
      );
      return response.data;
    } catch (error) {
      console.error('Error updating option:', error);
      throw error;
    }
  },


  // Delete an option
  deleteOption: async (quizId, slideId, optionId) => {
    try {
      await api.delete(
        `/quizzes/${quizId}/slides/${slideId}/question/options/${optionId}/`
      );
    } catch (error) {
      console.error('Error deleting option:', error);
      throw error;
    }
  },


  // Create a new slide for quiz
  createSlide: async (quizId, slideData) => {
    try {
      const response = await api.post(
        `/quizzes/${quizId}/slides/`, 
        slideData
      );
      return response.data;
    } catch (error) {
      console.error('Error creating slide:', error);
      throw error;
    }
  },


  // Update a slide
  updateSlide: async (quizId, slideId, slideData) => {
    try {
      const response = await api.put(
        `/quizzes/${quizId}/slides/${slideId}/`,
        slideData
      );
      return response.data;
    } catch (error) {
      console.error('Error updating slide:', error);
      throw error;
    }
  },


  // Delete a slide
  deleteSlide: async (quizId, slideId) => {
    try {
      await api.delete(
        `/quizzes/${quizId}/slides/${slideId}/`
      );
    } catch (error) {
      console.error('Error deleting slide:', error);
      throw error;
    }
  },


  // Just for update order of a slide
  updateSlideOrder: async (quizId, slideId, order) => {
    try {
      const response = await api.patch(
        `/quizzes/${quizId}/slides/${slideId}/`, 
        { order }
      );
      return response.data;
    } catch (error) {
      console.error('Error updating slide order:', error);
      throw error;
    }
  },


  // Get leaderboard entries for a question slide
  getQuestionLeaderboard: async (quizId, slideId) => {
    try {
      const response = await api.get(
        `/quizzes/${quizId}/slides/${slideId}/question/leaderboard/`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching question leaderboard:', error);
      throw error;
    }
  },


  // Reorder slides for a quiz
  reorderSlides: async (quizId, slideIds) => {
    try {
      const response = await api.post(
        `/quizzes/${quizId}/slides/reorder/`,
        { slide_ids: slideIds }
      );
      return response.data;
    } catch (error) {
      console.error('Error reordering slides:', error);
      throw error;
    }
  },


  // Getting slides with their leaderboards
  getSlidesFromAPI : async (quizId) => {
    try {
      const response = await api.get(
        `/quizzes/${quizId}/export/`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching slides from API:', error);
      throw error;
    }
  },


  // Delete leaderboard slide of a question slide
  deleteLeaderboardSlide : async (quizId, slideId) => {
    try {
        const response = await api.patch(
          `/quizzes/${quizId}/slides/${slideId}/`,
          {show_leaderboard_after: false}
        );
        return response.data;
    } catch (error) {
        console.error('Error updating slide:', error);
        throw error;
    }
  },
};
