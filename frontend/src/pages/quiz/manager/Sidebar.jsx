// import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
// import { useCallback, useEffect } from "react";
// import {
//   GripVertical,
//   Trash2,
//   CheckCircle2,
//   Circle,
//   Image as ImageIcon,
//   X,
//   Plus,
// } from "lucide-react";

// export default function Sidebar({ slide, setSlide, onCreateLeaderboardSlide, onDeleteLeaderboardSlide, slides, onClose }) {
//   // اگر slide یا slide.options undefined باشد، مقادیر پیش‌فرض تعیین می‌کنیم
//   const safeSlide = slide || {};
//   const options = safeSlide.options || [];
//   const questionType = safeSlide.question_type || "";

//   // تغییر متن سوال
//   const handleQuestionChange = (value) => {
//     setSlide({ ...safeSlide, question_text: value });
//   };

//   const handleAddOption = () => {
//     const newId =
//       options.length > 0
//         ? Math.max(
//             ...options.map((o) =>
//               isNaN(parseInt(o.option_id)) ? 0 : parseInt(o.option_id)
//             )
//           ) + 1
//         : 1;

//     const newOption = {
//       option_id: newId,
//       option_text: `Option ${newId}`,
//       answer: options.length === 0 && questionType === "multiple", // اگر اولین گزینه در multiple باشد، تیک می‌خورد
//       image: "",
//     };

//     setSlide({
//       ...safeSlide,
//       options: [...options, newOption],
//     });
//   };

//   // حذف گزینه
//   const handleDeleteOption = (id) => {
//     const remainingOptions = options.filter((opt) => opt.option_id !== id);
//     const hasCorrectAnswer = remainingOptions.some(opt => opt.answer);
    
//     // اگر هیچ گزینه صحیحی باقی نمانده و سوال multiple است، اولین گزینه را به صورت خودکار صحیح می‌کنیم
//     if (!hasCorrectAnswer && questionType === "multiple" && remainingOptions.length > 0) {
//       const updatedOptions = remainingOptions.map((opt, index) => 
//         index === 0 ? { ...opt, answer: true } : opt
//       );
      
//       setSlide({
//         ...safeSlide,
//         options: updatedOptions,
//       });
//     } else {
//       setSlide({
//         ...safeSlide,
//         options: remainingOptions,
//       });
//     }
//   };

//   // تغییر مقدار گزینه (متن، درست/نادرست یا عکس)
//   const handleOptionChange = (id, field, value) => {
//     setSlide({
//       ...safeSlide,
//       options: options.map((opt) =>
//         opt.option_id === id ? { ...opt, [field]: value } : opt
//       ),
//     });
//   };

//   // انتخاب گزینه درست (براساس نوع سوال)
//   const handleSelectCorrect = (id) => {
//     if (questionType === "single") {
//       // برای Single Choice: فقط یک گزینه می‌تواند درست باشد
//       setSlide({
//         ...safeSlide,
//         options: options.map((opt) => ({
//           ...opt,
//           answer: opt.option_id === id,
//         })),
//       });
//     } else if (questionType === "multiple") {
//       // برای Multiple Choice: می‌توان چند گزینه را انتخاب کرد
//       const currentOptions = options;
//       const clickedOption = currentOptions.find(opt => opt.option_id === id);
//       const isCurrentlyCorrect = clickedOption.answer;
//       const correctOptionsCount = currentOptions.filter(opt => opt.answer).length;
      
//       // اگر کاربر می‌خواهد آخرین گزینه صحیح را غیرفعال کند، اجازه نمی‌دهیم
//       if (isCurrentlyCorrect && correctOptionsCount === 1) {
//         return; // حداقل یک گزینه باید صحیح باشد
//       }
      
//       setSlide({
//         ...safeSlide,
//         options: currentOptions.map((opt) =>
//           opt.option_id === id ? { ...opt, answer: !opt.answer } : opt
//         ),
//       });
//     }
//   };

//   // جابه‌جایی گزینه‌ها
//   const onDragEnd = useCallback(
//     (result) => {
//       if (!result.destination) return;
//       const newOptions = Array.from(options);
//       const [moved] = newOptions.splice(result.source.index, 1);
//       newOptions.splice(result.destination.index, 0, moved);
//       setSlide({ ...safeSlide, options: newOptions });
//     },
//     [safeSlide, setSlide, options]
//   );

