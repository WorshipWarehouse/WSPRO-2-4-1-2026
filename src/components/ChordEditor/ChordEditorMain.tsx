import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  FileText, 
  ChevronLeft, 
  ChevronRight, 
  Save, 
  Download, 
  Undo, 
  Redo, 
  Trash2, 
  Layout, 
  Eye, 
  Edit3,
  AlertCircle,
  CheckCircle,
  Music,
  Settings
} from "lucide-react";
import { useChordEditor } from "../../hooks/useChordEditor";
import { FileUpload } from "./FileUpload";
import { LyricEditor } from "./LyricEditor";
import { ChordDisplay } from "./ChordDisplay";
import { KeyTransposer } from "./KeyTransposer";
import { ChordPreview } from "./ChordPreview";
import { ExportDialog } from "./ExportDialog";
import { ChordSourceToggle } from "./ChordSourceToggle";
import { ChordNotesEditor } from "./ChordNotesEditor";
import { NotesPreview } from "./NotesPreview";
import { ChordNotesTransposer } from "./ChordNotesTransposer";
import { FileDetectionSummary } from "./FileDetectionSummary";

export const ChordEditorMain: React.FC = () => {
  const {
    currentFile,
    currentSlideIndex,
    setCurrentSlideIndex,
    currentSlide,
    originalKey,
    transposedKey,
    setKeys,
    isLoading,
    setIsLoading,
    error,
    setError,
    isDirty,
    notesMode,
    setNotesMode,
    updateLyrics,
    updateSlideNotes,
    transposedLyrics,
    transposedNotes,
    chordsInNotes,
    toggleChordsMode,
    undo,
    redo,
    canUndo,
    canRedo,
    loadFile,
    resetChanges,
    detectionResult,
    isAnalysisConfirmed,
    confirmAnalysis
  } = useChordEditor();

  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [isExportOpen, setIsExportOpen] = useState(false);

  useEffect(() => {
    if (currentFile && chordsInNotes && notesMode === "inline" && isAnalysisConfirmed) {
      setNotesMode("notes");
    }
  }, [currentFile, chordsInNotes, notesMode, setNotesMode, isAnalysisConfirmed]);

  const handleUpdateChord = (oldChord: string, newChord: string) => {
    if (!currentSlide) return;
    const newLyrics = currentSlide.lyrics.replace(new RegExp(`\\[${oldChord}\\]`, "g"), `[${newChord}]`);
    updateLyrics(newLyrics);
  };

  if (!currentFile) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-4xl"
        >
          <div className="text-center mb-12">
            <h1 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">
              Chord Editor <span className="text-blue-600">Pro</span>
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Upload your ProPresenter presentations to add, edit, and transpose chords 
              directly within the slides. Perfect for stage displays and band sheets.
            </p>
          </div>

          <FileUpload 
            onFileLoaded={loadFile} 
            isLoading={isLoading} 
            setIsLoading={setIsLoading} 
            setError={setError} 
          />

          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700 max-w-2xl mx-auto"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </motion.div>
          )}
        </motion.div>
      </div>
    );
  }

  if (detectionResult && !isAnalysisConfirmed) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <FileDetectionSummary 
          result={detectionResult} 
          onConfirm={confirmAnalysis} 
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => window.location.reload()} 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="h-8 w-px bg-gray-200" />
          <div>
            <h2 className="text-sm font-bold text-gray-900 truncate max-w-[200px]">
              {currentFile.title}
            </h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
              {currentFile.slides.length} slides
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ChordSourceToggle 
            sourceMode={notesMode} 
            onModeChange={setNotesMode} 
            hasChanges={isDirty}
          />

          <div className="h-8 w-px bg-gray-200 mx-2" />

          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("edit")}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
                activeTab === "edit" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              Editor
            </button>
            <button
              onClick={() => setActiveTab("preview")}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
                activeTab === "preview" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </button>
          </div>

          <div className="h-8 w-px bg-gray-200 mx-2" />

          <button
            onClick={() => setIsExportOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-100"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar: Slide List */}
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Slides</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {currentFile.slides.map((slide, idx) => (
              <button
                key={slide.id}
                onClick={() => setCurrentSlideIndex(idx)}
                className={`w-full text-left p-3 rounded-lg transition-all flex flex-col gap-1 group ${
                  currentSlideIndex === idx 
                    ? "bg-blue-50 border border-blue-100" 
                    : "hover:bg-gray-50 border border-transparent"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold ${currentSlideIndex === idx ? "text-blue-600" : "text-gray-400"}`}>
                    SLIDE {idx + 1}
                  </span>
                  <span className="text-[10px] font-medium text-gray-300 group-hover:text-gray-400">
                    {slide.label}
                  </span>
                </div>
                <p className={`text-xs truncate ${currentSlideIndex === idx ? "text-blue-900 font-medium" : "text-gray-600"}`}>
                  {slide.lyrics || "Empty slide"}
                </p>
              </button>
            ))}
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === "edit" ? (
              <motion.div
                key="edit"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex-1 flex p-6 gap-6 overflow-hidden"
              >
                {/* Editor Column */}
                <div className="flex-1 flex flex-col gap-6 min-w-0">
                  {notesMode === "inline" ? (
                    <LyricEditor
                      lyrics={currentSlide?.lyrics || ""}
                      onUpdate={updateLyrics}
                      onUndo={undo}
                      onRedo={redo}
                      canUndo={canUndo}
                      canRedo={canRedo}
                      isDirty={isDirty}
                    />
                  ) : (
                    <ChordNotesEditor
                      slideIndex={currentSlideIndex}
                      slideTitle={currentSlide?.label || ""}
                      lyrics={currentSlide?.lyrics || ""}
                      notesText={currentSlide?.notes || ""}
                      originalKey={originalKey}
                      onNotesChange={updateSlideNotes}
                    />
                  )}
                </div>

                {/* Preview/Controls Column */}
                <div className="w-96 flex flex-col gap-6 flex-shrink-0">
                  {notesMode === "inline" ? (
                    <>
                      <KeyTransposer
                        originalKey={originalKey}
                        transposedKey={transposedKey}
                        onKeyChange={setKeys}
                      />
                      <ChordDisplay
                        lyrics={currentSlide?.lyrics || ""}
                        originalKey={originalKey}
                        transposedKey={transposedKey}
                        onUpdateChord={handleUpdateChord}
                      />
                    </>
                  ) : (
                    <ChordNotesTransposer
                      notesText={currentSlide?.notes || ""}
                      originalKey={originalKey}
                      transposedKey={transposedKey}
                      onKeyChange={setKeys}
                    />
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="preview"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex-1 p-6 overflow-hidden"
              >
                {notesMode === "inline" ? (
                  <ChordPreview
                    lyrics={currentSlide?.lyrics || ""}
                    originalKey={originalKey}
                    transposedKey={transposedKey}
                    title={currentFile.title}
                  />
                ) : (
                  <NotesPreview
                    notesText={currentSlide?.notes || ""}
                    originalKey={originalKey}
                    transposedKey={transposedKey}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <ExportDialog
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        presentation={currentFile}
        currentSlideIndex={currentSlideIndex}
        currentLyrics={currentSlide?.lyrics || ""}
        currentNotes={currentSlide?.notes || ""}
      />
    </div>
  );
};
