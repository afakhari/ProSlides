// import { useState, useRef } from "react";
// import { X, Music, Trash2, Play, Pause } from "lucide-react";

// export default function AudioPanel({ slide, setSlide, onClose }) {
//   const audioRef = useRef(null);
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [localAudio, setLocalAudio] = useState(slide?.sound || "");

//   const handleFileUpload = (event) => {
//     const file = event.target.files[0];
//     if (file) {
//       const allowedTypes = ["audio/mp3", "audio/wav", "audio/mpeg", "audio/ogg"];
//       if (!allowedTypes.includes(file.type)) {
//         alert("Please select a valid audio file (MP3, WAV, OGG)");
//         return;
//       }

//       const fileSizeInMB = file.size / (1024 * 1024);
//       if (fileSizeInMB > 10) {
//         alert("File size should be less than 10MB");
//         return;
//       }

//       const audioUrl = URL.createObjectURL(file);
//       setLocalAudio(audioUrl);
      
//       setSlide({
//         ...slide,
//         sound: audioUrl
//       });
//     }
//   };

//   const handleRemoveAudio = () => {
//     if (audioRef.current) {
//       audioRef.current.pause();
//       audioRef.current.currentTime = 0;
//       setIsPlaying(false);
//     }
    
//     if (localAudio && localAudio.startsWith("blob:")) {
//       URL.revokeObjectURL(localAudio);
//     }
    
//     setLocalAudio("");
//     setSlide({
//       ...slide,
//       sound: ""
//     });
//   };

//   const handlePlayPause = () => {
//     if (!audioRef.current) return;

//     if (isPlaying) {
//       audioRef.current.pause();
//     } else {
//       audioRef.current.play();
//     }
//     setIsPlaying(!isPlaying);
//   };

//   const handleAudioEnded = () => {
//     setIsPlaying(false);
//   };

//   return (
//     <>
//       {/* Header */}
//       <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
//         <div className="flex items-center gap-3">
//           <div>
//             <h3 className="font-semibold text-gray-900">Audio</h3>
//           </div>
//         </div>
//         <button
//           onClick={onClose}
//           className="p-2 hover:bg-red-100 rounded-lg transition-colors"
//         >
//           <X className="w-5 h-5 text-gray-500" />
//         </button>
//       </div>

//       {/* Content */}
//       <div className="space-y-6">
//         {/* Current Audio Section */}
//         <div className="space-y-4">
//           <h4 className="font-medium text-gray-900">Current Audio</h4>
          
//           {localAudio ? (
//             <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
//               <div className="flex items-center gap-3 mb-4">
//                 <div className="p-2 bg-white rounded-lg shadow-sm">
//                   <Music className="w-4 h-4 text-blue-600" />
//                 </div>
//                 <div className="flex-1">
//                   <p className="font-medium text-gray-900 text-sm">
//                     {localAudio.split("/").pop().substring(0, 30)}
//                   </p>
//                   <p className="text-xs text-gray-500 mt-1">Uploaded successfully</p>
//                 </div>
//               </div>

//               {/* Audio Player */}
//               <div className="space-y-3">
//                 <div className="flex items-center gap-2">
//                   <button
//                     onClick={handlePlayPause}
//                     className="flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
//                   >
//                     {isPlaying ? (
//                       <Pause className="w-4 h-4" />
//                     ) : (
//                       <Play className="w-4 h-4 ml-0.5" />
//                     )}
//                   </button>
//                   <div className="flex-1">
//                     <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
//                       <div className="h-full bg-blue-500 w-1/3"></div>
//                     </div>
//                   </div>
//                 </div>

//                 {/* Hidden Audio Element */}
//                 <audio
//                   ref={audioRef}
//                   src={localAudio}
//                   onEnded={handleAudioEnded}
//                 />

