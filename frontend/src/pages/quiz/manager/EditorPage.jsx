import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import MiniResultsResultsOnly from "./MiniResultsResultsOnly";
import LeaderboardPreview from "./LeaderboardPreview";
import QuizHeader from "../../../components/QuizHeader";
import Sidebar from "./Sidebar";
import SlidesPanel from "./SlidesPanel";
import RightToolbar from "./RightToolbar";
import DesignPanel from "./DesignPanel";
import AudioPanel from "./AudioPanel";
import { quizService } from "../../../services/quizService";
import { UNSAVED_CHANGES_KEY } from "../../../utils/auth";
import Waiting from "../../loading/LoadingPage";
import { X } from "lucide-react";
import { ConfirmDialog } from "../../../components/ui/confirm-dialog";

export default function EditorPage() {
  const { roomId } = useParams();
  const quizId = parseInt(roomId, 10);

  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveNotice, setSaveNotice] = useState(null);

  const fetchQuiz = useCallback(async () => {
    if (!quizId) {
      setError("There is no quiz.");
      setLoading(false);
      return;
    }

    try {
      const quizData = await quizService.getEditorQuiz(quizId);
      setQuiz(quizData);
      setError(null);
    } catch (err) {
      setError("Failed to load quiz");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    fetchQuiz();
  }, [fetchQuiz]);

  const updateQuiz = (updatedQuiz) => {
    setQuiz(updatedQuiz);
  };

  const saveQuiz = async () => {
    if (!quiz) return;
    try {
      await quizService.updateQuiz(quiz.quiz_id, quiz);
      await fetchQuiz();
      setSaveNotice("Quiz saved successfully.");
      setTimeout(() => {
        setSaveNotice(null);
      }, 2500);
    } catch (err) {
      console.error("Failed to save quiz:", err);
    }
  };


  if (loading) {
    return <Waiting />;
  }

  if (error || !quiz) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-xl text-red-500">{error || "Quiz not found"}</div>
      </div>
    );
  }

  return (
    <>
      <QuestionEditor
        quiz={quiz}
        updateQuiz={updateQuiz}
        saveQuiz={saveQuiz}
        refreshQuiz={fetchQuiz}
      />
      {saveNotice && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {saveNotice}
        </div>
      )}
    </>
  );
}


