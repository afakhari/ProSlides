import React, { useState, useEffect } from "react";
// Source data for lobby and players
const User_adding = {
  type: 13,
  Users: [
    // { user_id: 1, name: "ali", character: "@" },
    // { user_id: 2, name: "ahmad", character: "😊" },
    // { user_id: 4, name: "mike", character: "⭐" },
    // { user_id: 5, name: "mike", character: "⭐" },
    // { user_id: 6, name: "mike", character: "⭐" },
    // { user_id: 7, name: "mike", character: "⭐" },
    // { user_id: 8, name: "mike", character: "⭐" },
    // { user_id: 9, name: "mike", character: "😁" },
    // { user_id: 10, name: "mike", character: "⭐" },
    // { user_id: 11, name: "mike", character: "⭐" },
    // { user_id: 12, name: "mike", character: "⭐" },
    // { user_id: 13, name: "mike", character: "💕" },
    // { user_id: 14, name: "mike", character: "⭐" },
    // { user_id: 15, name: "mike", character: "⭐" },
    // { user_id: 16, name: "mike", character: "⭐" },
    // { user_id: 17, name: "mike", character: "⭐" },
  ],
};

// Calculate players ready based on the User_adding.type
function calculatePlayersReady({ type, Users }) {
  // Extendable rule-set; for now, type 1 => count all users
  switch (type) {
    case 1:
    default:
      return Users?.length ?? 0;
  }
}

