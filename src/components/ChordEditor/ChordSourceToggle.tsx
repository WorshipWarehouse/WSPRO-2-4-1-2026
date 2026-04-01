import React from "react";
import { Music, FileText } from "lucide-react";

interface ChordSourceToggleProps {
  sourceMode: "inline" | "notes";
  onModeChange: (mode: "inline" | "notes") => void;
  hasChanges?: boolean;
}

export const ChordSourceToggle: React.FC<ChordSourceToggleProps> = ({
  sourceMode,
  onModeChange,
  hasChanges
}) => {
  const handleModeChange = (mode: "inline" | "notes") => {
    if (mode === sourceMode) return;
    
    if (hasChanges) {
      if (!window.confirm("You have unsaved changes. Switching modes might make it harder to track changes. Continue?")) {
        return;
      }
    }
    
    onModeChange(mode);
  };

  return (
    <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded-lg">
      <button
        onClick={() => handleModeChange("inline")}
        className={`flex items-center space-x-2 px-3 py-1.5 rounded-md transition-all ${
          sourceMode === "inline"
            ? "bg-white text-blue-600 shadow-sm"
            : "text-gray-600 hover:bg-gray-200"
        }`}
      >
        <Music size={16} />
        <span className="text-sm font-medium">Inline Chords</span>
      </button>
      <button
        onClick={() => handleModeChange("notes")}
        className={`flex items-center space-x-2 px-3 py-1.5 rounded-md transition-all ${
          sourceMode === "notes"
            ? "bg-white text-blue-600 shadow-sm"
            : "text-gray-600 hover:bg-gray-200"
        }`}
      >
        <FileText size={16} />
        <span className="text-sm font-medium">Slide Notes</span>
      </button>
    </div>
  );
};
