import React, { useState, useCallback } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { motion } from "motion/react";

interface FileUploadProps {
  onFileLoaded: (presentation: any) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileLoaded, isLoading, setIsLoading, setError }) => {
  const [dragActive, setDragActive] = useState(false);
  const [fileInfo, setFileInfo] = useState<{ name: string; slides: number } | null>(null);

  const handleFile = useCallback(async (file: File) => {
    const isProFile = file.name.endsWith(".pro") || file.name.endsWith(".pro6");
    if (!isProFile) {
      setError("Please upload a valid ProPresenter (.pro or .pro6) file.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setFileInfo(null);

    const formData = new FormData();
    formData.append("proFile", file);

    try {
      const response = await fetch("/api/chords/parse-pro-file", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to parse file. Please check if it's a valid ProPresenter file.");
      }

      const data = await response.json();
      onFileLoaded(data);
      setFileInfo({ name: file.name, slides: data.slides.length });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [onFileLoaded, setIsLoading, setError]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-12 transition-all duration-200 flex flex-col items-center justify-center text-center ${
          dragActive ? "border-blue-500 bg-blue-50/50" : "border-gray-200 hover:border-gray-300"
        }`}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept=".pro,.pro6"
          onChange={handleChange}
          disabled={isLoading}
        />
        
        <label
          htmlFor="file-upload"
          className={`cursor-pointer flex flex-col items-center ${isLoading ? "opacity-50 pointer-events-none" : ""}`}
        >
          {isLoading ? (
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          ) : (
            <Upload className="w-12 h-12 text-gray-400 mb-4" />
          )}
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {isLoading ? "Parsing Presentation..." : "Upload ProPresenter File"}
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            Drag and drop your .pro or .pro6 file here, or click to browse
          </p>
          <div className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
            Select File
          </div>
        </label>

        {fileInfo && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 p-4 bg-green-50 border border-green-100 rounded-lg flex items-center gap-3 text-left w-full"
          >
            <div className="p-2 bg-green-100 rounded-full">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-green-900 truncate max-w-[300px]">
                {fileInfo.name}
              </p>
              <p className="text-xs text-green-700">
                {fileInfo.slides} slides detected
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};
