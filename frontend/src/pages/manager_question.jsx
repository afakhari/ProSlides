import { useState, useEffect } from "react";
// import { useLocation, useNavigate } from "react-router-dom";

export default function PollPage() {
  const options = ["Option A", "Option B", "Option C", "Option D"];
  const correctIndex = 1;
  // const resultPercentages = [10, 50, 30, 10];

  const [selected, setSelected] = useState(null);
  const [voted, setVoted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [timer, setTimer] = useState(5);
  const [votes, setVotes] = useState([12, 8, 5, 3]);
  // const navigate = useNavigate();

  // تایمر 5 ثانیه‌ای
  useEffect(() => {
    if (showResults) return;
    const interval = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(interval);
          setShowResults(true); // پایان تایمر → نمایش نتایج
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showResults]);

  // const handleVote = (index) => {
  //   if (voted) return;
  //   setSelected(index);
  //   setVoted(true);
  // };

  return (
    <div className="min-h-screen flex flex-col justify-around items-center bg-pink-100 font-sans ">
      <h1 className="text-6xl font-bold text-pink-700 mb-10 mt-12">
        Quiz Question{" "}
      </h1>

      {/* تایمر */}
      {!showResults && (
        <div className="absolute inset-0 flex items-center justify-center text-8xl font-bold text-pink-700">
          {timer}
        </div>
      )}
      {/* absolute inset-0 flex items-center justify-center */}
      {/* نمودار */}
      <div className="flex justify-around items-end w-full h-[700px] mb-10 px-4">
        {options.map((opt, index) => {
          const isCorrect = index === correctIndex;
          const isSelected = index === selected;
          const totalVotes = Math.max(...votes);
          const height = showResults ? (votes[index] / totalVotes) * 100 : 0;
          // const height = showResults ? resultPercentages[index] : 0; // قبل از پایان تایمر ستون‌ها صفر هستن

          return (
            <div
              key={index}
              className="flex flex-col items-center justify-end w-1/5 h-full"
            >
              {showResults && (
                <div className="mb-2 text-center text-4xl text-gray-700 font-semibold">
                  {votes[index]}
                </div>
              )}
              <div
                className={`w-3/4 rounded-t-lg transition-all duration-1000
                  ${isCorrect ? "bg-green-500" : "bg-pink-600"}
                  ${isSelected && !isCorrect ? "ring-2 ring-pink-800" : ""}`}
                style={{ height: `${height}%` }}
              ></div>
              <p className="mt-5 text-neutral-700 text-3xl font-semibold text-center">
                {opt}
              </p>
            </div>
          );
        })}
      </div>

      {/* دکمه‌های رأی دادن */}
      {/* {!voted && !showResults && (
        <div className="flex flex-wrap justify-center gap-4">
          {options.map((opt, index) => (
            <button
              key={index}
              onClick={() => handleVote(index)}
              className="bg-pink-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-pink-600 transition shadow-md"
            >
              {opt}
            </button>
          ))}
        </div>
      )} */}

      {voted && !showResults && (
        <p className="mt-6 text-pink-700 font-medium">
          You voted for <b>{options[selected]}</b>
        </p>
      )}
    </div>
  );
}