function QuestionEditor({ quiz, updateQuiz, saveQuiz, refreshQuiz }) {

  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const navigate = useNavigate();
  const [activeSlideType, setActiveSlideType] = useState(null);
  const [leaderboardPreviewData, setLeaderboardPreviewData] = useState({});
  const [leaderboardError, setLeaderboardError] = useState(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState({});
  const [hasSidebarChanges, setHasSidebarChanges] = useState(false);
  const [hasAudioChanges, setHasAudioChanges] = useState(false);
  const [hasDesignChanges, setHasDesignChanges] = useState(false);
  const [isSelectingType, setIsSelectingType] = useState(false);
  const [typeSelectionError, setTypeSelectionError] = useState(null);
  const [typeSelectionNotice, setTypeSelectionNotice] = useState(null);
  const [typeSelectionMode, setTypeSelectionMode] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [notice, setNotice] = useState(null);
  const noticeTimeoutRef = useRef(null);
  const [nameSelectionNotice, setNameSelectionNotice] = useState(null);
  const [audioSaveNotice, setAudioSaveNotice] = useState(null);
  const [backgroundSaveNotice, setBackgroundSaveNotice] = useState(null);

  const slides = quiz.slides || [];
  const activeSlide = slides[activeSlideIndex] || null;
  const activeLeaderboardEntries = activeSlide?.slide_id
    ? leaderboardPreviewData[activeSlide.slide_id] || []
    : [];
  const presentStatus = (() => {
    if (!slides.length) {
      return { ready: false, reason: "Add at least one slide to present." };
    }
    const missingQuestion = slides.find(
      (slide) =>
        slide.slide_type === 1 &&
        (!slide.question ||
          typeof slide.question !== "object" ||
          Object.keys(slide.question).length === 0)
    );
    if (missingQuestion) {
      return {
        ready: false,
        reason: "Complete all question slides before presenting.",
      };
    }
    return { ready: true, reason: "Start presentation" };
  })();

  const [activeTab, setActiveTab] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showDesignPanel, setShowDesignPanel] = useState(false);
  const [showAudioPanel, setShowAudioPanel] = useState(false);
  const [showTypeBox, setShowTypeBox] = useState(false);
  const [showSlidesPanel, setShowSlidesPanel] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: null,
    confirmText: "",
    cancelText: "",
  });

  const hasUnsavedChanges = hasSidebarChanges || hasAudioChanges || hasDesignChanges;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hasUnsavedChanges) {
      localStorage.setItem(UNSAVED_CHANGES_KEY, "1");
    } else {
      localStorage.removeItem(UNSAVED_CHANGES_KEY);
    }
    return () => {
      localStorage.removeItem(UNSAVED_CHANGES_KEY);
    };
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleBeforeUnload = (event) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!activeSlide) return;
    if (activeSlideType === null || activeSlideType === activeSlide.slide_type) {
      setActiveSlideType(activeSlide.slide_type);
    }
  }, [activeSlide, activeSlideType]);

  const showNotice = useCallback((message, tone = "info") => {
    setNotice({ message, tone });
    if (noticeTimeoutRef.current) {
      clearTimeout(noticeTimeoutRef.current);
    }
    noticeTimeoutRef.current = setTimeout(() => {
      setNotice(null);
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current) {
        clearTimeout(noticeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const media = window.matchMedia("(max-width: 767px), (max-height: 600px)");
    const handleChange = () => setIsMobile(media.matches);
    handleChange();
    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
    } else {
      media.addListener(handleChange);
    }
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener("change", handleChange);
      } else {
        media.removeListener(handleChange);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const shouldLock =
      isMobile &&
      (showSlidesPanel ||
        showSidebar ||
        showDesignPanel ||
        showAudioPanel ||
        showTypeBox);
    if (shouldLock) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [
    isMobile,
    showSlidesPanel,
    showSidebar,
    showDesignPanel,
    showAudioPanel,
    showTypeBox,
  ]);

  const loadLeaderboardPreview = useCallback(async (slideId) => {
    if (!slideId) return;
    try {
      setLeaderboardLoading((prev) => ({ ...prev, [slideId]: true }));
      const data = await quizService.getQuestionLeaderboard(
        quiz.quiz_id,
        slideId
      );
      setLeaderboardPreviewData((prev) => ({
        ...prev,
        [slideId]: data || [],
      }));
      setLeaderboardError(null);
    } catch (error) {
      console.error("Failed to load leaderboard preview:", error);
      setLeaderboardError("Failed to load leaderboard results.");
    } finally {
      setLeaderboardLoading((prev) => ({ ...prev, [slideId]: false }));
    }
  }, [quiz.quiz_id]);

  useEffect(() => {
    if (activeSlideType === 3 && activeSlide?.slide_id) {
      loadLeaderboardPreview(activeSlide.slide_id);
    }
  }, [activeSlideType, activeSlide?.slide_id, loadLeaderboardPreview]);


  const handleSaveAndRefresh = async () => {
    try {
      await saveQuiz();
      if (refreshQuiz) {
        await refreshQuiz();
      }
      showNotice("Quiz saved.", "success");
    } catch (error) {
      console.error("Failed to save and refresh:", error);
      showNotice("Failed to save quiz.", "error");
    }
  };

  const handleDeleteLeaderboardAndRefresh = async () => {
    try {
      if (refreshQuiz) {
        await refreshQuiz();
      }
    } catch (error) {
      console.error("Failed to refresh after leaderboard update:", error);
    }
  };


  // ????? ???? ?????? ?????
  const handleTabClick = (tabId) => {
    if (tabId === "slides") {
      setShowSlidesPanel((prev) => {
        const next = !prev;
        setShowSidebar(false);
        setShowDesignPanel(false);
        setShowAudioPanel(false);
        setActiveTab(next ? tabId : null);
        return next;
      });
      return;
    }

    if (showSidebar && hasSidebarChanges) {
      const isTogglingSidebar = tabId === "content" && showSidebar;
      const isLeavingSidebar = tabId !== "content";
      if (isTogglingSidebar || isLeavingSidebar) {
        setConfirmDialog({
          isOpen: true,
          title: "Unsaved Changes",
          description: "You have unsaved changes. Do you want to discard them?",
          onConfirm: () => {
            setHasSidebarChanges(false);
            proceedTabChange(tabId);
          },
          confirmText: "Discard Changes",
          cancelText: "Keep Editing",
        });
        return;
      }
    }

    if (showAudioPanel && hasAudioChanges) {
      const isTogglingAudio = tabId === "audio" && showAudioPanel;
      const isLeavingAudio = tabId !== "audio";
      if (isTogglingAudio || isLeavingAudio) {
        setConfirmDialog({
          isOpen: true,
          title: "Unsaved Changes",
          description: "You have unsaved changes. Do you want to discard them?",
          onConfirm: () => {
            setHasAudioChanges(false);
            proceedTabChange(tabId);
          },
          confirmText: "Discard Changes",
          cancelText: "Keep Editing",
        });
        return;
      }
    }

    if (showDesignPanel && hasDesignChanges) {
      const isTogglingDesign = tabId === "design" && showDesignPanel;
      const isLeavingDesign = tabId !== "design";
      if (isTogglingDesign || isLeavingDesign) {
        setConfirmDialog({
          isOpen: true,
          title: "Unsaved Changes",
          description: "You have unsaved changes. Do you want to discard them?",
          onConfirm: () => {
            setHasDesignChanges(false);
            proceedTabChange(tabId);
          },
          confirmText: "Discard Changes",
          cancelText: "Keep Editing",
        });
        return;
      }
    }

    proceedTabChange(tabId);
  };

  const proceedTabChange = (tabId) => {
    if (tabId === "audio") {
      setShowAudioPanel((prev) => {
        const next = !prev;
        setShowSidebar(false);
        setShowDesignPanel(false);
        setShowSlidesPanel(false);
        setActiveTab(next ? tabId : null);
        return next;
      });
      return;
    }
    if (tabId === "content") {
      setShowSidebar((prev) => {
        const next = !prev;
        setShowDesignPanel(false);
        setShowAudioPanel(false);
        setShowSlidesPanel(false);
        setActiveTab(next ? tabId : null);
        return next;
      });
      return;
    }
    if (tabId === "design") {
      setShowDesignPanel((prev) => {
        const next = !prev;
        setShowSidebar(false);
        setShowAudioPanel(false);
        setShowSlidesPanel(false);
        setActiveTab(next ? tabId : null);
        return next;
      });
      return;
    }

    setShowSidebar(false);
    setShowDesignPanel(false);
    setShowAudioPanel(false);
    setShowSlidesPanel(false);
    setActiveTab(null);
  };

  const handleConfirm = () => {
    if (confirmDialog.onConfirm) {
      confirmDialog.onConfirm();
    }
    closeConfirmDialog();
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({
      isOpen: false,
      title: "",
      description: "",
      onConfirm: null,
      confirmText: "",
      cancelText: "",
    });
  };

  const handleCancel = () => {
    closeConfirmDialog();
  };

  const handleExitPanel = () => {
    if (!hasUnsavedChanges) {
      navigate("/manager/panel");
      return;
    }
    setConfirmDialog({
      isOpen: true,
      title: "Leave panel?",
      description: "You have unsaved changes. Do you want to discard them?",
      onConfirm: () => {
        setHasSidebarChanges(false);
        setHasAudioChanges(false);
        setHasDesignChanges(false);
        navigate("/manager/panel");
      },
      confirmText: "Discard Changes",
      cancelText: "Keep Editing",
    });
  };

  const proceedWithSlideChange = (id) => {
    const slide = slides.find((s) => s.slide_id === id);
    if (slide) {
      const index = slides.indexOf(slide);
      setActiveSlideIndex(index);
    }
  };

  const handleSetActiveSlideId = (id) => {
    if (hasSidebarChanges && id !== activeSlide?.slide_id) {
      setConfirmDialog({
        isOpen: true,
        title: "Unsaved Changes",
        description: "You have unsaved changes. Do you want to discard them?",
        onConfirm: () => {
          setHasSidebarChanges(false);
          proceedWithSlideChange(id);
        },
        confirmText: "Discard Changes",
        cancelText: "Keep Editing",
      });
      return;
    }

    proceedWithSlideChange(id);
  };

  const handleSetActiveSlideIdForMobile = (id) => {
    if (hasSidebarChanges && id !== activeSlide?.slide_id) {
      setConfirmDialog({
        isOpen: true,
        title: "Unsaved Changes",
        description: "You have unsaved changes. Do you want to discard them?",
        onConfirm: () => {
          setHasSidebarChanges(false);
          proceedWithSlideChange(id);
          setShowSlidesPanel(false);
        },
        confirmText: "Discard Changes",
        cancelText: "Keep Editing",
      });
      return;
    }

    proceedWithSlideChange(id);
    setShowSlidesPanel(false);
  };

  const handleCloseAudioPanel = () => {
    setShowAudioPanel(false);
    setActiveTab(null);
  };

  const handleCloseDesignPanel = () => {
    setShowDesignPanel(false);
    setActiveTab(null);
  };

  const handleCloseSidebarPanel = (forceClose = false) => {
    if (!forceClose && hasSidebarChanges) {
      setConfirmDialog({
        isOpen: true,
        title: "Unsaved Changes",
        description: "You have unsaved changes. Do you want to discard them?",
        onConfirm: () => {
          setHasSidebarChanges(false);
          setShowSidebar(false);
          setActiveTab(null);
        },
        confirmText: "Discard Changes",
        cancelText: "Keep Editing",
      });
      return;
    }
    setShowSidebar(false);
    setActiveTab(null);
  };

  // ???? ???? ???? ????? ????? ??????
  const getSlideTitle = (slide) => {
    if (slide.slide_type === 1 && slide.question) {
      return slide.question.text || "Question Slide";
    } else if (slide.slide_type === 3) {
      return slide.title || "Leaderboard";
    }
    // return `Slide ${slide.order}`;
    return "No Question Yet";
  };

  // ????? ?????? ????
  const addNewSlide = async () => {
    try {
      const newSlideData = {
        slide_type: 1,
        // order: 1,
        show_leaderboard_after: false,
        title: "",
        content_text: "",
        content_image_url: "",
      };

      // ????? ?? ???? ???? ????? ?????? ????
      const createdSlide = await quizService.createSlide(
        quiz.quiz_id,
        newSlideData
      );

      // ??????????? quiz ?? ?????? ????
      const updatedSlides = [...slides, createdSlide];
      updateQuiz({
        ...quiz,
        slides: updatedSlides,
      });

      // ?????? ?????? ????
      setActiveSlideIndex(updatedSlides.length - 1);
    } catch (error) {
      console.error("Failed to create new slide:", error);
      showNotice("Failed to create new slide.", "error");
    }
  };



  // ??? ??????
  const deleteSlide = async (slideId) => {
    try {
      // ??? ?? ????
      await quizService.deleteSlide(quiz.quiz_id, slideId);

      // ??????????? state
      const slideIndex = slides.findIndex((s) => s.slide_id === slideId);
      const updatedSlides = slides.filter((s) => s.slide_id !== slideId);

      updateQuiz({
        ...quiz,
        slides: updatedSlides,
      });

      // ????? ?????? ????
      if (updatedSlides.length > 0) {
        if (slideIndex >= updatedSlides.length) {
          setActiveSlideIndex(updatedSlides.length - 1);
        } else {
          setActiveSlideIndex(slideIndex);
        }
      } else {
        setActiveSlideIndex(0);
      }
    } catch (error) {
      console.error("Failed to delete slide:", error);
      showNotice("Failed to delete slide.", "error");
    }
  };

  // ??????????? ?????? ????
  const updateActiveSlide = async (updatedSlide) => {
    try {
      // ????? ?? ????
      const savedSlide = await quizService.updateSlide(
        quiz.quiz_id,
        updatedSlide.slide_id,
        updatedSlide
      );

      // ??????????? state
      const updatedSlides = slides.map((s) =>
        s.slide_id === updatedSlide.slide_id ? savedSlide : s
      );

      updateQuiz({
        ...quiz,
        slides: updatedSlides,
      });
    } catch (error) {
      console.error("Failed to update slide:", error);
      showNotice("Failed to update slide.", "error");
    }
  };

  // ????? ??? ????
  const handleTypeChangeClick = () => {
    if (isSelectingType) {
      return;
    }
    if (hasSidebarChanges) {
      setConfirmDialog({
        isOpen: true,
        title: "Change Question Type",
        description:
          "You have unsaved changes. Do you want to discard them before changing the question type?",
        onConfirm: () => {
          setHasSidebarChanges(false);
          handleCloseSidebarPanel(true);
          proceedWithTypeChange();
        },
        confirmText: "Discard Changes",
        cancelText: "Keep Editing",
      });
      return;
    }
    proceedWithTypeChange();
  };

  const proceedWithTypeChange = () => {
    setTypeSelectionError(null);
    setTypeSelectionMode(null);
    setShowSlidesPanel(false);
    setShowTypeBox(true);
  };

  const resolveQuestionForSlide = async (slideId, fallbackQuestion) => {
    if (fallbackQuestion?.question_id) {
      return fallbackQuestion;
    }
    const fetched = await quizService.getQuestion(quiz.quiz_id, slideId);
    return fetched || fallbackQuestion;
  };


  const handleSelectType = async (type) => {
    if (!activeSlide || activeSlide.slide_type !== 1) return;
    if (isSelectingType) return;

    const questionType = type === "Single Choice" ? "single" : "multiple";
    const quizId = quiz.quiz_id;
    const slideId = activeSlide.slide_id;
    const requestedMode = type === "Single Choice" ? "single" : "multiple";
    try {
      setIsSelectingType(true);
      setTypeSelectionError(null);
      setTypeSelectionMode(requestedMode);
      const currentQuestion = await resolveQuestionForSlide(
        slideId,
        activeSlide.question
      );
      let updatedQuestion;

      if (!currentQuestion || !currentQuestion.question_id) {
        // ???? 1: ????? ???? ????
        const questionData = {
          title: "",
          text: "New Question",
          question_type: questionType,
          min_point: 0,
          max_point: 100,
          time_limit: 10,
          image_url: "",
          faster_answers_more_points: false,
          partial_scoring: false,
        };

        updatedQuestion = await quizService.createQuestion(
          quizId,
          slideId,
          questionData
        );
      } else {
        // ???? 2: ??????????? ???? ?????
        
        // ????? type ???? ?? ????? ???????
        const updateData = {
          ...currentQuestion,
          question_type: questionType,
        };

      
        // ??? ?? multiple ?? single ????? ??????? ??????? ?? ??????? ????? ???????
        if (currentQuestion.question_type === "multiple" && questionType === "single") {
          if (currentQuestion.options && currentQuestion.options.length > 0) {
            // ???? ???? ????? ???????? ?? ????? correct ????
            const firstCorrectIndex = currentQuestion.options.findIndex(option => option.is_correct);
            
            // ????? ????? ???????? ?? ???? true ?????
            const indexToKeepTrue = firstCorrectIndex !== -1 ? firstCorrectIndex : 0;
            
            // ????? ?? ????? ?? ???? ???????
            const updatePromises = currentQuestion.options.map((option, index) => {
              const optionData = {
                
                is_correct: index === indexToKeepTrue,
                text: option.text || ""
                
              };
              
              return quizService.updateOption(
                quizId,
                slideId,
                option.option_id,
                optionData
              );
            });
            
            // ????? ???????? ?? ??? ???????? ???? ????
            await Promise.all(updatePromises);

            updatedQuestion = await quizService.updateQuestion(
              quizId,
              slideId,
              { question_type: questionType }
            );
            
            // ??????????? ???????? ???? ????????
            const updatedOptions = currentQuestion.options.map((option, index) => ({
              ...option,
              is_correct: index === indexToKeepTrue
            }));
            
            // ??????????? question ?? ????????? ????? ???
            updatedQuestion = {
              ...updatedQuestion,
              options: updatedOptions,
            };
          }
          if(!currentQuestion.options || currentQuestion.options.length === 0){
            updatedQuestion = await quizService.updateQuestion(
              quizId,
              slideId,
              updateData
            );
          }
        }
        if (currentQuestion.question_type === "single" && questionType === "multiple"){
            updatedQuestion = await quizService.updateQuestion(
              quizId,
              slideId,
              updateData
            );
        }
        
      }

      // ??????????? state
      const updatedSlide = {
        ...activeSlide,
        question: updatedQuestion,
      };

      // ??????????? ?? state ????
      const updatedSlides = slides.map((s) =>
        s.slide_id === slideId ? updatedSlide : s
      );

      updateQuiz({
        ...quiz,
        slides: updatedSlides,
      });
      setTypeSelectionNotice(
        `Question type set to ${requestedMode === "single" ? "Single Choice" : "Multiple Choice"}.`
      );
      setTimeout(() => {
        setTypeSelectionNotice(null);
      }, 2500);
      setShowTypeBox(false);
      setShowSidebar(true);
      setShowDesignPanel(false);
      setShowAudioPanel(false);
      setActiveTab("content");

    } catch (error) {
      console.error("Error changing question type:", error);

      if (
        error.response?.status === 400 &&
        error.response?.data?.error === "This slide already has a question"
      ) {
        try {
          const existingQuestion = await quizService.getQuestion(
            quizId,
            slideId
          );
          if (existingQuestion?.question_id) {
            const refreshedQuestion = await quizService.updateQuestion(
              quizId,
              slideId,
              { question_type: questionType }
            );
            const updatedSlide = {
              ...activeSlide,
              question: refreshedQuestion || existingQuestion,
            };
            const updatedSlides = slides.map((s) =>
              s.slide_id === slideId ? updatedSlide : s
            );
            updateQuiz({
              ...quiz,
              slides: updatedSlides,
            });
            setTypeSelectionNotice(
              `Question type updated to ${requestedMode === "single" ? "Single Choice" : "Multiple Choice"}.`
            );
            setTimeout(() => {
              setTypeSelectionNotice(null);
            }, 2500);
            setShowTypeBox(false);
            setShowSidebar(true);
            setShowDesignPanel(false);
            setShowAudioPanel(false);
            setActiveTab("content");
            return;
          }
        } catch (fetchError) {
          console.error("Failed to recover question after conflict:", fetchError);
        }
        setTypeSelectionError(
          "This slide already has a question. Try reopening the slide."
        );
        return;
      }

      if (error.response?.status === 400) {
        const errorMsg = error.response.data;
        setTypeSelectionError(
          typeof errorMsg === "string"
            ? errorMsg
            : "We could not apply this change. Please try again."
        );
      } else {
        setTypeSelectionError("Unexpected error. Please try again.");
      }
    } finally {
      setIsSelectingType(false);
    }
  };



  // ???? ???? ??????????? ?????? ?? ?? ????? ?? Sidebar
  const handleSlideUpdated = (updatedSlide) => {
    // ??????????? ?????? ?? state ????
    const updatedSlides = slides.map((s) =>
      s.slide_id === updatedSlide.slide_id ? updatedSlide : s
    );

    updateQuiz({
      ...quiz,
      slides: updatedSlides,
    });

    // ??????????? ?????? ????
    setActiveSlideIndex(
      updatedSlides.findIndex((s) => s.slide_id === updatedSlide.slide_id)
    );
  };

  // Present
  // const handlePresent = () => {
  //   navigate(`/manager/presentation/${quiz.quiz_id}/`);
  // };


  const handlePresent = () => {
    if (!presentStatus.ready) {
      showNotice(presentStatus.reason, "warning");
      return;
    }
    navigate(`/manager/presentation/${quiz.quiz_id}/`);
  };

  // Calculate cumulative leaderboard for the current slide if it's a leaderboard slide







  const handleLeaderboardDeleted = async (leaderboardSlideId) => {
    try {
      
      // ???? ???? ?????? ???????? ?? ??? ???
      const leaderboardSlide = slides.find(s => 
        s.slide_id === leaderboardSlideId && s.slide_type === 3
      );
      
      if (!leaderboardSlide) {
        return;
      }

      // ???? ???? ?????? ???? ?????
      const questionSlide = slides.find(s => 
        s.slide_type === 1 && s.order === leaderboardSlide.order
      );

      if (!questionSlide) {
        return;
      }

      // ??? ??????????? state ???? - ???? ????? ?? ????
      const updatedSlides = slides.map(slide => 
        slide.slide_id === questionSlide.slide_id 
          ? { ...slide, show_leaderboard_after: false }
          : slide
      );

      // ??????????? state ????
      updateQuiz({
        ...quiz,
        slides: updatedSlides
      });

      if (activeSlide?.slide_id === questionSlide.slide_id) {
        activeSlide.show_leaderboard_after = false;
      }

      // ???? SlidesPanel
      //setRefreshTrigger(prev => prev + 1);
      
    } catch (error) {
      console.error("? Error updating UI after leaderboard deletion:", error);
    }
  };
  //////////////////////////////////////////////////////////////////////////////////////////////////////////
  return (
    <div className="h-full flex flex-col relative pt-14 pb-20 md:pb-0">
      {/* ----- Header -----*/}
      <QuizHeader
        accessCode={quiz.access_code}
        quizTitle={quiz.title}
        quizId={quiz.quiz_id}
        setNameSelectionNotice={setNameSelectionNotice}
        onBack={handleExitPanel}
      />

      {nameSelectionNotice && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {nameSelectionNotice}
        </div>
      )}

      {/* ----- Main Layout ----- */}
      <div className="flex flex-1 overflow-hidden flex-col md:flex-row gap-4 md:gap-4 lg:gap-0">
        {/* ----- Left Panel (Slides Panel) ----- */}
        {!isMobile && (
          <div className="bg-white rounded-xl shadow p-4 overflow-y-auto w-full max-h-[40vh] md:max-h-none md:h-full md:w-1/4 lg:w-1/5">
            <SlidesPanel
              slides={slides}
              activeSlideId={activeSlide?.slide_id}
              setActiveSlideId={handleSetActiveSlideId}
              setActiveSlideTypeParent={setActiveSlideType}
              addNewSlide={addNewSlide}
              deleteSlide={deleteSlide}
              onSlidesReordered={(updatedSlides) => {
                updateQuiz({
                  ...quiz,
                  slides: updatedSlides,
                });
                if (activeSlide?.slide_id) {
                  const nextIndex = updatedSlides.findIndex(
                    (slide) => slide.slide_id === activeSlide.slide_id
                  );
                  if (nextIndex !== -1) {
                    setActiveSlideIndex(nextIndex);
                  }
                }
              }}
              onRefresh={handleDeleteLeaderboardAndRefresh}
              onLeaderboardDeleted={handleLeaderboardDeleted}
              idKey="slide_id"
              titleKey="slide_type"
            getSlideTitle={getSlideTitle}
            quizId={quiz.quiz_id}
            quizBackground={quiz.background_color}
            quizBackgroundImage={quiz.background_image_url}
            onNotify={showNotice}
          />
        </div>
        )}

        {/* ----- Middle panel ----- */}
        <div className="flex-1 relative md:mx-4 mx-0">
          <div className="bg-white rounded-xl shadow p-2 h-full flex justify-center items-center overflow-hidden relative">
            {/* ----- Present Button ----- */}
            <button
              onClick={handlePresent}
              disabled={!presentStatus.ready}
              title={presentStatus.reason}
              className="absolute top-2.5 left-2.5 bg-gradient-to-r from-slate-500 to-teal-600 
                        hover:from-slate-600 hover:to-teal-700 text-white px-4 py-2.5 rounded-xl text-base font-semibold transition z-10
                        disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Present
            </button>

            {activeSlideType === 1 && (
              <button
                onClick={handleTypeChangeClick}
                className="absolute top-2 right-2 text-sm text-gray-500 hover:text-gray-700 z-10"
              >
                Change Question Type
              </button>
            )}

            
            {activeSlide ? (
              activeSlideType === 3 ? (
                <div className="w-full h-full flex justify-center items-center">
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    {leaderboardError && (
                      <div className="text-sm text-red-500 mb-2">
                        {leaderboardError}
                      </div>
                    )}
                    {leaderboardLoading[activeSlide.slide_id] && (
                      <div className="text-sm text-slate-500 mb-2">
                        Loading leaderboard...
                      </div>
                    )}
                    {!leaderboardLoading[activeSlide.slide_id] &&
                      !leaderboardError &&
                      activeLeaderboardEntries.length === 0 && (
                        <div className="text-sm text-slate-500 mb-2">
                          No results yet. Run the quiz to see the leaderboard.
                        </div>
                      )}
                    <LeaderboardPreview
                      slide={activeSlide}
                      quizBackground={quiz.background_color}
                      quizBackgroundImage={quiz.background_image_url}
                      textColor={quiz.text_color}
                      isFullSize={
                        !showSidebar && !showDesignPanel && !showAudioPanel
                      }
                      customLeaderboard={
                        activeLeaderboardEntries
                      }
                    />
                  </div>
                </div>
              ) : activeSlideType === 1 && activeSlide.question ? (
                <div className="w-full h-full flex justify-center items-center">
                  <MiniResultsResultsOnly
                    slide={activeSlide}
                    quizBackground={quiz.background_color}
                    quizBackgroundImage={quiz.background_image_url}
                    textColor={quiz.text_color}
                    isFullSize={
                      !showSidebar && !showDesignPanel && !showAudioPanel
                    }
                  />
                </div>
              ) : (
                <div className="text-center text-gray-400">
                  <p className="text-lg mb-4">No content to display</p>
                  <button
                    onClick={handleTypeChangeClick}
                    className="bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600 transition"
                  >
                    Select Question Type
                  </button>
                </div>
              )
            ) : (
              <div className="text-center text-gray-400">
                <p className="text-lg mb-4">No slides yet</p>
              </div>
            )}

            {showTypeBox && (
              <>
                <div
                  className="absolute inset-0 bg-black/40 backdrop-blur-sm z-10"
                  onClick={() => setShowTypeBox(false)}
                ></div>

                <div className="absolute z-20 bg-white rounded-2xl shadow-2xl p-6 w-[400px] flex flex-col items-center space-y-4">
                  <h2 className="text-xl font-bold text-pink-700">
                    Select Question Type
                  </h2>
                  <p className="text-sm text-slate-500 text-center">
                    Choose how many correct answers this question can have.
                  </p>
                  {typeSelectionError && (
                    <div className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 text-center">
                      {typeSelectionError}
                    </div>
                  )}

                  {["Single Choice", "Multiple Choice"].map((type) => {
                    const isSingle = type === "Single Choice";
                    const description = isSingle
                      ? "One correct answer"
                      : "Multiple correct answers";
                    const isBusy =
                      isSelectingType &&
                      typeSelectionMode === (isSingle ? "single" : "multiple");
                    return (
                      <button
                        key={type}
                        onClick={() => handleSelectType(type)}
                        disabled={isSelectingType}
                        className="w-full bg-pink-500 text-white py-2 rounded-xl hover:bg-pink-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <div className="flex flex-col items-center">
                          <span className="font-semibold">
                            {isBusy ? "Applying..." : type}
                          </span>
                          <span className="text-xs text-white/80">
                            {description}
                          </span>
                        </div>
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setShowTypeBox(false)}
                    className="text-gray-500 text-sm hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
          {typeSelectionNotice && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg">
              {typeSelectionNotice}
            </div>
          )}
        </div>

        {/* ----- Right Panels ----- */}
        {showSidebar && (activeSlideType === 1 || activeSlideType === 3) && (
          <div
            className="bg-white rounded-xl shadow p-4 overflow-y-auto w-full md:h-full md:w-1/3 lg:w-1/4 md:static fixed inset-x-0 bottom-0 top-14 z-50"
            style={
              isMobile
                ? {
                    top: "calc(3.5rem + env(safe-area-inset-top))",
                    maxHeight: "none",
                  }
                : undefined
            }
          >
            {activeSlideType === 3 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                {/* ???? ???? ???? ???? */}
                <div className="w-full flex justify-end mb-4">
                  <button
                    onClick={handleCloseSidebarPanel}
                    className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                
                {/* ??? ?? ??? */}
                <div className="flex-grow flex items-center justify-center">
                  <p className="text-gray-700 font-medium text-2xl mb-30">
                    This slide does not require any additional settings.
                  </p>
                </div>
              </div>
            ) : (
              (() => {
                // ????? ????? ??? activeSlide.question ???? ????
                if (!activeSlide?.question) {
                  return (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4">
                      <div className="text-yellow-500 mb-2">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-12 w-12"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                          />
                        </svg>
                      </div>
                      <p className="text-gray-700 font-medium">
                        First, select the question type.
                      </p>
                      <button
                        onClick={handleTypeChangeClick}
                        className="mt-4 bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600 transition"
                      >
                        Select Type
                      </button>
                    </div>
                  );
                }

                const validQuestionTypes = ["single", "multiple"];

                if (
                  !activeSlide.question.question_type ||
                  !validQuestionTypes.includes(activeSlide.question.question_type)
                ) {
                  return (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4">
                      <div className="text-red-500 mb-2">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-12 w-12"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <p className="text-gray-700 font-medium">
                        Question type is invalid.
                      </p>
                    </div>
                  );
                }

                // ??? ??? ????? ?????? ???? ???????? Sidebar ?? ???? ??
                return (
                    <Sidebar
                      quizId={quiz.quiz_id}
                      slide={activeSlide}
                      onSaveAndRefresh={handleSaveAndRefresh}
                      activeSlideType={activeSlideType}
                      onClose={handleCloseSidebarPanel}
                      onDirtyChange={setHasSidebarChanges}
                      onSlideUpdated={handleSlideUpdated}
                      onNotify={showNotice}
                  />
                );
              })()
            )}
          </div>
        )}

        {/* ----------------------------------------------------------------------------------------------------- */}
        
        {showDesignPanel && (
          <div
            className="bg-white rounded-xl shadow p-4 overflow-y-auto w-full md:h-full md:w-1/3 lg:w-1/4 md:static fixed inset-x-0 bottom-0 top-14 z-50"
            style={
              isMobile
                ? {
                    top: "calc(3.5rem + env(safe-area-inset-top))",
                    maxHeight: "none",
                  }
                : undefined
            }
          >
            {activeSlide && (
              <DesignPanel
                quiz={quiz}
                updateQuiz={updateQuiz}
                onClose={handleCloseDesignPanel}
                setBackgroundSaveNotice={setBackgroundSaveNotice}
                onDirtyChange={setHasDesignChanges}
              />
            )}
          </div>
        )}

        {backgroundSaveNotice && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg">
            {backgroundSaveNotice}
          </div>
        )}

        {showAudioPanel && (
          <div
            className="bg-white rounded-xl shadow p-4 overflow-y-auto w-full md:h-full md:w-1/3 lg:w-1/4 md:static fixed inset-x-0 bottom-0 top-14 z-50"
            style={
              isMobile
                ? {
                    top: "calc(3.5rem + env(safe-area-inset-top))",
                    maxHeight: "none",
                  }
                : undefined
            }
          >
            {activeSlide && (
              <AudioPanel
                slide={activeSlide}
                setSlide={updateActiveSlide}
                onClose={handleCloseAudioPanel}
                quiz={quiz}
                updateQuiz={updateQuiz}
                setAudioSaveNotice={setAudioSaveNotice}
                onDirtyChange={setHasAudioChanges}
              />
            )}
          </div>
        )}

        {audioSaveNotice && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg">
            {audioSaveNotice}
          </div>
        )}

        {/* ----- RightToolbar ----- */}
        <RightToolbar
          activeTab={activeTab}
          setActiveTab={handleTabClick}
          isCompact={isMobile}
          // hasQuestion={activeSlide?.slide_type === 1}
        />
      </div>
      {isMobile && showSlidesPanel && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowSlidesPanel(false)}
          ></div>
          <div
            className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-2xl p-4 overflow-y-auto"
            style={{
              top: "calc(3.5rem + env(safe-area-inset-top))",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800">Slides</h2>
              <button
                onClick={() => setShowSlidesPanel(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <SlidesPanel
              slides={slides}
              activeSlideId={activeSlide?.slide_id}
              setActiveSlideId={(id) => {
                handleSetActiveSlideIdForMobile(id);
              }}
              setActiveSlideTypeParent={setActiveSlideType}
              addNewSlide={addNewSlide}
              deleteSlide={deleteSlide}
              onSlidesReordered={(updatedSlides) => {
                updateQuiz({
                  ...quiz,
                  slides: updatedSlides,
                });
                if (activeSlide?.slide_id) {
                  const nextIndex = updatedSlides.findIndex(
                    (slide) => slide.slide_id === activeSlide.slide_id
                  );
                  if (nextIndex !== -1) {
                    setActiveSlideIndex(nextIndex);
                  }
                }
              }}
              onRefresh={handleDeleteLeaderboardAndRefresh}
              onLeaderboardDeleted={handleLeaderboardDeleted}
              idKey="slide_id"
              titleKey="slide_type"
              getSlideTitle={getSlideTitle}
              quizId={quiz.quiz_id}
              quizBackground={quiz.background_color}
              quizBackgroundImage={quiz.background_image_url}
              onNotify={showNotice}
            />
          </div>
        </div>
      )}
      {notice && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-50 px-4"
          style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
        >
          <div
            className={`rounded-full px-4 py-2 text-sm font-semibold shadow-lg ${
              notice.tone === "success"
                ? "bg-emerald-500 text-white"
                : notice.tone === "error"
                ? "bg-red-500 text-white"
                : notice.tone === "warning"
                ? "bg-amber-500 text-white"
                : "bg-slate-700 text-white"
            }`}
          >
            {notice.message}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        confirmVariant="destructive"
        isLoading={false}
      />
    </div>
  );
}
