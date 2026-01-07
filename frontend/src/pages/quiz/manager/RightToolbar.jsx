//This component belongs to the toolbar on the right side of the Edit Quiz section(Panel)

import { 
    Sparkles, LayoutTemplate, 
    FileText, Paintbrush, Volume2, Settings 
} from "lucide-react";


const items = [
    { id: "ai", label: "AI", icon: Sparkles },
    { id: "templates", label: "Templates", icon: LayoutTemplate },
    "divider",
    { id: "content", label: "Content", icon: FileText },
    { id: "design", label: "Design", icon: Paintbrush },
    { id: "audio", label: "Audio", icon: Volume2 },
    "divider",
    { id: "settings", label: "Settings", icon: Settings },
];


export default function RightToolbar({ activeTab, setActiveTab }) {
    return (
        <div className="bg-white border-l border-gray-200 shadow-sm flex lg:flex-col flex-row items-center lg:items-center lg:py-4 py-2 lg:px-0 px-2 gap-2 lg:gap-2 w-full h-14 lg:h-full lg:w-16 overflow-x-auto lg:overflow-visible flex-nowrap">

            {items.map((item, index) => {
                if (item === "divider") {
                    return (
                        <div
                            key={index}
                            className="lg:w-8 lg:h-px w-px h-8 bg-gray-300 lg:my-2"
                        ></div>
                    );
                }

                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-1 transition-all 
                            ${isActive ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-100"}`}
                    >
                        <Icon size={22} strokeWidth={2} />
                        <span className="text-[10px] font-medium">{item.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