//   // آپلود تصویر برای سوال یا گزینه
//   const handleImageUpload = (e, type, id = null) => {
//     const file = e.target.files[0];
//     if (!file) return;
//     const reader = new FileReader();
//     reader.onloadend = () => {
//       if (type === "question") {
//         setSlide({ ...safeSlide, question_image: reader.result });
//       } else if (type === "option") {
//         handleOptionChange(id, "image", reader.result);
//       }
//     };
//     reader.readAsDataURL(file);
//   };

//   // حذف تصویر
//   const handleRemoveImage = (type, id = null) => {
//     if (type === "question") {
//       setSlide({ ...safeSlide, question_image: "" });
//     } else if (type === "option") {
//       handleOptionChange(id, "image", "");
//     }
//   };<div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
//         <div className="flex items-center gap-3">
//           <div>
//             <h3 className="font-semibold text-gray-900">Design</h3>
//             <p className="text-sm text-gray-500">Customize slides background</p>
//           </div>
//         </div>
//         <button
//           onClick={onClose}
//           className="p-2 hover:bg-red-100 rounded-lg transition-colors"
//         >
//           <X className="w-5 h-5 text-gray-500" />
//         </button>
//       </div>

//   // بررسی وجود اسلاید لیدربرد مرتبط
//   const hasLinkedLeaderboard = slides.some(
//     s => s.slide_type === 2 && s.linked_question_id === safeSlide.question_id
//   );

//   // Effect برای اطمینان از اینکه حداقل یک گزینه صحیح در سوالات multiple وجود دارد
//   useEffect(() => {
//     if (questionType === "multiple" && options.length > 0) {
//       const hasCorrectAnswer = options.some(opt => opt.answer);
//       if (!hasCorrectAnswer) {
//         // اولین گزینه را به صورت خودکار صحیح می‌کنیم
//         const updatedOptions = options.map((opt, index) => 
//           index === 0 ? { ...opt, answer: true } : opt
//         );
        
//         setSlide({
//           ...safeSlide,
//           options: updatedOptions,
//         });
//       }
//     }
//   }, [questionType, options.length, safeSlide, setSlide]);

//   // اگر slide وجود ندارد، کامپوننت را رندر نکن
//   if (!slide) {
//     return <div className="space-y-6 p-4">No slide selected</div>;
//   }

//   return (
//     <div className="h-full overflow-y-auto p-4">
//       {/* هدر */}
//       <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
//         <div className="flex items-center gap-3">
//           <div>
//             <h3 className="font-semibold text-gray-900">Slide Settings</h3>
//           </div>
//         </div>
//         <button
//           onClick={onClose}
//           className="p-2 hover:bg-red-100 rounded-lg transition-colors"
//         >
//           <X className="w-5 h-5 text-gray-500" />
//         </button>
//       </div>
//       {/* Question Slides Content */}
//       {safeSlide.slide_type === 1 && (
//         <div className="space-y-6">
//           {/* Question Text */}
//           <div>
//             <h3 className="text-sm font-medium text-gray-700 mb-3">Question Text</h3>
//             <div className="flex items-center gap-2">
//               <input
//                 type="text"
//                 value={safeSlide.question_text || ""}
//                 onChange={(e) => handleQuestionChange(e.target.value)}
//                 className="flex-1 border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
//                 placeholder="Enter your question here..."
//               />
//               <div className="flex items-center gap-1">
//                 <label className="p-2 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors border border-gray-200 flex items-center justify-center">
//                   <ImageIcon className="w-4 h-4 text-gray-600" />
//                   <input
//                     type="file"
//                     accept="image/*"
//                     className="hidden"
//                     onChange={(e) => handleImageUpload(e, "question")}
//                   />
//                 </label>
//                 {safeSlide.question_image && (
//                   <div className="relative">
//                     <img
//                       src={safeSlide.question_image}
//                       alt="Question"
//                       className="w-10 h-10 object-cover rounded-md border border-gray-300"
//                     />
//                     <button
//                       onClick={() => handleRemoveImage("question")}
//                       className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 text-red-500 hover:bg-red-50 transition-colors shadow-sm border border-gray-200"
//                     >
//                       <X className="w-3 h-3" />
//                     </button>
//                   </div>
//                 )}
//               </div>
//             </div>
//           </div>