export default function JoinPage2() {
  const [page, setPage] = useState("lobby"); // 'lobby' | 'quiz'
  const [newUserId, setNewUserId] = useState(null);
  const [previousUserCount, setPreviousUserCount] = useState(
    User_adding.Users.length
  );
  const [layoutType, setLayoutType] = useState("circle"); // 'circle', 'diagonalCircle', 'triangle', 'scatter'
  const [centerOffset, setCenterOffset] = useState({ x: 0, y: 0 });
  const [hiddenUsers, setHiddenUsers] = useState(new Set()); // Track which users have been clicked
  const [showQRModal, setShowQRModal] = useState(false); // State for QR modal
  const [isMuted, setIsMuted] = useState(true); // State for sound
  const [copiedLink, setCopiedLink] = useState(false); // State for copy feedback
  const playersReady = calculatePlayersReady(User_adding);

  // Game code (you can make this dynamic)
  const gameCode = "ZH4NJ";
  const joinUrl = `ahaslides.com/${gameCode}`;

  // Function to copy link to clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(`https://${joinUrl}`).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  // List of 10 vibrant colors for user names
  const colorList = [
    "#FF6B6B", // Red
    "#4ECDC4", // Teal
    "#45B7D1", // Blue
    "#FFA07A", // Light Salmon
    "#98D8C8", // Mint
    "#F7DC6F", // Yellow
    "#BB8FCE", // Purple
    "#85C1E2", // Sky Blue
    "#F8B739", // Orange
    "#EC7063", // Coral
  ];

  // Function to get color for a user based on their user_id
  const getUserColor = (userId) => {
    // Use user_id to deterministically assign a color
    const colorIndex = userId % colorList.length;
    return colorList[colorIndex];
  };

  // Function to handle user name click
  const handleUserClick = (userId) => {
    setHiddenUsers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId); // Toggle: if already hidden, show it again
      } else {
        newSet.add(userId); // Hide the name
      }
      return newSet;
    });
  };

  // Function to format user display name
  const formatUserName = (user) => {
    if (hiddenUsers.has(user.user_id)) {
      // Show character + *****
      return user.character + "*****";
    }
    return user.character + user.name;
  };

  // Calculate position based on layout type
  const getPosition = (index, total, type, offset) => {
    let baseX = 0,
      baseY = 0;

    if (type === "circle") {
      // Arrange in a circle
      const radius = 120;
      const angle = (index * 2 * Math.PI) / total;
      baseX = Math.cos(angle) * radius;
      baseY = Math.sin(angle) * radius;
    } else if (type === "diagonalCircle") {
      // Arrange in a diagonal circle (ellipse rotated)
      const radiusX = 150;
      const radiusY = 80;
      const angle = (index * 2 * Math.PI) / total;
      const x = Math.cos(angle) * radiusX;
      const y = Math.sin(angle) * radiusY;
      // Rotate 45 degrees
      const rotAngle = Math.PI / 4;
      baseX = x * Math.cos(rotAngle) - y * Math.sin(rotAngle);
      baseY = x * Math.sin(rotAngle) + y * Math.cos(rotAngle);
    } else if (type === "scatter") {
      // Scatter randomly across the entire main section
      const seed = index * 2654435761; // Pseudo-random based on index
      const pseudoRandomX = ((seed % 1000) / 1000) * 2 - 1;
      const pseudoRandomY = (((seed * 7) % 1000) / 1000) * 2 - 1;
      // Spread across a much larger area (full width and height of main section)
      baseX = pseudoRandomX * 400; // Spread horizontally across ~800px
      baseY = pseudoRandomY * 150; // Spread vertically across ~300px
    }

    return {
      x: baseX + offset.x,
      y: baseY + offset.y,
    };
  };

  // Detect when a new user is added
  useEffect(() => {
    const currentUserCount = User_adding.Users.length;

    if (currentUserCount > previousUserCount) {
      // Get the newly added user (last in the array)
      const newUser = User_adding.Users[currentUserCount - 1];
      setNewUserId(newUser.user_id);

      // If more than 6 users, force scatter layout
      if (currentUserCount > 6) {
        setLayoutType("scatter");
      } else {
        // Cycle through layout types: circle -> diagonalCircle -> triangle -> scatter
        setLayoutType((prev) => {
          if (prev === "circle") return "diagonalCircle";
          if (prev === "diagonalCircle") return "scatter";

          return "circle";
        });
      }

      // Change center position to different points
      const positions = [
        { x: 0, y: 0 }, // center
        { x: -100, y: -50 }, // top-left
        { x: 100, y: 50 }, // bottom-right
        { x: -100, y: 50 }, // bottom-left
        { x: 100, y: -50 }, // top-right
        { x: 0, y: -60 }, // top-center
        { x: 0, y: 60 }, // bottom-center
      ];
      const randomPos = positions[Math.floor(Math.random() * positions.length)];
      setCenterOffset(randomPos);

      // Remove highlight after 3 seconds
      const timer = setTimeout(() => {
        setNewUserId(null);
      }, 2000);

      return () => clearTimeout(timer);
    }

    setPreviousUserCount(currentUserCount);
  }, [User_adding.Users.length, previousUserCount]);

  return (
    <div className="bg-[#f8a8c3] min-h-screen">
      <div
        className={`w-full pt-16! sm:pt-36 md:pt-40 pb-24 px-4 sm:px-3 flex ${
          showQRModal ? "justify-end" : "justify-center"
        } transition-all duration-300`}
      >
        {/* Top bar */}
        <div
          className={`fixed ${
            showQRModal ? "left-[20%] right-0" : "left-0 right-0"
          } top-0 h-14 bg-pink-200 flex items-center justify-between px-5 z-50 transition-all duration-300`}
        >
          <div className="flex items-center gap-2">
            <button
              className="w-9 h-9 bg-black/15  pb-1 rounded-full flex items-center justify-center text-white cursor-pointer border-none text-base hover:bg-black/25 transition-colors"
              aria-label="Back"
            >
              ←
            </button>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="w-9 h-9 bg-black/15 rounded-full flex items-center justify-center text-white cursor-pointer border-none text-base hover:bg-black/25 transition-colors"
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? "🔇" : "🔊"}
            </button>
          </div>

          {/* Center section with link and QR */}
          <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2">
            <div className="text-white font-medium text-[25px] flex items-center gap-2 whitespace-nowrap">
              To join, go to:{" "}
              <strong
                onClick={copyToClipboard}
                className="cursor-pointer hover:text-blue-200 transition-colors relative"
                title="Click to copy"
              >
                ahaslides.com/{gameCode}
                {copiedLink && (
                  <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-green-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                    Copied!
                  </div>
                )}
              </strong>
            </div>
            <button
              onClick={() => setShowQRModal(!showQRModal)}
              className="w-7 h-7 bg-white/90 rounded flex items-center justify-center cursor-pointer border-none hover:bg-white transition-colors p-0.5"
              aria-label={showQRModal ? "Close QR Code" : "Show QR Code"}
            >
              {showQRModal ? (
                <span className="text-gray-700 text-2xl font-bold leading-none">
                  ✖️
                </span>
              ) : (
                <img
                  src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxyZWN0IHdpZHRoPSI1IiBoZWlnaHQ9IjUiIHg9IjMiIHk9IjMiIHJ4PSIxIi8+PHJlY3Qgd2lkdGg9IjUiIGhlaWdodD0iNSIgeD0iMTYiIHk9IjMiIHJ4PSIxIi8+PHJlY3Qgd2lkdGg9IjUiIGhlaWdodD0iNSIgeD0iMyIgeT0iMTYiIHJ4PSIxIi8+PHBhdGggZD0iTTIxIDEzdjN2M3YzIi8+PHBhdGggZD0iTTE4IDIxaDNoMyIvPjxwYXRoIGQ9Ik0xMyAyMUgxMyIvPjxwYXRoIGQ9Ik0xMyAxOEgxMyIvPjxwYXRoIGQ9Ik0xMyAxNkgxMyIvPjxwYXRoIGQ9Ik0xMyAxM0gxMyIvPjxwYXRoIGQ9Ik0yMSAyMVYyMSIvPjwvc3ZnPg=="
                  alt="QR Code"
                  className="w-full h-full"
                />
              )}
            </button>
          </div>

          <div className="text-white font-semibold text-base flex items-center gap-1.5 before:content-['✱'] before:text-xl">
            ProSlides
          </div>
        </div>

        {/* Main stage */}
        <main
          className={`${
            showQRModal ? "w-[78%] mr-4" : "w-[88%]"
          } max-w-[2000px] bg-gray-800 rounded-2xl lg:rounded-2xl md:rounded-xl sm:rounded-xl pt-4! pb-20! md:pt-8 md:pb-12 lg:pb-18 px-4 sm:px-4 md:px-16 lg:px-72! text-white shadow-2xl relative transition-all duration-300`}
        >
          <div className="flex flex-col items-center gap-1.5">
            <div className="text-xl md:text-2xl lg:text-3xl font-semibold">
              {page === "lobby" ? "Quiz question 1 of 3" : "Quiz"}
            </div>
            <div className="text-xs md:text-sm text-white/60">
              {playersReady} players ready
            </div>
          </div>

          <div className="min-h-[270px] max-h-[500px] flex items-center justify-center">
            {page === "lobby" ? (
              <div>
                {User_adding.Users.length === 0 && (
                  <div
                    className="text-xl md:text-2xl lg:text-3xl text-white/92 text-center animate-custom-pulse"
                    style={{
                      marginTop: "190px",
                      marginBottom: "190px",
                    }}
                  >
                    <div>Waiting for players to join...</div>
                  </div>
                )}
                {User_adding.Users.length > 0 && (
                  <div className="relative w-full min-h-[500px] flex justify-center items-center overflow-visible">
                    {User_adding.Users.map((user, index) => {
                      const isNewUser = user.user_id === newUserId;
                      const position = getPosition(
                        index,
                        User_adding.Users.length,
                        layoutType,
                        centerOffset
                      );
                      const userColor = getUserColor(user.user_id);
                      const isHidden = hiddenUsers.has(user.user_id);

                      return (
                        <div
                          key={user.user_id}
                          className={`absolute flex flex-col items-center gap-2 min-w-[120px] transition-all duration-1000 ease-out cursor-pointer ${
                            isNewUser ? "z-10 opacity-100" : "z-1 opacity-90"
                          }`}
                          style={{
                            transform: `
                            translate(${position.x}px, ${position.y}px)
                            scale(${isNewUser ? 1.3 : 1})
                            rotate(${isNewUser ? "5deg" : "0deg"})
                          `,
                            filter: isNewUser
                              ? "brightness(1.4)"
                              : "brightness(1)",
                            animation: isNewUser
                              ? "fadeInSlide 0.6s ease-out"
                              : "none",
                          }}
                        >
                          <div
                            onClick={() => handleUserClick(user.user_id)}
                            className={`text-2xl text-center transition-all duration-500 ease-out ${
                              isNewUser
                                ? "font-bold text-green-500"
                                : "font-medium"
                            } ${
                              isHidden ? "scale-85 opacity-80" : "scale-100"
                            }`}
                            style={{
                              color: isNewUser ? "#4CAF50" : userColor,
                              textShadow: isNewUser
                                ? "0 0 20px rgba(76, 175, 80, 0.8), 0 0 10px rgba(76, 175, 80, 0.5)"
                                : `0 0 10px ${userColor}80`,
                              letterSpacing: isHidden ? "4px" : "normal",
                            }}
                          >
                            {formatUserName(user)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex justify-center">
                  <button
                    className="inline-flex items-center gap-1.5 bg-gradient-to-br from-purple-800 to-purple-600 text-white px-8! py-3! rounded-lg border-none cursor-pointer font-semibold text-base shadow-lg shadow-purple-600/40 transition-all duration-150 hover:-translate-y-1 hover:scale-110 hover:shadow-xl hover:shadow-purple-600/50 after:content-['⏵'] after:text-sm after:ml-1"
                    onClick={() => setPage("quiz")}
                  >
                    Start
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-3xl opacity-95">
                  Quiz page (coming soon)
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Footer left stats */}
        <div
          className={`fixed ${
            showQRModal ? "left-[calc(20%+1.75rem)]" : "left-7"
          } bottom-4 flex items-center gap-2.5 transition-all duration-300 z-50`}
        >
          <div className="bg-black/25 px-3.5! py-2.5! rounded-full text-white text-sm font-medium flex items-center gap-1.5">
            5
          </div>
          <div className="bg-black/25 px-3.5! py-2.5! rounded-full text-white text-sm font-medium flex items-center gap-1.5">
            {playersReady}/50
          </div>
        </div>

        {/* QR Code Sidebar */}
        {showQRModal && (
          <div className="fixed left-0 top-0 bottom-0 w-[20%] bg-gray-700 flex flex-col items-center justify-center gap-6 p-8 z-40 shadow-2xl">
            <button
              onClick={() => setShowQRModal(false)}
              className=" absolute top-2.5 right-4 w-9 h-9 pb-1 bg-gray-600 hover:bg-gray-500 rounded-full text-white text-2xl flex items-center justify-center border-none cursor-pointer transition-colors"
              aria-label="Close"
            >
              ×
            </button>
            <div className="bg-white p-4 rounded-lg">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                  "https://" + joinUrl
                )}`}
                alt="QR Code"
                className="w-[200px] h-[200px]"
              />
            </div>
            <div className="text-white text-center">
              <div className="text-lg font-semibold mb-2">Join at:</div>
              <div
                onClick={copyToClipboard}
                className="text-2xl font-bold break-words cursor-pointer hover:text-blue-300 transition-colors relative"
                title="Click to copy"
              >
                {joinUrl}
                {copiedLink && (
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-green-500 text-white text-sm px-3 py-1 rounded whitespace-nowrap">
                    Copied!
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
