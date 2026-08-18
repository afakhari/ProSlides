import React from "react";
import TopBar from "../../../components/TopBar";
import Footer from "../../../components/Footer";
import { useLiveSession } from "../../../hooks/useLiveSession";

export default function ManagerContentSlide({
  roomId,
  quiz,
  content,
  currentSlide = 1,
  totalSlides = 1,
  onNext,
  onEndGame,
}) {
  const { sendNavigation, sendEnd } = useLiveSession();
  const slide = quiz?.slides?.[currentSlide - 1] || {};
  const source = content && typeof content === "object" ? content : slide;

  const title = source.title || source.content_title || "";
  const text = source.content_text || source.text || "";
  const image =
    source.content_image_url || source.image_url || source.image || "";

  const handleNext = async () => {
    const nextSlide = quiz?.slides?.[currentSlide];
    if (!(await sendNavigation("next", { slide: nextSlide }))) return;
    onNext?.();
  };

  const handleEnd = async () => {
    if (!(await sendEnd())) return;
    onEndGame?.();
  };

  return (
    <div className="min-h-screen w-full" style={{ background: quiz?.background?.color || "#0f172a" }}>
      <TopBar pageType="quiz" roomId={roomId || quiz?.access_code || ""} quiz={quiz} />

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
        currentSlide={Math.max(currentSlide, 1)}
        totalSlides={Math.max(totalSlides, 1)}
        onNext={handleNext}
        onEnd={handleEnd}
      />
    </div>
  );
}
