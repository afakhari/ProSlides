// import React, { useState } from "react";
// import { Image, Palette, X, Upload, Trash2 } from "lucide-react";

// export default function DesignPanel({ slide, setSlide, onClose }) {
//   const [activeTab, setActiveTab] = useState("color");

//   // رنگ‌های پیش‌فرض
//   const colorOptions = [
//     { name: "White", value: "#ffffff" },
//     { name: "Light Blue", value: "#eff6ff" },
//     { name: "Light Pink", value: "#fdf2f8" },
//     { name: "Light Gray", value: "#f3f4f6" },
//     { name: "Beige", value: "#fafaf0" },
//     { name: "Mint", value: "#f0fdf4" },
//     { name: "Lavender", value: "#f5f3ff" },
//     { name: "Custom", value: "custom" },
//   ];

//   // مدیریت تغییر رنگ
//   const handleColorChange = (color) => {
//     if (color === "custom") {
//       const input = document.createElement("input");
//       input.type = "color";
//       input.value = slide.backgroundColor || "#ffffff";
//       input.onchange = (e) => {
//         setSlide({
//           ...slide,
//           backgroundColor: e.target.value,
//           backgroundImage: "",
//         });
//       };
//       input.click();
//     } else {
//       setSlide({
//         ...slide,
//         backgroundColor: color,
//         backgroundImage: "",
//       });
//     }
//   };

//   // مدیریت آپلود عکس
//   const handleImageUpload = (e) => {
//     const file = e.target.files[0];
//     if (file) {
//       const reader = new FileReader();
//       reader.onload = (event) => {
//         setSlide({
//           ...slide,
//           backgroundImage: event.target.result,
//           backgroundColor: "",
//         });
//       };
//       reader.readAsDataURL(file);
//     }
//   };

//   // حذف عکس بک‌گراند
//   const handleRemoveImage = () => {
//     setSlide({
//       ...slide,
//       backgroundImage: "",
//       backgroundColor: "#ffffff",
//     });
//   };

//   return (
//     <div className="h-full overflow-y-auto p-4">
//       {/* Header */}
//       <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
//         <div className="flex items-center gap-3">
//           <div>
//             <h3 className="font-semibold text-gray-900">Design</h3>
//           </div>
//         </div>
//         <button
//           onClick={onClose}
//           className="p-2 hover:bg-red-100 rounded-lg transition-colors"
//         >
//           <X className="w-5 h-5 text-gray-500" />
//         </button>
//       </div>

//       {/* تب‌ها */}
//       <div className="flex mb-6">
//         <button
//           onClick={() => setActiveTab("color")}
//           className={`flex-1 py-2 text-sm font-medium rounded-l-lg ${
//             activeTab === "color"
//               ? "bg-blue-50 text-blue-600 border border-blue-200"
//               : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200"
//           }`}
//         >
//           Color
//         </button>
//         <button
//           onClick={() => setActiveTab("image")}
//           className={`flex-1 py-2 text-sm font-medium rounded-r-lg ${
//             activeTab === "image"
//               ? "bg-blue-50 text-blue-600 border border-blue-200"
//               : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200"
//           }`}
//         >
//           Image
//         </button>
//       </div>

//       {/* محتوا */}
//       {activeTab === "color" ? (
//         <div className="space-y-6">
//           <div>
//             <h3 className="text-sm font-medium text-gray-700 mb-3">
//               Background Color
//             </h3>
//             <div className="grid grid-cols-4 gap-3">
//               {colorOptions.map((color) => (
//                 <button
//                   key={color.value}
//                   onClick={() => handleColorChange(color.value)}
//                   className="flex flex-col items-center"
//                 >
//                   <div
//                     className={`w-10 h-10 rounded-lg border mb-1 ${
//                       slide.backgroundColor === color.value ||
//                       (color.value === "custom" && 
//                         !colorOptions.find(c => c.value === slide.backgroundColor))
//                         ? "border-blue-500 ring-2 ring-blue-200"
//                         : "border-gray-300"
//                     }`}
//                     style={{
//                       backgroundColor: color.value === "custom" 
//                         ? "conic-gradient(from 0deg, red, yellow, lime, aqua, blue, magenta, red)" 
//                         : color.value,
//                     }}
//                   />
//                   <span className="text-xs text-gray-600">{color.name}</span>
//                 </button>
//               ))}
//             </div>
//           </div>

