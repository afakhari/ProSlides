import React from "react";
import ShareMenu from "./ShareMenu";

export default function QuizHeader() {
  return (
    <header
      className="fixed top-0 left-0 right-0 w-full h-14 bg-pink-200 flex items-center justify-between px-5 z-50"
    >
      <div className="text-white font-semibold text-base flex items-center gap-1.5 before:content-['✱'] before:text-xl">
        ProSlides
      </div>
      
      <div className="flex items-center">
        <ShareMenu />
      </div>
    </header>
  );
}
