import React from "react";
import { Info, CheckCircle, AlertCircle, Music, FileText } from "lucide-react";
import { motion } from "motion/react";
import { FileDetectionResult } from "../../utils/pro7FileDetector";

interface FileDetectionSummaryProps {
  result: FileDetectionResult;
  onConfirm: () => void;
}

export const FileDetectionSummary: React.FC<FileDetectionSummaryProps> = ({ result, onConfirm }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl mx-auto mt-8 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
    >
      <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Info className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">File Analysis Complete</h3>
        </div>
        <div className="px-3 py-1 bg-green-100 text-green-700 text-[10px] font-black uppercase tracking-widest rounded-full">
          Ready to Edit
        </div>
      </div>

      <div className="p-8 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-gray-400" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Chord Source</span>
            </div>
            <p className="text-sm font-bold text-gray-900 capitalize">
              {result.chordSource === "none" ? "No Chords Found" : `${result.chordSource} Mode`}
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Music className="w-4 h-4 text-gray-400" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Detected Key</span>
            </div>
            <p className="text-sm font-bold text-gray-900">
              {result.detectedKey || "Unknown"}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
          <CheckCircle className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">{result.summary}</p>
            <p className="text-xs text-blue-700 mt-1">
              We've automatically configured the editor for the best experience.
            </p>
          </div>
        </div>

        <button
          onClick={onConfirm}
          className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
        >
          Open in Editor
        </button>
      </div>
    </motion.div>
  );
};