//           <div className="pt-4 border-t border-gray-200">
//             <h3 className="text-sm font-medium text-gray-700 mb-2">
//               Current Color
//             </h3>
//             <div className="flex items-center gap-3">
//               <div
//                 className="w-8 h-8 rounded border border-gray-300"
//                 style={{ backgroundColor: slide.backgroundColor || "#ffffff" }}
//               />
//               <span className="text-sm font-mono text-gray-700">
//                 {slide.backgroundColor || "#ffffff"}
//               </span>
//             </div>
//           </div>
//         </div>
//       ) : (
//         <div className="space-y-6">
//           <div>
//             <h3 className="text-sm font-medium text-gray-700 mb-3">
//               Upload Background Image
//             </h3>
//             <label className="block">
//               <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer">
//                 <Upload className="mx-auto text-gray-400 mb-2" size={24} />
//                 <p className="text-sm font-medium text-gray-700">Click to upload</p>
//                 <p className="text-xs text-gray-500 mt-1">PNG, JPG, WebP up to 5MB</p>
//               </div>
//               <input
//                 type="file"
//                 accept="image/*"
//                 onChange={handleImageUpload}
//                 className="hidden"
//               />
//             </label>
//           </div>

//           {slide.backgroundImage && (
//             <div>
//               <h3 className="text-sm font-medium text-gray-700 mb-3">
//                 Current Image
//               </h3>
//               <div className="relative rounded-lg overflow-hidden border border-gray-300">
//                 <img
//                   src={slide.backgroundImage}
//                   alt="Background"
//                   className="w-full h-40 object-cover"
//                 />
//                 <button
//                   onClick={handleRemoveImage}
//                   className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
//                 >
//                   <Trash2 size={16} />
//                 </button>
//               </div>
//               <button
//                 onClick={handleRemoveImage}
//                 className="w-full mt-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
//               >
//                 Remove Image
//               </button>
//             </div>
//           )}
//         </div>
//       )}

//       <div className="mt-8 pt-6 border-t border-gray-200">
//         <button
//           onClick={() => {
//             setSlide({
//               ...slide,
//               backgroundColor: "#ffffff",
//               backgroundImage: "",
//             });
//           }}
//           className="w-full py-2.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
//         >
//           Reset to Default White
//         </button>
//       </div>
//     </div>
//   );
// }




















import React, { useState, useEffect } from "react";
import { Image, Palette, X, Upload, Trash2, Save } from "lucide-react";

