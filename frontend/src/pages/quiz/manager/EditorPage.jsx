import { useState, useEffect } from "react";
import MiniResultsResultsOnly from "./MiniResultsResultsOnly";
import LeaderboardPreview from "./LeaderboardPreview";
import QuizHeader from "../../../components/QuizHeader";
import Sidebar from "./Sidebar";
import SlidesPanel from "./SlidesPanel";
import RightToolbar from "./RightToolbar";
import DesignPanel from "./DesignPanel";
import AudioPanel from "./AudioPanel"; 

export default function EditorPage() {
  const [selectedQuestionType, setSelectedQuestionType] = useState(null);

  return (
    <div className="h-screen p-4 bg-gray-50 relative overflow-hidden">
      <QuestionEditor onBack={() => setStep("select")}  
      selectedQuestionType={selectedQuestionType}/>
    </div>
  );
}


function QuestionEditor({ selectedQuestionType }) {
  const [slides, setSlides] = useState(() => {
    const saved = localStorage.getItem("slides");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.warn("Invalid slides data, resetting...");
      }
    }

    return [
      {
        slide_type: 1,
        question_id: 1,
        question_text: "What is the capital of France?",
        question_type: "", 
        question_image: "",
        question_time: 20,
        max_point: 100,
        min_point: 0,
        scoring_type: "",
        backgroundColor: "#ffffff",
        backgroundImage: "",
        sound:"",
        options: [
          { option_id: 72, option_text: "Berlin", answer: false, votes: 6, image: "" },
          { option_id: 73, option_text: "Madrid", answer: false, votes: 4, image: "" },
          { option_id: 74, option_text: "Paris", answer: true, votes: 9, image: "" },
          { option_id: 75, option_text: "Rome", answer: false, votes: 7, image: "" },
        ],
      },
    ];
  });

  const result = {
    optionsResult: [
      { option_id: 72, answer: false, votes: 6 },
      { option_id: 73, answer: false, votes: 4 },
      { option_id: 74, answer: true, votes: 9 },
      { option_id: 75, answer: false, votes: 5 },
    ],
  };

  const [activeSlideId, setActiveSlideId] = useState(slides[0]?.question_id || null);
  const activeSlide = slides.find((s) => s.question_id === activeSlideId);

  const [activeTab, setActiveTab] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showDesignPanel, setShowDesignPanel] = useState(false);
  const [showAudioPanel, setShowAudioPanel] = useState(false); // State جدید برای AudioPanel

  const handleTabClick = (tabId) => {
    // مدیریت Audio tab - toggle behavior
    if (tabId === "audio") {
      setShowAudioPanel(prev => !prev);
      setShowSidebar(false);
      setShowDesignPanel(false);
      // اگر پنل آدیو باز است، آن را ببند و برعکس
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
    
    // اگر کلیک روی تب audio نبود، مقدار activeTab را تنظیم کن
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

  const saveSlides = () => {
    localStorage.setItem("slides", JSON.stringify(slides));
    alert("✅ Quiz saved successfully!");
  };

  const updateActiveSlide = (updatedSlide) => {
    setSlides((prev) =>
      prev.map((s) => (s.question_id === activeSlideId ? updatedSlide : s))
    );
  };

  const addNewSlide = () => {
    const newId = slides.length ? Math.max(...slides.map((s) => s.question_id)) + 1 : 1;

    const newSlide = {
      slide_type: 1,
      question_id: newId,
      question_text: "New Question",
      question_type: "", 
      question_image: "",
      question_time: 10,
      max_point: 50,
      min_point: 0,
      scoring_type: "",
      backgroundColor: "#ffffff",
      backgroundImage: "",
      sound: "",
      options: [
        { option_id: 1, option_text: "Option 1", answer: false, vote: 0, image: "" },
        { option_id: 2, option_text: "Option 2", answer: true, vote: 0, image: "" },
      ],
    };

    setSlides([...slides, newSlide]);
    setActiveSlideId(newId);
  };

  const createLeaderboardSlide = () => {
    const newId = slides.length ? Math.max(...slides.map((s) => s.question_id)) + 1 : 1;

    const leaderboardSlide = {
      slide_type: 2,
      question_id: newId,
      leaderboard_title: "Leaderboard",
      backgroundColor: "#ffffff",
      backgroundImage: "",
      linked_question_id: activeSlideId,
    };

    console.log("Creating leaderboard slide with ID:", newId, leaderboardSlide);

    // Insert leaderboard slide right after the active question slide
    setSlides((prev) => {
      const activeIndex = prev.findIndex((s) => s.question_id === activeSlideId);
      console.log("Active slide index:", activeIndex, "Active ID:", activeSlideId);
      if (activeIndex !== -1) {
        const newSlides = [...prev];
        newSlides.splice(activeIndex + 1, 0, leaderboardSlide);
        console.log("Inserted at index", activeIndex + 1, "New slides:", newSlides);
        return newSlides;
      }
      return [...prev, leaderboardSlide];
    });

    console.log("Setting active slide ID to:", newId);
    setActiveSlideId(newId);
  };

  const deleteLeaderboardSlide = (linkedQuestionId) => {
    setSlides((prev) => {
      const filteredSlides = prev.filter(
        (s) => !(s.slide_type === 2 && s.linked_question_id === linkedQuestionId)
      );
      return filteredSlides;
    });
  };

  const deleteSlide = (id) => {
    const newSlides = slides.filter((s) => s.question_id !== id);
    setSlides(newSlides);

    if (activeSlideId === id && newSlides.length) {
      setActiveSlideId(newSlides[0].question_id);
    } else if (!newSlides.length) {
      setActiveSlideId(null);
    }
  };

  const reorderSlides = (result) => {
    if (!result.destination) return;

    const reordered = Array.from(slides);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);

    setSlides(reordered);
  };

  useEffect(() => {
    localStorage.setItem("slides", JSON.stringify(slides));
  }, [slides]);

  const [showTypeBox, setShowTypeBox] = useState(false);

  const handleTypeChangeClick = () => setShowTypeBox(true);

  const handleSelectType = (type) => {
    console.log("Selected question type:", type);
    
    // تبدیل به فرمت مورد نیاز
    const questionType = type === "Single Choice" ? "single" : "multiple";
    
    // هنگام تغییر نوع سوال، تنظیم مجدد گزینه‌های درست
    let updatedOptions = [...activeSlide.options];
    
    if (questionType === "single") {
      // برای Single Choice، فقط اولین گزینه درست را نگه دار
      const firstTrueIndex = updatedOptions.findIndex(opt => opt.answer);
      if (firstTrueIndex > 0) {
        updatedOptions = updatedOptions.map((opt, index) => ({
          ...opt,
          answer: index === firstTrueIndex
        }));
      }
    }
    
    updateActiveSlide({
      ...activeSlide,
      question_type: questionType,
      options: updatedOptions,
      // برای Single Choice، Partial Scoring را غیرفعال کن
      partial_scoring: questionType === "single" ? false : activeSlide.partial_scoring
    });

    setShowTypeBox(false);
  };

  // اعمال question_type انتخاب‌شده از صفحه اول
  useEffect(() => {
    if (selectedQuestionType && activeSlide) {
      const questionType = selectedQuestionType === "Single Choice" ? "single" : 
                          selectedQuestionType === "Multiple Choice" ? "multiple" : 
                          selectedQuestionType;
      
      updateActiveSlide({
        ...activeSlide,
        question_type: questionType,
        partial_scoring: questionType === "single" ? false : activeSlide.partial_scoring
      });
    }
  }, [selectedQuestionType]);


  return (
  <div className="h-full flex flex-col relative pt-14">
    {/* ----- Header -----*/}
    <QuizHeader/>

    {/* ----- Main Layout ----- */}
    <div className="flex flex-1 overflow-hidden">
      {/* ----- Left Panel ----- */}
      <div className="bg-white rounded-xl shadow p-4 h-full overflow-y-auto w-1/5">
        <SlidesPanel
          slides={slides}
          activeSlideId={activeSlideId}
          setActiveSlideId={setActiveSlideId}
          addNewSlide={addNewSlide}
          deleteSlide={deleteSlide}
          reorderSlides={reorderSlides}
          idKey="question_id"
          titleKey="question_text"
        />
      </div>

      {/* ----- Middle panel ----- */}
      <div className="flex-1 mx-4 relative">
        <div className="bg-white rounded-xl shadow p-2 h-full flex justify-center items-center overflow-hidden relative">
          {/* ----- Present Button ----- */}
          <button
            onClick={saveSlides}
            className="absolute top-2 left-2 bg-blue-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-blue-600 transition z-10"
          >
            Present
          </button>

          <button
            onClick={handleTypeChangeClick}
            className="absolute top-2 right-2 text-sm text-gray-500 hover:text-gray-700 z-10"
          >
            Change Question Type
          </button>

          {activeSlide ? (
            activeSlide.slide_type === 2 ? (
              <div className="w-full h-full flex justify-center items-center">
                <LeaderboardPreview 
                  slide={activeSlide} 
                  isFullSize={!showSidebar && !showDesignPanel && !showAudioPanel}
                />
              </div>
            ) : (
              <div className="w-full h-full flex justify-center items-center">
                <MiniResultsResultsOnly 
                  slide={activeSlide} 
                  result={result}
                  isFullSize={!showSidebar && !showDesignPanel && !showAudioPanel}
                />
              </div>
            )
          ) : (
            <p className="text-gray-400">No slide selected.</p>
          )}

          {showTypeBox && (
            <>
              <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm z-10"
                onClick={() => setShowTypeBox(false)}
              ></div>

              <div className="absolute z-20 bg-white rounded-2xl shadow-2xl p-6 w-[400px] flex flex-col items-center space-y-4">
                <h2 className="text-xl font-bold text-pink-700">Select Question Type</h2>

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
      {showSidebar && (
        <div className="bg-white rounded-xl shadow p-4 h-full overflow-y-auto w-1/4">
          {activeSlide && (
            <Sidebar 
              slide={activeSlide} 
              setSlide={updateActiveSlide}
              onCreateLeaderboardSlide={createLeaderboardSlide}
              onDeleteLeaderboardSlide={deleteLeaderboardSlide}
              slides={slides}
              onClose={handleCloseSidebarPanel}
            />
          )}
        </div>
      )}

      {showDesignPanel && (
        <div className="bg-white rounded-xl shadow p-4 h-full overflow-y-auto w-1/4">
          {activeSlide && (
            <DesignPanel
              slide={activeSlide}
              setSlide={updateActiveSlide}
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
            />
          )}
        </div>
      )}

      {/* ----- RightToolbar ----- */}
      <RightToolbar 
        activeTab={activeTab} 
        setActiveTab={handleTabClick}
      />
    </div>
  </div>
);
}