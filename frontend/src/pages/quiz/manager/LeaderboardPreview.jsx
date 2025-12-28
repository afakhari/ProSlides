import React from "react";

export default function LeaderboardPreview({ slide, isFullSize = true }) {
  if (!slide) {
    return <div className="w-full h-full flex items-center justify-center text-gray-400">No leaderboard data</div>;
  }

  const dynamicStyle = {
    backgroundColor: slide.backgroundColor || "#ffffff",
    backgroundImage: slide.backgroundImage ? `url(${slide.backgroundImage})` : "none",
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

  const containerClasses = isFullSize
    ? "aspect-[3/2] w-full max-w-[80%] h-auto max-h-[80%] rounded-xl p-4 shadow-lg"
    : "aspect-[3/2] w-full max-w-[95%] h-auto max-h-[95%] rounded-xl p-3 shadow-md";
  
  console.log("LeaderboardPreview rendering with slide:", slide);

  return (
    <div
      className={`flex flex-col items-center justify-center font-sans ${containerClasses}`}
      style={dynamicStyle}
    >
      <div className="flex flex-col items-center justify-center w-full h-full px-4">
        {/* Title Section */}
        <div className="flex flex-col items-center justify-center mb-6 mt-30">
          <h1 className="text-4xl font-bold text-center text-gray-800 mb-2">
            {slide.leaderboard_title || "Leaderboard"}
          </h1>
          <div className="text-center text-gray-400 text-sm">
            0 players
          </div>
        </div>

        <div className="flex flex-col items-center justify-center flex-1">
          <h2 className="text-2xl font-bold text-gray-800 mb-3 -mt-20">No result yet</h2>
          <p className="text-gray-600 text-center max-w-md">
            The top Quiz players will be displayed here when there are results.
          </p>
        </div>
      </div>
    </div>
  );
}