//           <div>
//           <div className="flex items-center justify-between mb-3">
//             <h3 className="text-sm font-medium text-gray-700">Options</h3>
//             {questionType && (
//               <div className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">
//                 {questionType === "single"
//                   ? "Single Choice"
//                   : "Multiple Choice"}
//               </div>
//             )}
//           </div>

//           <p className="text-xs text-gray-500 mb-3">
//             {questionType === "single"
//               ? "Select only one correct option"
//               : "Select one or more correct options"}
//           </p>

//           <DragDropContext onDragEnd={onDragEnd}>
//             <Droppable droppableId="options">
//               {(provided) => (
//                 <div {...provided.droppableProps} ref={provided.innerRef}>
//                   {options.map((opt, index) => (
//                     <Draggable
//                       key={opt.option_id}
//                       draggableId={opt.option_id.toString()}
//                       index={index}
//                     >
//                       {(provided) => (
//                         <div
//                           ref={provided.innerRef}
//                           {...provided.draggableProps}
//                           className="flex items-start gap-2 mb-2 border border-gray-200 rounded-lg p-2 bg-white hover:border-gray-300 transition-colors"
//                         >
//                           {/* Drag */}
//                           <div
//                             {...provided.dragHandleProps}
//                             className="p-2 bg-gray-100 rounded-lg cursor-grab hover:bg-gray-200 transition-colors border border-gray-200"
//                             title="Drag to reorder"
//                           >
//                             <GripVertical className="w-4 h-4 text-gray-600" />
//                           </div>

//                           {/* Correct */}
//                           <button
//                             onClick={() => handleSelectCorrect(opt.option_id)}
//                             className={`p-2 rounded-lg border transition-colors ${
//                               opt.answer
//                                 ? "bg-green-100 border-green-200 text-green-600 hover:bg-green-200"
//                                 : "bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200"
//                             }`}
//                             title="Mark as correct"
//                           >
//                             {opt.answer ? (
//                               <CheckCircle2 className="w-4 h-4" />
//                             ) : (
//                               <Circle className="w-4 h-4" />
//                             )}
//                           </button>

//                           {/* Text & Image */}
//                           <div className="flex-1 flex flex-col gap-1">
//                             <input
//                               type="text"
//                               value={opt.option_text}
//                               onChange={(e) =>
//                                 handleOptionChange(
//                                   opt.option_id,
//                                   "option_text",
//                                   e.target.value
//                                 )
//                               }
//                               className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
//                               placeholder="Option text..."
//                             />

//                             {opt.image && (
//                               <div className="relative mt-1 w-fit">
//                                 <img
//                                   src={opt.image}
//                                   alt="Option"
//                                   className="w-16 h-16 object-cover rounded-lg border border-gray-300"
//                                 />
//                                 <button
//                                   onClick={() =>
//                                     handleRemoveImage("option", opt.option_id)
//                                   }
//                                   className="absolute -top-2 -right-2 bg-white rounded-full p-1 text-red-500 hover:bg-red-50 transition-colors shadow-sm border border-gray-200"
//                                 >
//                                   <X className="w-3 h-3" />
//                                 </button>
//                               </div>
//                             )}
//                           </div>

//                           {/* Upload */}
//                           <label className="p-2 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors border border-gray-200">
//                             <ImageIcon className="w-4 h-4 text-gray-600" />
//                             <input
//                               type="file"
//                               accept="image/*"
//                               className="hidden"
//                               onChange={(e) =>
//                                 handleImageUpload(e, "option", opt.option_id)
//                               }
//                             />
//                           </label>

//                           {/* Delete */}
//                           <button
//                             onClick={() => handleDeleteOption(opt.option_id)}
//                             className="p-2 bg-gray-100 rounded-lg hover:bg-red-100 text-red-600 hover:text-red-700 transition-colors border border-gray-200"
//                             title="Delete option"
//                           >
//                             <Trash2 className="w-4 h-4" />
//                           </button>
//                         </div>
//                       )}
//                     </Draggable>
//                   ))}
//                   {provided.placeholder}
//                 </div>
//               )}
//             </Droppable>
//           </DragDropContext>

//           <button
//             onClick={handleAddOption}
//             className="
//               flex items-center justify-center gap-2
//               mb-2 border border-gray-300 border-dashed rounded-lg p-2
//               bg-white w-full
//               cursor-pointer
//               hover:bg-blue-50 hover:border-blue-300
//               transition-colors
//               text-gray-700 hover:text-blue-600
//             "
//           >
//             <Plus className="w-4 h-4" />
//             <span className="text-sm">Add Option</span>
//           </button>
//         </div>