//                 <button
//                   onClick={handleRemoveAudio}
//                   className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
//                 >
//                   <Trash2 className="w-4 h-4" />
//                   Remove Audio
//                 </button>
//               </div>
//             </div>
//           ) : (
//             <div className="bg-gray-50 rounded-xl p-8 text-center border-2 border-dashed border-gray-200">
//               <Music className="w-12 h-12 text-gray-400 mx-auto mb-3" />
//               <p className="text-gray-600 text-sm mb-2">No audio selected</p>
//               <p className="text-gray-500 text-xs">Upload a background music for this slide</p>
//             </div>
//           )}
//         </div>

//         {/* Upload Section */}
//         <div className="space-y-4">
//           <h4 className="font-medium text-gray-900">Upload New Audio</h4>
          
//           <label className="block cursor-pointer">
//             <input
//               type="file"
//               accept="audio/*"
//               onChange={handleFileUpload}
//               className="hidden"
//             />
//             <div className="group">
//               <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-dashed border-purple-200 rounded-xl p-6 text-center transition-all hover:border-purple-300 hover:from-purple-100 hover:to-pink-100">
//                 <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center group-hover:scale-105 transition-transform">
//                   <Music className="w-8 h-8 text-white" />
//                 </div>
//                 <p className="font-medium text-gray-900 mb-1">Click to upload</p>
//                 <p className="text-sm text-gray-500 mb-3">MP3, WAV, or OGG (max 10MB)</p>
//                 <button className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors text-sm">
//                   <Music className="w-4 h-4" />
//                   Select Audio File
//                 </button>
//               </div>
//             </div>
//           </label>

//           <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
//             <h5 className="font-medium text-amber-800 text-sm mb-1">💡 Recommendation</h5>
//             <p className="text-amber-700 text-xs">
//               Use short audio clips (under 30 seconds) for better experience. Audio will loop automatically.
//             </p>
//           </div>
//         </div>
//       </div>
//     </>
//   );
// }













import { useState, useRef, useEffect } from "react";
import { X, Music, Trash2, Play, Pause, Save } from "lucide-react";

