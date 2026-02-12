import React from "react";
import TopBar from "../../../components/TopBar";
import Footer from "../../../components/Footer";
import { useWebSocket } from "../../../hooks/useWebSocket";

export default function ManagerContentSlide({
  quiz,
  currentSlide = 1,
  totalSlides = 1,
  onNext,
  onPrevious,
  onEndGame,
}) {
  const { sendNavigation, sendEnd } = useWebSocket();
  const slide = quiz?.slides?.[currentSlide - 1] || {};

  const title = slide.title || "";
  const text = slide.content_text || "";
  const image = slide.content_image_url || "";

  const handleNext = () => {
    sendNavigation("next");
    onNext?.();
  };

  const handlePrevious = () => {
    sendNavigation("previous");
    onPrevious?.();
  };

  const handleEnd = () => {
    sendEnd();
    onEndGame?.();
  };

  return (
    <div className="min-h-screen w-full" style={{ background: quiz?.background?.color || "#0f172a" }}>
      <TopBar pageType="quiz" roomId={quiz?.access_code || ""} quiz={quiz} />

      <main className="mx-auto max-w-5xl px-6 py-8 text-center text-white">
        {title && <h1 className="mb-4 text-3xl font-bold">{title}</h1>}
        {text && <p className="mx-auto mb-6 max-w-3xl whitespace-pre-wrap text-lg leading-8">{text}</p>}
        {image && (
          <div className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-white/15 bg-white/5 p-2">
            <img src={image} alt={title || "content"} className="mx-auto max-h-[60vh] w-auto rounded-lg" />
          </div>
        )}
      </main>

      <Footer
        pageType="quiz"
        currentQuestion={Math.max(currentSlide, 1)}
        totalQuestions={Math.max(totalSlides, 1)}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onEnd={handleEnd}
      />
    </div>
  );
}