//           {/* Question Time */}
//           <div>
//             <h3 className="text-sm font-medium text-gray-700 mb-3">Question Time</h3>
//             <div className="flex items-center gap-3">
//               <input
//                 type="number"
//                 min="1"
//                 value={safeSlide.question_time || 10}
//                 onChange={(e) =>
//                   setSlide({ ...safeSlide, question_time: parseInt(e.target.value) || 10 })
//                 }
//                 className="w-20 border border-gray-300 rounded-lg p-2 text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//               />
//               <div>
//                 <span className="text-sm font-medium text-gray-700">seconds</span>
//                 <p className="text-xs text-gray-500 mt-1">Time given to answer this question</p>
//               </div>
//             </div>
//           </div>

//           {/* Points */}
//           <div>
//             <h3 className="text-sm font-medium text-gray-700 mb-3">Scoring</h3>
            
//             <div className="grid grid-cols-2 gap-4 mb-4">
//               <div>
//                 <label className="block text-xs font-medium text-gray-600 mb-1">Max Points</label>
//                 <input
//                   type="number"
//                   min="0"
//                   value={safeSlide.max_point || 0}
//                   onChange={(e) =>
//                     setSlide({ ...safeSlide, max_point: parseInt(e.target.value) || 0 })
//                   }
//                   className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 />
//                 <p className="text-xs text-gray-500 mt-1">Points for answering at the start</p>
//               </div>
//               <div>
//                 <label className="block text-xs font-medium text-gray-600 mb-1">Min Points</label>
//                 <input
//                   type="number"
//                   min="0"
//                   value={safeSlide.min_point || 0}
//                   onChange={(e) =>
//                     setSlide({ ...safeSlide, min_point: parseInt(e.target.value) || 0 })
//                   }
//                   className={`w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
//                     !safeSlide.faster_answers_more_points ? "bg-gray-100 cursor-not-allowed opacity-50" : ""
//                   }`}
//                   disabled={!safeSlide.faster_answers_more_points}
//                 />
//                 <p className="text-xs text-gray-500 mt-1">Points for answering at the end</p>
//               </div>
//             </div>

//             {/* Faster answers get more points toggle */}
//             <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50 mb-3">
//               <label className="flex items-center gap-3 cursor-pointer flex-1">
//                 <span className="text-sm font-medium text-gray-700">Faster answers get more points</span>
//               </label>
//               <input
//                 type="checkbox"
//                 checked={safeSlide.faster_answers_more_points || false}
//                 onChange={(e) =>
//                   setSlide({ ...safeSlide, faster_answers_more_points: e.target.checked })
//                 }
//                 className="w-4 h-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
//               />
//             </div>

//             {/* Partial scoring toggle - غیرفعال برای Single Choice */}
//             <div className={`flex items-center justify-between p-3 border rounded-lg ${
//               questionType === "single" ? "bg-gray-100 border-gray-200" : "bg-gray-50 border-gray-200"
//             }`}>
//               <label className={`flex items-center gap-3 flex-1 ${
//                 questionType === "single" ? "cursor-not-allowed opacity-50" : "cursor-pointer"
//               }`}>
//                 <span className="text-sm font-medium text-gray-700">Partial scoring</span>
//               </label>
//               <input
//                 type="checkbox"
//                 checked={safeSlide.partial_scoring || false}
//                 onChange={(e) =>
//                   setSlide({ ...safeSlide, partial_scoring: e.target.checked })
//                 }
//                 disabled={questionType === "single"}
//                 className={`w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${
//                   questionType === "single" ? "cursor-not-allowed opacity-50" : "cursor-pointer"
//                 }`}
//               />
//             </div>
//             {questionType === "single" && (
//               <p className="text-xs text-gray-500 mt-2 ml-1">
//                 Partial scoring is not available for Single Choice questions
//               </p>
//             )}
//           </div>

//           {/* Leaderboard Toggle */}
//           <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
//             <label className="flex items-start gap-3 cursor-pointer">
//               <input
//                 type="checkbox"
//                 checked={hasLinkedLeaderboard}
//                 onChange={(e) => {
//                   const isChecked = e.target.checked;
                  