export default function DesignPanel({ slide, setSlide, onClose }) {
  const [activeTab, setActiveTab] = useState("color");
  const [localSlide, setLocalSlide] = useState({ ...slide });
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSlide, setOriginalSlide] = useState({ ...slide });

  // تنظیم مقادیر اولیه هنگام بارگذاری
  useEffect(() => {
    setOriginalSlide({ ...slide });
    setLocalSlide({ ...slide });
  }, [slide]);

  // تشخیص تغییرات
  useEffect(() => {
    const hasBgColorChanged = localSlide.backgroundColor !== originalSlide.backgroundColor;
    const hasBgImageChanged = localSlide.backgroundImage !== originalSlide.backgroundImage;
    
    setHasChanges(hasBgColorChanged || hasBgImageChanged);
  }, [localSlide, originalSlide]);

  // رنگ‌های پیش‌فرض
  const colorOptions = [
    { name: "White", value: "#ffffff" },
    { name: "Light Blue", value: "#eff6ff" },
    { name: "Light Pink", value: "#fdf2f8" },
    { name: "Light Gray", value: "#f3f4f6" },
    { name: "Beige", value: "#fafaf0" },
    { name: "Mint", value: "#f0fdf4" },
    { name: "Lavender", value: "#f5f3ff" },
    { name: "Custom", value: "custom" },
  ];

  // مدیریت تغییر رنگ
  const handleColorChange = (color) => {
    if (color === "custom") {
      const input = document.createElement("input");
      input.type = "color";
      input.value = localSlide.backgroundColor || "#ffffff";
      input.onchange = (e) => {
        setLocalSlide({
          ...localSlide,
          backgroundColor: e.target.value,
          backgroundImage: "",
        });
      };
      input.click();
    } else {
      setLocalSlide({
        ...localSlide,
        backgroundColor: color,
        backgroundImage: "",
      });
    }
  };

  // مدیریت آپلود عکس
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setLocalSlide({
          ...localSlide,
          backgroundImage: event.target.result,
          backgroundColor: "",
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // حذف عکس بک‌گراند
  const handleRemoveImage = () => {
    setLocalSlide({
      ...localSlide,
      backgroundImage: "",
      backgroundColor: "#ffffff",
    });
  };

  // ریست به حالت پیش‌فرض سفید
  {/*
  const handleResetToDefault = () => {
    setLocalSlide({
      ...localSlide,
      backgroundColor: "#ffffff",
      backgroundImage: "",
    });
  };
  */}

  // ذخیره تغییرات
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
        // به‌روزرسانی اسلاید با مقادیر جدید
        slidesData[slideIndex] = {
          ...slidesData[slideIndex],
          backgroundColor: localSlide.backgroundColor,
          backgroundImage: localSlide.backgroundImage
        };
        
        // ذخیره در localStorage
        localStorage.setItem("slides", JSON.stringify(slidesData));
        
        console.log("Design changes saved to localStorage");
        
        // به‌روزرسانی slide در parent component
        setSlide({
          ...slide,
          backgroundColor: localSlide.backgroundColor,
          backgroundImage: localSlide.backgroundImage
        });
        
        // به‌روزرسانی مقدار اولیه
        setOriginalSlide({ ...localSlide });
        
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

  // لغو تغییرات
  const handleCancel = () => {
    // اگر تغییراتی وجود داشته باشد، هشدار بده
    if (hasChanges) {
      const confirmCancel = window.confirm(
        "You have unsaved changes. Are you sure you want to cancel?"
      );
      if (!confirmCancel) return;
    }
    
    // برگرداندن به حالت اولیه
    setLocalSlide({ ...originalSlide });
    
    onClose();
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="font-semibold text-gray-900">Design</h3>
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

      {/* تب‌ها */}
      <div className="flex mb-6">
        <button
          onClick={() => setActiveTab("color")}
          className={`flex-1 py-2 text-sm font-medium rounded-l-lg ${
            activeTab === "color"
              ? "bg-blue-50 text-blue-600 border border-blue-200"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200"
          }`}
        >
          Color
        </button>
        <button
          onClick={() => setActiveTab("image")}
          className={`flex-1 py-2 text-sm font-medium rounded-r-lg ${
            activeTab === "image"
              ? "bg-blue-50 text-blue-600 border border-blue-200"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200"
          }`}
        >
          Image
        </button>
      </div>

      {/* محتوا */}
      {activeTab === "color" ? (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Background Color
            </h3>
            <div className="grid grid-cols-4 gap-3">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  onClick={() => handleColorChange(color.value)}
                  className="flex flex-col items-center"
                >
                  <div
                    className={`w-10 h-10 rounded-lg border mb-1 ${
                      localSlide.backgroundColor === color.value ||
                      (color.value === "custom" && 
                        !colorOptions.find(c => c.value === localSlide.backgroundColor))
                        ? "border-blue-500 ring-2 ring-blue-200"
                        : "border-gray-300"
                    }`}
                    style={{
                      backgroundColor: color.value === "custom" 
                        ? "conic-gradient(from 0deg, red, yellow, lime, aqua, blue, magenta, red)" 
                        : color.value,
                    }}
                  />
                  <span className="text-xs text-gray-600">{color.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Current Color
            </h3>
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded border border-gray-300"
                style={{ backgroundColor: localSlide.backgroundColor || "#ffffff" }}
              />
              <span className="text-sm font-mono text-gray-700">
                {localSlide.backgroundColor || "#ffffff"}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Upload Background Image
            </h3>
            <label className="block">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer">
                <Upload className="mx-auto text-gray-400 mb-2" size={24} />
                <p className="text-sm font-medium text-gray-700">Click to upload</p>
                <p className="text-xs text-gray-500 mt-1">PNG, JPG, WebP up to 5MB</p>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>

          {localSlide.backgroundImage && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Current Image
              </h3>
              <div className="relative rounded-lg overflow-hidden border border-gray-300">
                <img
                  src={localSlide.backgroundImage}
                  alt="Background"
                  className="w-full h-40 object-cover"
                />
                <button
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <button
                onClick={handleRemoveImage}
                className="w-full mt-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Remove Image
              </button>
            </div>
          )}
        </div>
      )}

      {/* دکمه Reset To Default White */}
      
      <div className="mt-8 pt-6 border-t border-gray-200">
        {/*
        <button
          onClick={handleResetToDefault}
          className="w-full py-2.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors mb-4"
        >
          Reset to Default White
        </button>
        */}
        {/* دکمه‌های Cancel و Save Changes */}
        {/*
        <div className="pt-4 border-t border-gray-200">
        */}
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 py-2.5 px-4 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!hasChanges}
              className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm ${
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
              ? "Click 'Save Changes' to store design in your browser's local storage"
              : "No changes to save"
            }
          </p>
        </div>
        {/*
      </div>
      */}
    </div>
  );
}