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
        <div className="h-full w-16 bg-white border-l border-gray-200 shadow-sm flex flex-col items-center py-4 gap-2">

            {items.map((item, index) => {
                if (item === "divider") {
                    return <div key={index} className="w-8 h-px bg-gray-300 my-2"></div>;
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