//                   if (isChecked && onCreateLeaderboardSlide) {
//                     onCreateLeaderboardSlide();
//                   } else if (!isChecked && onDeleteLeaderboardSlide) {
//                     onDeleteLeaderboardSlide(safeSlide.question_id);
//                   }
//                 }}
//                 className="w-4 h-4 mt-0.5 rounded border-gray-300 cursor-pointer text-blue-600 focus:ring-blue-500"
//               />
//               <div>
//                 <span className="text-sm font-medium text-gray-800 block">Show Leaderboard</span>
//                 <p className="text-xs text-gray-600 mt-1">Display leaderboard after this question ends</p>
//               </div>
//             </label>
//           </div>
//         </div>
//       )}

//       {/* Leaderboard Title (only for leaderboard slides) */}
//       {safeSlide.slide_type === 2 && (
//         <div>
//           <h3 className="text-sm font-medium text-gray-700 mb-3">Leaderboard Title</h3>
//           <input
//             type="text"
//             placeholder="Leaderboard"
//             value={safeSlide.leaderboard_title || ""}
//             onChange={(e) =>
//               setSlide({ ...safeSlide, leaderboard_title: e.target.value })
//             }
//             className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//           />
//         </div>
//       )}
//     </div>
//   );
// }




















import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useCallback, useEffect, useState } from "react";
import {
  GripVertical,
  Trash2,
  CheckCircle2,
  Circle,
  Image as ImageIcon,
  X,
  Plus,
  Save,
} from "lucide-react";