export default function AudioPanel({ slide, setSlide, onClose }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [localAudio, setLocalAudio] = useState(slide?.sound || "");
  const [hasChanges, setHasChanges] = useState(false);
  const [originalAudio, setOriginalAudio] = useState(slide?.sound || ""); // ذخیره مقدار اولیه

  // تنظیم مقدار اولیه هنگام بارگذاری کامپوننت
  useEffect(() => {
    setOriginalAudio(slide?.sound || "");
  }, [slide?.sound]);

  // تشخیص تغییرات نسبت به مقدار اولیه
  useEffect(() => {
    const hasUnsavedChanges = localAudio !== originalAudio;
    setHasChanges(hasUnsavedChanges);
  }, [localAudio, originalAudio]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const allowedTypes = ["audio/mp3", "audio/wav", "audio/mpeg", "audio/ogg"];
      if (!allowedTypes.includes(file.type)) {
        alert("Please select a valid audio file (MP3, WAV, OGG)");
        return;
      }

      const fileSizeInMB = file.size / (1024 * 1024);
      if (fileSizeInMB > 10) {
        alert("File size should be less than 10MB");
        return;
      }

      const audioUrl = URL.createObjectURL(file);
      setLocalAudio(audioUrl);
      
      // فقط وضعیت محلی را به‌روز کنید، اما slide اصلی را نه
      // setSlide({
      //   ...slide,
      //   sound: audioUrl
      // });
    }
  };

  const handleRemoveAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
    
    if (localAudio && localAudio.startsWith("blob:")) {
      URL.revokeObjectURL(localAudio);
    }
    
    setLocalAudio("");
    // setSlide({
    //   ...slide,
    //   sound: ""
    // });
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const handleSubmit = () => {
    if (!hasChanges) {
      onClose();
      return;
    }

    try {
      // دریافت اسلایدها از localStorage
      const slidesData = JSON.parse(localStorage.getItem("slides") || "[]");
      
      // پیدا کردن اندیس اسلاید فعلی
      const slideIndex = slidesData.findIndex(s => s.id === slide.id);
      
      if (slideIndex !== -1) {
        // به‌روزرسانی اسلاید با مقدار فعلی localAudio
        slidesData[slideIndex] = {
          ...slidesData[slideIndex],
          sound: localAudio
        };
        
        // ذخیره در localStorage
        localStorage.setItem("slides", JSON.stringify(slidesData));
        
        console.log("Audio changes saved to localStorage");
        
        // به‌روزرسانی slide در parent component
        setSlide({
          ...slide,
          sound: localAudio
        });
        
        // به‌روزرسانی مقدار اولیه
        setOriginalAudio(localAudio);
        
        // بستن پنل
        onClose();
      } else {
        alert("Slide not found in localStorage");
      }
    } catch (error) {
      console.error("Error saving to localStorage:", error);
      alert("Failed to save changes");
    }
  };

  const handleCancel = () => {
    // اگر تغییراتی وجود داشته باشد، هشدار بده
    if (hasChanges) {
      const confirmCancel = window.confirm(
        "You have unsaved changes. Are you sure you want to cancel?"
      );
      if (!confirmCancel) return;
    }
    
    // رها کردن URLهای blob اگر تغییر داده شده بود
    if (localAudio && localAudio.startsWith("blob:") && localAudio !== originalAudio) {
      URL.revokeObjectURL(localAudio);
    }
    
    // برگرداندن به حالت اولیه
    setLocalAudio(originalAudio);
    
    onClose();
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="font-semibold text-gray-900">Audio</h3>
            {hasChanges && (
              <p className="text-xs text-amber-600 mt-1">
                You have unsaved changes
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleCancel}
          className="p-2 hover:bg-red-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {/* Current Audio Section */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Current Audio</h4>
          
          {localAudio ? (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <Music className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">
                    {localAudio.startsWith("blob:") 
                      ? "Uploaded audio file" 
                      : localAudio.split("/").pop().substring(0, 30)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {hasChanges ? "Unsaved changes" : "Saved"}
                  </p>
                </div>
              </div>

              {/* Audio Player */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePlayPause}
                    className="flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4 ml-0.5" />
                    )}
                  </button>
                  <div className="flex-1">
                    <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 w-1/3"></div>
                    </div>
                  </div>
                </div>

                {/* Hidden Audio Element */}
                <audio
                  ref={audioRef}
                  src={localAudio}
                  onEnded={handleAudioEnded}
                />

                <button
                  onClick={handleRemoveAudio}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove Audio
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-8 text-center border-2 border-dashed border-gray-200">
              <Music className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 text-sm mb-2">No audio selected</p>
              <p className="text-gray-500 text-xs">Upload a background music for this slide</p>
            </div>
          )}
        </div>

        {/* Upload Section */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Upload New Audio</h4>
          
          <label className="block cursor-pointer">
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="group">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-dashed border-purple-200 rounded-xl p-6 text-center transition-all hover:border-purple-300 hover:from-purple-100 hover:to-pink-100">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Music className="w-8 h-8 text-white" />
                </div>
                <p className="font-medium text-gray-900 mb-1">Click to upload</p>
                <p className="text-sm text-gray-500 mb-3">MP3, WAV, or OGG (max 10MB)</p>
                <button className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors text-sm">
                  <Music className="w-4 h-4" />
                  Select Audio File
                </button>
              </div>
            </div>
          </label>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h5 className="font-medium text-amber-800 text-sm mb-1">💡 Recommendation</h5>
            <p className="text-amber-700 text-xs">
              Use short audio clips (under 30 seconds) for better experience. Audio will loop automatically.
            </p>
          </div>
        </div>

        {/* Submit Button Section */}
        <div className="pt-6 border-t border-gray-100">
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!hasChanges}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                hasChanges
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
          <p className="text-xs text-gray-500 text-center mt-3">
            {hasChanges 
              ? "Click 'Save Changes' to store audio in your browser's local storage"
              : "No changes to save"
            }
          </p>
        </div>
      </div>
    </>
  );
}