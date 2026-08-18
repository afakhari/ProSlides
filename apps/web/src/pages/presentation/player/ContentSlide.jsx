import React from "react";
import TopBar from "../../../components/TopBar";

export default function PlayerContentSlide({ roomId, quiz, content }) {
  const title = content?.title || content?.content_title || "";
  const text = content?.content_text || content?.text || "";
  const image =
    content?.content_image_url || content?.image_url || content?.image || "";

  return (
    <div className="min-h-screen w-full" style={{ background: quiz?.background?.color || "#0f172a" }}>
      <TopBar pageType="quiz" roomId={roomId} quiz={quiz} isMobilePlayer={true} />

      <main className="mx-auto max-w-5xl px-6 py-8 text-center text-white">
        {title && <h1 className="mb-4 text-3xl font-bold">{title}</h1>}
        {text && <p className="mx-auto mb-6 max-w-3xl whitespace-pre-wrap text-lg leading-8">{text}</p>}
        {image && (
          <div className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-white/15 bg-white/5 p-2">
            <img src={image} alt={title || "content"} className="mx-auto max-h-[60vh] w-auto rounded-lg" />
          </div>
        )}
      </main>
    </div>
  );
}
