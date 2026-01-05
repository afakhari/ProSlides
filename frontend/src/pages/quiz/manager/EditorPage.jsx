import { useState, useEffect } from "react";
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
import Waiting from "../../loading/LoadingPage";
import { X } from "lucide-react";

export default function EditorPage() {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const quizId = parseInt(roomId, 10);

  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchQuiz = async () => {
      if (!quizId) {
        setError("There is no quiz.");
        setLoading(false);
        return;
      }

      try {
        // اگر quiz_id داریم، کوئیز را از سرور بگیر
        const quizData = await quizService.getQuiz(quizId);
        setQuiz(quizData);
      } catch (err) {
        setError("Failed to load quiz");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [quizId, navigate]);

  const updateQuiz = (updatedQuiz) => {
    setQuiz(updatedQuiz);
  };

  const saveQuiz = async () => {
    if (!quiz) return;

    try {
      const savedQuiz = await quizService.updateQuiz(quiz.quiz_id, quiz);
      setQuiz(savedQuiz);
      
      // همچنین slides را هم رفرش کنید
      const freshSlides = await quizService.getSlidesFromAPI(quiz.quiz_id);
      setQuiz(prev => ({
        ...prev,
        slides: freshSlides.slides || []
      }));
      
      alert("✅ Quiz saved successfully!");
    } catch (err) {
      alert("❌ Failed to save quiz");
      console.error(err);
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
    <QuestionEditor quiz={quiz} updateQuiz={updateQuiz} saveQuiz={saveQuiz} />
  );
}


function QuestionEditor({ quiz, updateQuiz, saveQuiz }) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  

  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const navigate = useNavigate();
  const [activeSlideType, setActiveSlideType] = useState(null);

  const slides = quiz.slides || [];
  const activeSlide = slides[activeSlideIndex] || null;

  const [activeTab, setActiveTab] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showDesignPanel, setShowDesignPanel] = useState(false);
  const [showAudioPanel, setShowAudioPanel] = useState(false);
  const [showTypeBox, setShowTypeBox] = useState(false);


  const handleSaveAndRefresh = async () => {
    try {
      // ذخیره کوئیز
      await saveQuiz();
      
      // رفرش داده‌های کوئیز از سرور
      const freshQuiz = await quizService.getQuiz(quiz.quiz_id);
      updateQuiz(freshQuiz);
      
      // رفرش SlidesPanel
      setRefreshTrigger(prev => prev + 1);
      
    } catch (error) {
      console.error("Failed to save and refresh:", error);
    }
  };

  const handleDeleteLeaderboardAndRefresh = async () => {
    try {
      // رفرش داده‌های کوئیز از سرور
      const freshQuiz = await quizService.getQuiz(quiz.quiz_id);
      updateQuiz(freshQuiz);
      
      // رفرش SlidesPanel
      setRefreshTrigger(prev => prev + 1);
      
    } catch (error) {
      console.error("Failed to save and refresh:", error);
    }
  };


  // توابع برای مدیریت تب‌ها
  const handleTabClick = (tabId) => {
    if (tabId === "audio") {
      setShowAudioPanel((prev) => !prev);
      setShowSidebar(false);
      setShowDesignPanel(false);
      if (showAudioPanel) {
        setActiveTab(null);
      } else {
        setActiveTab(tabId);
      }
    } else if (tabId === "content") {
      setShowSidebar(!showSidebar);
      setShowDesignPanel(false);
      setShowAudioPanel(false);
    } else if (tabId === "design") {
      setShowDesignPanel(!showDesignPanel);
      setShowSidebar(false);
      setShowAudioPanel(false);
    } else {
      setShowSidebar(false);
      setShowDesignPanel(false);
      setShowAudioPanel(false);
    }

    if (tabId !== "audio" || !showAudioPanel) {
      setActiveTab(tabId);
    }
  };

  const handleCloseAudioPanel = () => {
    setShowAudioPanel(false);
    setActiveTab(null);
  };

  const handleCloseDesignPanel = () => {
    setShowDesignPanel(false);
    setActiveTab(null);
  };

  const handleCloseSidebarPanel = () => {
    setShowSidebar(false);
    setActiveTab(null);
  };

  // تابع کمکی برای گرفتن عنوان اسلاید
  const getSlideTitle = (slide) => {
    if (slide.slide_type === 1 && slide.question) {
      return slide.question.text || "Question Slide";
    } else if (slide.slide_type === 3) {
      return slide.title || "Leaderboard";
    }
    // return `Slide ${slide.order}`;
    return "No Question Yet";
  };

  // ایجاد اسلاید جدید
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

      // ارسال به سرور برای ایجاد اسلاید جدید
      const createdSlide = await quizService.createSlide(
        quiz.quiz_id,
        newSlideData
      );

      // به‌روزرسانی quiz با اسلاید جدید
      const updatedSlides = [...slides, createdSlide];
      updateQuiz({
        ...quiz,
        slides: updatedSlides,
      });

      // انتخاب اسلاید جدید
      setActiveSlideIndex(updatedSlides.length - 1);
    } catch (error) {
      console.error("Failed to create new slide:", error);
      alert("❌ Failed to create new slide");
    }
  };



  // حذف اسلاید
  const deleteSlide = async (slideId) => {
    try {
      // حذف از سرور
      await quizService.deleteSlide(quiz.quiz_id, slideId);

      // به‌روزرسانی state
      const slideIndex = slides.findIndex((s) => s.slide_id === slideId);
      const updatedSlides = slides.filter((s) => s.slide_id !== slideId);

      updateQuiz({
        ...quiz,
        slides: updatedSlides,
      });

      // تنظیم اسلاید فعال
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
      alert("❌ Failed to delete slide");
    }
  };

  // به‌روزرسانی اسلاید فعال
  const updateActiveSlide = async (updatedSlide) => {
    try {
      // ارسال به سرور
      const savedSlide = await quizService.updateSlide(
        quiz.quiz_id,
        updatedSlide.slide_id,
        updatedSlide
      );

      // به‌روزرسانی state
      const updatedSlides = slides.map((s) =>
        s.slide_id === updatedSlide.slide_id ? savedSlide : s
      );

      updateQuiz({
        ...quiz,
        slides: updatedSlides,
      });
    } catch (error) {
      console.error("Failed to update slide:", error);
      alert("❌ Failed to update slide");
    }
  };

  // تغییر نوع سوال
  const handleTypeChangeClick = () => {
    setShowTypeBox(true);
  };


  const handleSelectType = async (type) => {
    if (!activeSlide || activeSlide.slide_type !== 1) return;

    const questionType = type === "Single Choice" ? "single" : "multiple";
    const quizId = quiz.quiz_id;
    const slideId = activeSlide.slide_id;
    const currentQuestion = activeSlide.question;

    try {
      let updatedQuestion;

      if (!currentQuestion || !currentQuestion.question_id) {
        // حالت 1: ایجاد سوال جدید
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
        // حالت 2: به‌روزرسانی سوال موجود
        
        // ابتدا type سوال را آپدیت می‌کنیم
        const updateData = {
          ...currentQuestion,
          question_type: questionType,
        };

      
        // اگر از multiple به single تغییر می‌کند، آپشن‌ها را جداگانه آپدیت می‌کنیم
        if (currentQuestion.question_type === "multiple" && questionType === "single") {
          if (currentQuestion.options && currentQuestion.options.length > 0) {
            // پیدا کردن اولین گزینه‌ای که قبلاً correct بوده
            const firstCorrectIndex = currentQuestion.options.findIndex(option => option.is_correct);
            
            // تعیین اندیس گزینه‌ای که باید true بماند
            const indexToKeepTrue = firstCorrectIndex !== -1 ? firstCorrectIndex : 0;
            
            // آپدیت هر گزینه به صورت جداگانه
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
            
            // منتظر می‌مانیم تا همه آپدیت‌ها کامل شوند
            await Promise.all(updatePromises);

            updatedQuestion = await quizService.updateQuestion(
              quizId,
              slideId,
              {question_type: questionType}
            );
            
            // به‌روزرسانی داده‌های محلی گزینه‌ها
            const updatedOptions = currentQuestion.options.map((option, index) => ({
              ...option,
              is_correct: index === indexToKeepTrue
            }));
            
            // به‌روزرسانی question با گزینه‌های آپدیت شده
            updatedQuestion = updateData;
            updatedQuestion.options = updatedOptions;
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

      // به‌روزرسانی state
      const updatedSlide = {
        ...activeSlide,
        question: updatedQuestion,
      };

      // به‌روزرسانی در state اصلی
      const updatedSlides = slides.map((s) =>
        s.slide_id === slideId ? updatedSlide : s
      );

      updateQuiz({
        ...quiz,
        slides: updatedSlides,
      });

      setShowTypeBox(false);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Error changing question type:", error);

      if (error.response?.status === 400) {
        const errorMsg = error.response.data;
        alert(`Error: ${JSON.stringify(errorMsg)}`);
      } else {
        alert("Unexpected error. Please try again.");
      }
    }
  };



  // تابع برای به‌روزرسانی اسلاید پس از ذخیره در Sidebar
  const handleSlideUpdated = (updatedSlide) => {
    // به‌روزرسانی اسلاید در state اصلی
    const updatedSlides = slides.map((s) =>
      s.slide_id === updatedSlide.slide_id ? updatedSlide : s
    );

    updateQuiz({
      ...quiz,
      slides: updatedSlides,
    });

    // به‌روزرسانی اسلاید فعال
    setActiveSlideIndex(
      updatedSlides.findIndex((s) => s.slide_id === updatedSlide.slide_id)
    );
  };

  // Present
  // const handlePresent = () => {
  //   navigate(`/manager/presentation/${quiz.quiz_id}/`);
  // };


  const handlePresent = () => {
  // بررسی وجود slides
    if (!quiz.slides || quiz.slides.length === 0) {
      alert("Quiz has no slides");
      return;
    }

    // بررسی وجود سوال معتبر در همه اسلایدها
    const allSlidesHaveQuestions = quiz.slides.every(slide => {
      return slide.question && 
            typeof slide.question === 'object' && 
            slide.question !== null &&
            Object.keys(slide.question).length > 0;
    });

    if (!allSlidesHaveQuestions) {
      alert("All slides must have at least one question");
    } else {
      navigate(`/manager/presentation/${quiz.quiz_id}/`);
    }
  };

  // Calculate cumulative leaderboard for the current slide if it's a leaderboard slide
  const getCumulativeLeaderboard = () => {
    if (activeSlideType !== 3) return null;

    const playerScores = {};
    const playerDetails = {};

    // Iterate through all slides BEFORE the current one
    for (let i = 0; i <= activeSlideIndex; i++) {
      const slide = slides[i];

      // Only aggregate scores from Question slides (Type 1)
      if (
        slide.slide_type === 1 &&
        slide.leaderboard &&
        Array.isArray(slide.leaderboard)
      ) {
        slide.leaderboard.forEach((player) => {
          const id = player.rust_session_id || player.player_name;

          if (!playerScores[id]) {
            playerScores[id] = 0;
            playerDetails[id] = {
              rust_session_id: player.rust_session_id,
              player_name: player.player_name,
              avatar: player.avatar,
            };
          }

          playerScores[id] += player.score || 0;
        });
      }
    }

    // Convert back to array
    const cumulativeLeaderboard = Object.keys(playerScores).map((id) => ({
      ...playerDetails[id],
      score: playerScores[id],
    }));

    // Sort by score descending
    cumulativeLeaderboard.sort((a, b) => b.score - a.score);

    // Assign ranks
    cumulativeLeaderboard.forEach((p, index) => {
      p.rank = index + 1;
    });

    return cumulativeLeaderboard;
  };







  const handleLeaderboardDeleted = async (leaderboardSlideId) => {
    try {
      
      // پیدا کردن اسلاید لیدربردی که حذف شده
      const leaderboardSlide = slides.find(s => 
        s.slide_id === leaderboardSlideId && s.slide_type === 3
      );
      
      if (!leaderboardSlide) {
        return;
      }

      // پیدا کردن اسلاید سوال مرتبط
      const questionSlide = slides.find(s => 
        s.slide_type === 1 && s.order === leaderboardSlide.order
      );

      if (!questionSlide) {
        return;
      }

      // فقط به‌روزرسانی state محلی - بدون ارسال به سرور
      const updatedSlides = slides.map(slide => 
        slide.slide_id === questionSlide.slide_id 
          ? { ...slide, show_leaderboard_after: false }
          : slide
      );

      // به‌روزرسانی state اصلی
      updateQuiz({
        ...quiz,
        slides: updatedSlides
      });

      if (activeSlide?.slide_id === questionSlide.slide_id) {
        activeSlide.show_leaderboard_after = false;
      }

      // رفرش SlidesPanel
      //setRefreshTrigger(prev => prev + 1);
      
    } catch (error) {
      console.error("❌ Error updating UI after leaderboard deletion:", error);
    }
  };
  //////////////////////////////////////////////////////////////////////////////////////////////////////////
  return (
    <div className="h-full flex flex-col relative pt-14">
      {/* ----- Header -----*/}
      <QuizHeader
        accessCode={quiz.access_code}
        quizTitle={quiz.title}
        quizId={quiz.quiz_id}
      />

      {/* ----- Main Layout ----- */}
      <div className="flex flex-1 overflow-hidden">
        {/* ----- Left Panel (Slides Panel) ----- */}
        <div className="bg-white rounded-xl shadow p-4 h-full overflow-y-auto w-1/5">
          <SlidesPanel
            slides={slides}
            activeSlideId={activeSlide?.slide_id}
            setActiveSlideId={(id) => {
              const slide = slides.find((s) => s.slide_id === id);
              if (slide) {
                const index = slides.indexOf(slide);
                setActiveSlideIndex(index);
              }
            }}
            setActiveSlideTypeParent={setActiveSlideType}
            addNewSlide={addNewSlide}
            deleteSlide={deleteSlide}
            reorderSlides={async (result) => {
              if (!result.destination) return;

              const reordered = Array.from(slides);
              const [removed] = reordered.splice(result.source.index, 1);
              reordered.splice(result.destination.index, 0, removed);

              // به‌روزرسانی order اسلایدها
              const updatedSlides = reordered.map((slide, index) => ({
                ...slide,
                order: index + 1,
              }));

              // ذخیره در سرور
              try {
                await quizService.reorderSlides(quiz.quiz_id, updatedSlides);
                updateQuiz({
                  ...quiz,
                  slides: updatedSlides,
                });
              } catch (error) {
                console.error("Failed to reorder slides:", error);
                alert("❌ Failed to reorder slides");
              }
            }}
            refreshTrigger={refreshTrigger}
            onLeaderboardDeleted={handleLeaderboardDeleted}
            idKey="slide_id"
            titleKey="slide_type"
            getSlideTitle={getSlideTitle}
            quizId={quiz.quiz_id}
            quizBackground={quiz.background_color}
            quizBackgroundImage={quiz.background_image_url}
            handleDeleteLeaderboardAndRefresh={handleDeleteLeaderboardAndRefresh}
          />
        </div>

        {/* ----- Middle panel ----- */}
        <div className="flex-1 mx-4 relative">
          <div className="bg-white rounded-xl shadow p-2 h-full flex justify-center items-center overflow-hidden relative">
            {/* ----- Present Button ----- */}
            <button
              onClick={handlePresent}
              className="absolute top-2.5 left-2.5 bg-gradient-to-r from-slate-500 to-teal-600 
                        hover:from-slate-600 hover:to-teal-700 text-white px-4 py-2.5 rounded-xl text-base font-semibold transition z-10"
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
                  <LeaderboardPreview
                    slide={activeSlide}
                    quizBackground={quiz.background_color}
                    quizBackgroundImage={quiz.background_image_url}
                    isFullSize={
                      !showSidebar && !showDesignPanel && !showAudioPanel
                    }
                    customLeaderboard={getCumulativeLeaderboard()}
                  />
                </div>
              ) : activeSlideType === 1 && activeSlide.question ? (
                <div className="w-full h-full flex justify-center items-center">
                  <MiniResultsResultsOnly
                    slide={activeSlide}
                    quizBackground={quiz.background_color}
                    quizBackgroundImage={quiz.background_image_url}
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

                  {["Single Choice", "Multiple Choice"].map((type) => (
                    <button
                      key={type}
                      onClick={() => handleSelectType(type)}
                      className="w-full bg-pink-500 text-white py-2 rounded-xl hover:bg-pink-600 transition"
                    >
                      {type}
                    </button>
                  ))}

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
        </div>

        {/* ----- Right Panels ----- */}
        {showSidebar && (activeSlideType === 1 || activeSlideType === 3) && (
          <div className="bg-white rounded-xl shadow p-4 h-full overflow-y-auto w-1/4">
            {activeSlideType === 3 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                {/* ردیف برای دکمه بستن */}
                <div className="w-full flex justify-end mb-4">
                  <button
                    onClick={handleCloseSidebarPanel}
                    className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                
                {/* متن در وسط */}
                <div className="flex-grow flex items-center justify-center">
                  <p className="text-gray-700 font-medium text-2xl mb-30">
                    This slide does not require any additional settings.
                  </p>
                </div>
              </div>
            ) : (
              (() => {
                // بررسی اینکه آیا activeSlide.question وجود دارد
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

                // اگر همه شرایط برقرار بود، کامپوننت Sidebar را رندر کن
                return (
                    <Sidebar
                      quizId={quiz.quiz_id}
                      slide={activeSlide}
                      setSlide={setActiveSlideIndex}
                      onSaveAndRefresh={handleSaveAndRefresh}
                      slides={slides}
                      activeSlideType={activeSlideType}
                      onClose={handleCloseSidebarPanel}
                    onSlideUpdated={handleSlideUpdated}
                  />
                );
              })()
            )}
          </div>
        )}

        {/* ----------------------------------------------------------------------------------------------------- */}
        
        {showDesignPanel && (
          <div className="bg-white rounded-xl shadow p-4 h-full overflow-y-auto w-1/4">
            {activeSlide && (
              <DesignPanel
                quiz={quiz}
                updateQuiz={updateQuiz}
                onClose={handleCloseDesignPanel}
              />
            )}
          </div>
        )}

        {showAudioPanel && (
          <div className="bg-white rounded-xl shadow p-4 h-full overflow-y-auto w-1/4">
            {activeSlide && (
              <AudioPanel
                slide={activeSlide}
                setSlide={updateActiveSlide}
                onClose={handleCloseAudioPanel}
                quiz={quiz}
                updateQuiz={updateQuiz}
              />
            )}
          </div>
        )}

        {/* ----- RightToolbar ----- */}
        <RightToolbar
          activeTab={activeTab}
          setActiveTab={handleTabClick}
          // hasQuestion={activeSlide?.slide_type === 1}
        />
      </div>
    </div>
  );
}