export default function Sidebar({ slide, setSlide, onCreateLeaderboardSlide, onDeleteLeaderboardSlide, slides, onClose }) {
  // Stateهای مدیریت تغییرات
  const [localSlide, setLocalSlide] = useState({ ...slide });
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSlide, setOriginalSlide] = useState({ ...slide });

  // تنظیم مقادیر اولیه هنگام بارگذاری
  useEffect(() => {
    if (slide) {
      setOriginalSlide({ ...slide });
      setLocalSlide({ ...slide });
    }
  }, [slide]);

  // تشخیص تغییرات
  useEffect(() => {
    if (!slide) return;

    // مقایسه عمیق بین localSlide و originalSlide
    const hasSlideChanged = () => {
      // مقایسه فیلدهای اصلی
      const mainFields = [
        'question_text',
        'question_image',
        'question_type',
        'question_time',
        'max_point',
        'min_point',
        'faster_answers_more_points',
        'partial_scoring',
        'leaderboard_title'
      ];

      for (const field of mainFields) {
        if (localSlide[field] !== originalSlide[field]) {
          return true;
        }
      }

      // مقایسه options (مقایسه عمیق)
      if (localSlide.options?.length !== originalSlide.options?.length) {
        return true;
      }

      if (localSlide.options && originalSlide.options) {
        for (let i = 0; i < localSlide.options.length; i++) {
          const localOpt = localSlide.options[i];
          const originalOpt = originalSlide.options[i];
          
          if (!originalOpt || 
              localOpt.option_id !== originalOpt.option_id ||
              localOpt.option_text !== originalOpt.option_text ||
              localOpt.answer !== originalOpt.answer ||
              localOpt.image !== originalOpt.image) {
            return true;
          }
        }
      }

      return false;
    };

    setHasChanges(hasSlideChanged());
  }, [localSlide, originalSlide, slide]);

  // اگر slide یا slide.options undefined باشد، مقادیر پیش‌فرض تعیین می‌کنیم
  const safeSlide = localSlide || {};
  const options = safeSlide.options || [];
  const questionType = safeSlide.question_type || "";

  // تغییر متن سوال
  const handleQuestionChange = (value) => {
    setLocalSlide({ ...safeSlide, question_text: value });
  };

  const handleAddOption = () => {
    const newId =
      options.length > 0
        ? Math.max(
            ...options.map((o) =>
              isNaN(parseInt(o.option_id)) ? 0 : parseInt(o.option_id)
            )
          ) + 1
        : 1;

    const newOption = {
      option_id: newId,
      option_text: `Option ${newId}`,
      answer: options.length === 0 && questionType === "multiple", // اگر اولین گزینه در multiple باشد، تیک می‌خورد
      image: "",
    };

    setLocalSlide({
      ...safeSlide,
      options: [...options, newOption],
    });
  };

  // حذف گزینه
  const handleDeleteOption = (id) => {
    const remainingOptions = options.filter((opt) => opt.option_id !== id);
    const hasCorrectAnswer = remainingOptions.some(opt => opt.answer);
    
    // اگر هیچ گزینه صحیحی باقی نمانده و سوال multiple است، اولین گزینه را به صورت خودکار صحیح می‌کنیم
    if (!hasCorrectAnswer && questionType === "multiple" && remainingOptions.length > 0) {
      const updatedOptions = remainingOptions.map((opt, index) => 
        index === 0 ? { ...opt, answer: true } : opt
      );
      
      setLocalSlide({
        ...safeSlide,
        options: updatedOptions,
      });
    } else {
      setLocalSlide({
        ...safeSlide,
        options: remainingOptions,
      });
    }
  };

  // تغییر مقدار گزینه (متن، درست/نادرست یا عکس)
  const handleOptionChange = (id, field, value) => {
    setLocalSlide({
      ...safeSlide,
      options: options.map((opt) =>
        opt.option_id === id ? { ...opt, [field]: value } : opt
      ),
    });
  };

  // انتخاب گزینه درست (براساس نوع سوال)
  const handleSelectCorrect = (id) => {
    if (questionType === "single") {
      // برای Single Choice: فقط یک گزینه می‌تواند درست باشد
      setLocalSlide({
        ...safeSlide,
        options: options.map((opt) => ({
          ...opt,
          answer: opt.option_id === id,
        })),
      });
    } else if (questionType === "multiple") {
      // برای Multiple Choice: می‌توان چند گزینه را انتخاب کرد
      const currentOptions = options;
      const clickedOption = currentOptions.find(opt => opt.option_id === id);
      const isCurrentlyCorrect = clickedOption.answer;
      const correctOptionsCount = currentOptions.filter(opt => opt.answer).length;
      
      // اگر کاربر می‌خواهد آخرین گزینه صحیح را غیرفعال کند، اجازه نمی‌دهیم
      if (isCurrentlyCorrect && correctOptionsCount === 1) {
        return; // حداقل یک گزینه باید صحیح باشد
      }
      
      setLocalSlide({
        ...safeSlide,
        options: currentOptions.map((opt) =>
          opt.option_id === id ? { ...opt, answer: !opt.answer } : opt
        ),
      });
    }
  };

  // جابه‌جایی گزینه‌ها
  const onDragEnd = useCallback(
    (result) => {
      if (!result.destination) return;
      const newOptions = Array.from(options);
      const [moved] = newOptions.splice(result.source.index, 1);
      newOptions.splice(result.destination.index, 0, moved);
      setLocalSlide({ ...safeSlide, options: newOptions });
    },
    [safeSlide, options]
  );

  // آپلود تصویر برای سوال یا گزینه
  const handleImageUpload = (e, type, id = null) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === "question") {
        setLocalSlide({ ...safeSlide, question_image: reader.result });
      } else if (type === "option") {
        handleOptionChange(id, "image", reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // حذف تصویر
  const handleRemoveImage = (type, id = null) => {
    if (type === "question") {
      setLocalSlide({ ...safeSlide, question_image: "" });
    } else if (type === "option") {
      handleOptionChange(id, "image", "");
    }
  };

  // بررسی وجود اسلاید لیدربرد مرتبط
  const hasLinkedLeaderboard = slides.some(
    s => s.slide_type === 2 && s.linked_question_id === safeSlide.question_id
  );

  // Effect برای اطمینان از اینکه حداقل یک گزینه صحیح در سوالات multiple وجود دارد
  useEffect(() => {
    if (questionType === "multiple" && options.length > 0) {
      const hasCorrectAnswer = options.some(opt => opt.answer);
      if (!hasCorrectAnswer) {
        // اولین گزینه را به صورت خودکار صحیح می‌کنیم
        const updatedOptions = options.map((opt, index) => 
          index === 0 ? { ...opt, answer: true } : opt
        );
        
        setLocalSlide({
          ...safeSlide,
          options: updatedOptions,
        });
      }
    }
  }, [questionType, options.length, safeSlide]);

  // ذخیره تغییرات
  const handleSubmit = () => {
    if (!hasChanges || !slide) {
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
          question_text: localSlide.question_text,
          question_image: localSlide.question_image,
          question_type: localSlide.question_type,
          question_time: localSlide.question_time,
          max_point: localSlide.max_point,
          min_point: localSlide.min_point,
          faster_answers_more_points: localSlide.faster_answers_more_points,
          partial_scoring: localSlide.partial_scoring,
          options: localSlide.options,
          leaderboard_title: localSlide.leaderboard_title
        };
        
        // ذخیره در localStorage
        localStorage.setItem("slides", JSON.stringify(slidesData));
        
        console.log("Slide settings saved to localStorage");
        
        // به‌روزرسانی slide در parent component
        setSlide({ ...localSlide });
        
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

  // مدیریت تغییرات دیگر فیلدها
  const handleFieldChange = (field, value) => {
    setLocalSlide({
      ...safeSlide,
      [field]: value
    });
  };

  // اگر slide وجود ندارد، کامپوننت را رندر نکن
  if (!slide) {
    return <div className="space-y-6 p-4">No slide selected</div>;
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* هدر */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="font-semibold text-gray-900">Slide Settings</h3>
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

      {/* Question Slides Content */}
      {safeSlide.slide_type === 1 && (
        <div className="space-y-6">
          {/* Question Text */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Question Text</h3>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={safeSlide.question_text || ""}
                onChange={(e) => handleQuestionChange(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
                placeholder="Enter your question here..."
              />
              <div className="flex items-center gap-1">
                <label className="p-2 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors border border-gray-200 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 text-gray-600" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e, "question")}
                  />
                </label>
                {safeSlide.question_image && (
                  <div className="relative">
                    <img
                      src={safeSlide.question_image}
                      alt="Question"
                      className="w-10 h-10 object-cover rounded-md border border-gray-300"
                    />
                    <button
                      onClick={() => handleRemoveImage("question")}
                      className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 text-red-500 hover:bg-red-50 transition-colors shadow-sm border border-gray-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">Options</h3>
              {questionType && (
                <div className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">
                  {questionType === "single"
                    ? "Single Choice"
                    : "Multiple Choice"}
                </div>
              )}
            </div>

            <p className="text-xs text-gray-500 mb-3">
              {questionType === "single"
                ? "Select only one correct option"
                : "Select one or more correct options"}
            </p>

            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="options">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef}>
                    {options.map((opt, index) => (
                      <Draggable
                        key={opt.option_id}
                        draggableId={opt.option_id.toString()}
                        index={index}
                      >
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className="flex items-start gap-2 mb-2 border border-gray-200 rounded-lg p-2 bg-white hover:border-gray-300 transition-colors"
                          >
                            {/* Drag */}
                            <div
                              {...provided.dragHandleProps}
                              className="p-2 bg-gray-100 rounded-lg cursor-grab hover:bg-gray-200 transition-colors border border-gray-200"
                              title="Drag to reorder"
                            >
                              <GripVertical className="w-4 h-4 text-gray-600" />
                            </div>

                            {/* Correct */}
                            <button
                              onClick={() => handleSelectCorrect(opt.option_id)}
                              className={`p-2 rounded-lg border transition-colors ${
                                opt.answer
                                  ? "bg-green-100 border-green-200 text-green-600 hover:bg-green-200"
                                  : "bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200"
                              }`}
                              title="Mark as correct"
                            >
                              {opt.answer ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : (
                                <Circle className="w-4 h-4" />
                              )}
                            </button>

                            {/* Text & Image */}
                            <div className="flex-1 flex flex-col gap-1">
                              <input
                                type="text"
                                value={opt.option_text}
                                onChange={(e) =>
                                  handleOptionChange(
                                    opt.option_id,
                                    "option_text",
                                    e.target.value
                                  )
                                }
                                className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
                                placeholder="Option text..."
                              />

                              {opt.image && (
                                <div className="relative mt-1 w-fit">
                                  <img
                                    src={opt.image}
                                    alt="Option"
                                    className="w-16 h-16 object-cover rounded-lg border border-gray-300"
                                  />
                                  <button
                                    onClick={() =>
                                      handleRemoveImage("option", opt.option_id)
                                    }
                                    className="absolute -top-2 -right-2 bg-white rounded-full p-1 text-red-500 hover:bg-red-50 transition-colors shadow-sm border border-gray-200"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Upload */}
                            <label className="p-2 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors border border-gray-200">
                              <ImageIcon className="w-4 h-4 text-gray-600" />
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) =>
                                  handleImageUpload(e, "option", opt.option_id)
                                }
                              />
                            </label>

                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteOption(opt.option_id)}
                              className="p-2 bg-gray-100 rounded-lg hover:bg-red-100 text-red-600 hover:text-red-700 transition-colors border border-gray-200"
                              title="Delete option"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            <button
              onClick={handleAddOption}
              className="
                flex items-center justify-center gap-2
                mb-2 border border-gray-300 border-dashed rounded-lg p-2
                bg-white w-full
                cursor-pointer
                hover:bg-blue-50 hover:border-blue-300
                transition-colors
                text-gray-700 hover:text-blue-600
              "
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Add Option</span>
            </button>
          </div>

          {/* Question Time */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Question Time</h3>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                value={safeSlide.question_time || 10}
                onChange={(e) =>
                  handleFieldChange("question_time", parseInt(e.target.value) || 10)
                }
                className="w-20 border border-gray-300 rounded-lg p-2 text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">seconds</span>
                <p className="text-xs text-gray-500 mt-1">Time given to answer this question</p>
              </div>
            </div>
          </div>

          {/* Points */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Scoring</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Max Points</label>
                <input
                  type="number"
                  min="0"
                  value={safeSlide.max_point || 0}
                  onChange={(e) =>
                    handleFieldChange("max_point", parseInt(e.target.value) || 0)
                  }
                  className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Points for answering at the start</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Min Points</label>
                <input
                  type="number"
                  min="0"
                  value={safeSlide.min_point || 0}
                  onChange={(e) =>
                    handleFieldChange("min_point", parseInt(e.target.value) || 0)
                  }
                  className={`w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    !safeSlide.faster_answers_more_points ? "bg-gray-100 cursor-not-allowed opacity-50" : ""
                  }`}
                  disabled={!safeSlide.faster_answers_more_points}
                />
                <p className="text-xs text-gray-500 mt-1">Points for answering at the end</p>
              </div>
            </div>

            {/* Faster answers get more points toggle */}
            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50 mb-3">
              <label className="flex items-center gap-3 cursor-pointer flex-1">
                <span className="text-sm font-medium text-gray-700">Faster answers get more points</span>
              </label>
              <input
                type="checkbox"
                checked={safeSlide.faster_answers_more_points || false}
                onChange={(e) =>
                  handleFieldChange("faster_answers_more_points", e.target.checked)
                }
                className="w-4 h-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>

            {/* Partial scoring toggle - غیرفعال برای Single Choice */}
            <div className={`flex items-center justify-between p-3 border rounded-lg ${
              questionType === "single" ? "bg-gray-100 border-gray-200" : "bg-gray-50 border-gray-200"
            }`}>
              <label className={`flex items-center gap-3 flex-1 ${
                questionType === "single" ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              }`}>
                <span className="text-sm font-medium text-gray-700">Partial scoring</span>
              </label>
              <input
                type="checkbox"
                checked={safeSlide.partial_scoring || false}
                onChange={(e) =>
                  handleFieldChange("partial_scoring", e.target.checked)
                }
                disabled={questionType === "single"}
                className={`w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${
                  questionType === "single" ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                }`}
              />
            </div>
            {questionType === "single" && (
              <p className="text-xs text-gray-500 mt-2 ml-1">
                Partial scoring is not available for Single Choice questions
              </p>
            )}
          </div>

          {/* Leaderboard Toggle */}
          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hasLinkedLeaderboard}
                onChange={(e) => {
                  const isChecked = e.target.checked;
                  
                  if (isChecked && onCreateLeaderboardSlide) {
                    onCreateLeaderboardSlide();
                  } else if (!isChecked && onDeleteLeaderboardSlide) {
                    onDeleteLeaderboardSlide(safeSlide.question_id);
                  }
                }}
                className="w-4 h-4 mt-0.5 rounded border-gray-300 cursor-pointer text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-800 block">Show Leaderboard</span>
                <p className="text-xs text-gray-600 mt-1">Display leaderboard after this question ends</p>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Leaderboard Title (only for leaderboard slides) */}
      {safeSlide.slide_type === 2 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Leaderboard Title</h3>
          <input
            type="text"
            placeholder="Leaderboard"
            value={safeSlide.leaderboard_title || ""}
            onChange={(e) =>
              handleFieldChange("leaderboard_title", e.target.value)
            }
            className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )}

      {/* دکمه‌های Cancel و Save Changes */}
      <div className="mt-8 pt-6 border-t border-gray-200">
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
            ? "Click 'Save Changes' to store slide settings in your browser's local storage"
            : "No changes to save"
          }
        </p>
      </div>
    </div>
  );
}