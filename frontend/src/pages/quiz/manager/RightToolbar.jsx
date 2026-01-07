//This component belongs to the toolbar on the right side of the Edit Quiz section(Panel)

import { 
    Sparkles, LayoutTemplate,
    FileText, Paintbrush, Volume2, Settings, LayoutList
} from "lucide-react";


const items = [
    { id: "slides", label: "Slides", icon: LayoutList, mobileOnly: true },
    { id: "ai", label: "AI", icon: Sparkles },
    { id: "templates", label: "Templates", icon: LayoutTemplate },
    "divider",
    { id: "content", label: "Content", icon: FileText },
    { id: "design", label: "Design", icon: Paintbrush },
    { id: "audio", label: "Audio", icon: Volume2 },
    "divider",
    { id: "settings", label: "Settings", icon: Settings },
];


export default function RightToolbar({ activeTab, setActiveTab, isCompact = false }) {
    const containerClass = isCompact
        ? "bg-white border-t border-gray-200 shadow-sm flex flex-row items-center py-2 px-2 gap-2 w-full h-14 overflow-x-auto flex-nowrap fixed bottom-0 left-0 right-0 z-40"
        : "bg-white border-l border-gray-200 shadow-sm flex flex-col items-center py-4 gap-2 w-16 h-full";
    return (
        <div
            className={containerClass}
            style={isCompact ? { paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" } : undefined}
        >

            {items.map((item, index) => {
                if (item === "divider") {
                    return (
                        <div
                            key={index}
                            className={isCompact ? "w-px h-8 bg-gray-300" : "w-8 h-px bg-gray-300 my-2"}
                        ></div>
                    );
                }

                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const visibilityClass = item.mobileOnly && !isCompact ? "hidden" : "";

                return (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-1 transition-all 
                            ${isActive ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-100"}
                            ${visibilityClass}`}
                    >
                        <Icon size={22} strokeWidth={2} />
                        <span className="text-[10px] font-medium">{item.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
