import React from "react";
export default function LeaderboardPreview({ slide, quizBackground, quizBackgroundImage, isFullSize = true }) {
  console.log("=== LEADERBOARD PREVIEW ===");
  console.log("Received slide:", {
    id: slide?.question_id,
    type: slide?.slide_type,
    hasLeaderboard: slide?.leaderboard && Array.isArray(slide.leaderboard),
    leaderboardLength: slide?.leaderboard?.length || 0,
    leaderboardData: slide?.leaderboard || []
  });
  const dynamicStyle = {
    backgroundColor: quizBackground || "#ffffff",
    backgroundImage: quizBackgroundImage ? `url(${quizBackgroundImage})` : "none",
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

  const containerClasses = isFullSize
    ? "aspect-[3/2] w-full max-w-[80%] h-auto max-h-[80%] rounded-xl p-4 shadow-lg"
    : "aspect-[3/2] w-full max-w-[95%] h-auto max-h-[95%] rounded-xl p-3 shadow-md";
  
  // تعداد players رو محاسبه کن
  const playerCount = slide.leaderboard && Array.isArray(slide.leaderboard) 
    ? slide.leaderboard.length 
    : 0;

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
            {playerCount} {playerCount === 1 ? 'player' : 'players'}
          </div>
        </div>

        <div className="flex flex-col items-center justify-center flex-1">
          {slide.leaderboard && slide.leaderboard.length > 0 ? (
            <div className="w-full max-w-md space-y-3">
              {slide.leaderboard
                .sort((a, b) => (a.rank || 0) - (b.rank || 0))
                .slice(0, 5)
                .map((player, index) => (
                  <div
                    key={player.rust_session_id || `player-${index}`}
                    className="flex items-center justify-between bg-white/80 rounded-lg px-4 py-2 shadow"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-lg text-gray-700">
                        #{player.rank || index + 1}
                      </span>
                      <span className="text-lg">
                        {player.avatar || "🙂"}
                      </span>
                      <span className="font-medium text-gray-800">
                        {player.player_name || `Player ${index + 1}`}
                      </span>
                    </div>

                    <span className="font-bold text-gray-900">
                      {player.score || 0}
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-gray-800 mb-3 -mt-20">
                No result yet
              </h2>
              <p className="text-gray-600 text-center max-w-md">
                The top Quiz players will be displayed here when there are results.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}