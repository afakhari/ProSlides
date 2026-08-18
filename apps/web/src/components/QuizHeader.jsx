import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { buildApiUrl } from "../utils/api";
import { getAuthHeaders } from "../utils/auth";
import ShareMenu from "./ShareMenu";


export default function QuizHeader({
  accessCode = "ABC123",
  quizTitle = "", 
  quizId,
  setNameSelectionNotice,
  onBack,
}) {

  const navigate = useNavigate();
  const [showShareModal, setShowShareModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newQuizTitle, setNewQuizTitle] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);


  // 
  useEffect(() => {
    setNewQuizTitle(quizTitle || "");
  }, [quizTitle]);


  const handleUpdateQuizName = async () => {
    if (!quizId) {
      alert("Error: Quiz ID is invalid.");
      setIsEditing(false);
      return;
    }

    if (!newQuizTitle || typeof newQuizTitle !== "string") {
      alert("Please enter a valid name.");
      return;
    }

    const trimmedTitle = newQuizTitle.trim();

    if (!trimmedTitle || trimmedTitle === quizTitle) {
      setIsEditing(false);
      return;
    }

    setIsUpdating(true);
    try {
      const response = await axios.patch(
        buildApiUrl(`/quizzes/${quizId}/`),
        {
          title: trimmedTitle,
        },
        {
          headers: getAuthHeaders({ "Content-Type": "application/json" }),
        }
      );

      if (response.status === 200) {
        if (setNameSelectionNotice) {
          setNameSelectionNotice("Quiz name changed successfully.");
          setTimeout(() => {
            setNameSelectionNotice(null);
          }, 2500);
        } else {
          alert("Quiz name changed successfully.");
        }
      }
    } catch (error) {
      // Return to previous name
      setNewQuizTitle(quizTitle || "");

      // Display an error message to the user
      if (error.response) {
        alert(
          `Update error: ${
            error.response.data?.message || error.response.statusText
          }`
        );
      } else if (error.request) {
        alert("Error connecting to server.");
      } else {
        alert("Unknown error.");
      }
    } finally {
      setIsUpdating(false);
      setIsEditing(false);
    }
  };


  const handleCancelEdit = () => {
    setNewQuizTitle(quizTitle || "");
    setIsEditing(false);
  };


  // تابع handleInputChange برای اطمینان از مقدار معتبر
  const handleInputChange = (e) => {
    const value = e.target.value || "";
    setNewQuizTitle(value);
  };


  return (
    <>
      <header className="fixed top-0 left-0 right-0 w-full h-14 bg-pink-300 flex items-center justify-between px-5 z-50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => (onBack ? onBack() : navigate("/manager/panel"))}
            className="text-white hover:bg-white/20 p-2 rounded-full transition"
            title="Back to Home"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          </button>
          <div className="text-white font-semibold text-base flex items-center gap-1.5 before:content-['✱'] before:text-xl">
            ProSlides
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm
                    bg-white/15 border border-white/40
                    hover:bg-white/25
                    text-white font-semibold rounded-xl
                    transition active:scale-95
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              Change Quiz Name
            </button>
          ) : (
            // Quiz name editing space
            <div className="flex items-center gap-2 bg-white rounded-xl shadow-lg shadow-gray-300/40 px-3 py-1">
              <input
                type="text"
                value={newQuizTitle || ""} 
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUpdateQuizName();
                  if (e.key === "Escape") handleCancelEdit();
                }}
                autoFocus
                disabled={isUpdating}
                className="px-3 py-1 mb-1 mt-1 rounded-lg border border-gray-300 
                        focus:outline-none focus:ring-2 focus:ring-pink-500 
                        focus:border-transparent bg-white text-gray-800 min-w-[200px]"
                placeholder="new name"
              />

              <button
                onClick={handleUpdateQuizName}
                disabled={isUpdating || !newQuizTitle || !newQuizTitle.trim()}
                className="flex items-center justify-center w-8 h-8 
                        bg-green-500 hover:bg-green-600 text-white 
                        rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                title="save"
              >
                {isUpdating ? (
                  <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                ) : (
                  <span className="text-lg">✓</span>
                )}
              </button>

              <button
                onClick={handleCancelEdit}
                disabled={isUpdating}
                className="flex items-center justify-center w-8 h-8 
                        bg-gray-300 hover:bg-gray-400 text-gray-700 
                        rounded-lg transition disabled:opacity-50"
                title="cancel"
              >
                <span className="text-lg">✕</span>
              </button>
            </div>
          )}


          {/* --------------- Share Button --------------- */}
          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 
                    bg-gradient-to-r from-pink-600 to-purple-700 
                    hover:from-pink-650 hover:to-purple-800
                    text-white font-semibold rounded-xl shadow-lg shadow-pink-300/40
                    transition active:scale-95
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            Share
          </button>
        </div>
      </header>


      <ShareMenu
        quizId={quizId}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        accessCode={accessCode}
      />
    </>
  );
}
