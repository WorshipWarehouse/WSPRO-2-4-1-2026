import React, { useState } from "react";
import { Download, CheckCircle, AlertCircle, Loader2, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { exportToPro7 } from "../../utils/pro7Exporter";

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  presentation: any;
  currentSlideIndex: number;
  currentLyrics: string;
  currentNotes?: string;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  presentation,
  currentSlideIndex,
  currentLyrics,
  currentNotes,
}) => {
  const [filename, setFilename] = useState(presentation?.title || "Presentation");
  const [addSuffix, setAddSuffix] = useState(true);
  const [status, setStatus] = useState<"idle" | "exporting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleExport = async () => {
    if (!presentation || !presentation.documentXml) {
      setErrorMessage("No presentation data found to export.");
      setStatus("error");
      return;
    }

    setStatus("exporting");
    setErrorMessage("");

    try {
      const finalFilename = `${filename}${addSuffix ? " (Chords)" : ""}.pro`;
      
      // We only update the current slide for this demo
      // In a real app, we might update all slides that were edited
      const updatedSlides = [{
        slideIndex: currentSlideIndex,
        newLyrics: currentLyrics,
        newNotes: currentNotes
      }];

      const blob = await exportToPro7(
        presentation.originalZip,
        presentation.documentXml,
        updatedSlides
      );

      // Trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = finalFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setStatus("success");
      setTimeout(() => {
        onClose();
        setStatus("idle");
      }, 2000);
    } catch (err: any) {
      console.error("Export error:", err);
      setErrorMessage(err.message || "Failed to export file.");
      setStatus("error");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Export Presentation</h3>
              <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Filename</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={filename}
                      onChange={(e) => setFilename(e.target.value)}
                      className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder="Enter filename"
                    />
                    <span className="text-sm text-gray-400 font-mono">.pro</span>
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={addSuffix}
                      onChange={(e) => setAddSuffix(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </div>
                  <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
                    Add "(Chords)" suffix to filename
                  </span>
                </label>

                <div className="pt-4">
                  {status === "idle" && (
                    <button
                      onClick={handleExport}
                      className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                    >
                      <Download className="w-5 h-5" />
                      Download .pro File
                    </button>
                  )}

                  {status === "exporting" && (
                    <div className="w-full py-3 bg-blue-50 text-blue-600 rounded-xl font-bold flex items-center justify-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Preparing File...
                    </div>
                  )}

                  {status === "success" && (
                    <div className="w-full py-3 bg-green-50 text-green-600 rounded-xl font-bold flex items-center justify-center gap-3">
                      <CheckCircle className="w-5 h-5" />
                      Export Successful!
                    </div>
                  )}

                  {status === "error" && (
                    <div className="space-y-3">
                      <div className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-bold flex items-center justify-center gap-3">
                        <AlertCircle className="w-5 h-5" />
                        Export Failed
                      </div>
                      <p className="text-xs text-red-500 text-center">{errorMessage}</p>
                      <button
                        onClick={() => setStatus("idle")}
                        className="w-full text-sm text-gray-500 hover:text-gray-700 font-medium"
                      >
                        Try Again
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 text-[10px] text-gray-400 text-center uppercase tracking-widest font-bold">
              ProPresenter 7 Compatible Export
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
