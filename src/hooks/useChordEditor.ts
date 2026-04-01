import { useState, useCallback, useMemo } from "react";
import { transposeLyrics } from "../utils/chordTransposer";
import { transposeChordNotes } from "../utils/notesTransposer";
import { extractChordsFromNotes } from "../utils/chordNotesParser";
import { analyzePro7File, FileDetectionResult } from "../utils/pro7FileDetector";

export interface Slide {
  id: string;
  label: string;
  lyrics: string;
  notes?: string;
}

export interface Presentation {
  title: string;
  slides: Slide[];
  originalZip?: any;
  documentXml?: any;
}

export function useChordEditor() {
  const [currentFile, setCurrentFile] = useState<Presentation | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [originalKey, setOriginalKey] = useState<string>("C");
  const [transposedKey, setTransposedKey] = useState<string>("C");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [notesMode, setNotesMode] = useState<"inline" | "notes">("inline");
  const [detectionResult, setDetectionResult] = useState<FileDetectionResult | null>(null);
  const [isAnalysisConfirmed, setIsAnalysisConfirmed] = useState<boolean>(false);

  // History for undo/redo
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const currentSlide = useMemo(() => {
    if (!currentFile || currentSlideIndex < 0 || currentSlideIndex >= currentFile.slides.length) {
      return null;
    }
    return currentFile.slides[currentSlideIndex];
  }, [currentFile, currentSlideIndex]);

  const loadFile = useCallback((fileData: Presentation) => {
    const analysis = analyzePro7File(fileData);
    setDetectionResult(analysis);
    
    setCurrentFile(fileData);
    setCurrentSlideIndex(0);
    setHistory([fileData.slides[0]?.lyrics || ""]);
    setHistoryIndex(0);
    setIsDirty(false);
    setError(null);
    setIsAnalysisConfirmed(false);

    // Initial configuration based on analysis
    if (analysis.chordSource === "notes") {
      setNotesMode("notes");
    } else {
      setNotesMode("inline");
    }

    if (analysis.detectedKey) {
      setOriginalKey(analysis.detectedKey);
      setTransposedKey(analysis.detectedKey);
    }
  }, []);

  const confirmAnalysis = useCallback(() => {
    setIsAnalysisConfirmed(true);
  }, []);

  const updateLyrics = useCallback((newLyrics: string, addToHistory = true) => {
    if (!currentFile) return;

    const updatedSlides = [...currentFile.slides];
    updatedSlides[currentSlideIndex] = {
      ...updatedSlides[currentSlideIndex],
      lyrics: newLyrics
    };

    setCurrentFile({
      ...currentFile,
      slides: updatedSlides
    });
    setIsDirty(true);

    if (addToHistory) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newLyrics);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  }, [currentFile, currentSlideIndex, history, historyIndex]);

  const updateSlideNotes = useCallback((newNotes: string) => {
    if (!currentFile) return;

    const updatedSlides = [...currentFile.slides];
    updatedSlides[currentSlideIndex] = {
      ...updatedSlides[currentSlideIndex],
      notes: newNotes
    };

    setCurrentFile({
      ...currentFile,
      slides: updatedSlides
    });
    setIsDirty(true);
  }, [currentFile, currentSlideIndex]);

  const toggleChordsMode = useCallback(() => {
    setNotesMode(prev => prev === "inline" ? "notes" : "inline");
  }, []);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevLyrics = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      updateLyrics(prevLyrics, false);
    }
  }, [history, historyIndex, updateLyrics]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextLyrics = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      updateLyrics(nextLyrics, false);
    }
  }, [history, historyIndex, updateLyrics]);

  const setKeys = useCallback((original: string, transposed: string) => {
    setOriginalKey(original);
    setTransposedKey(transposed);
  }, []);

  const resetChanges = useCallback(() => {
    // In a real app, we might want to reload the original file
    setIsDirty(false);
  }, []);

  const transposedLyrics = useMemo(() => {
    if (!currentSlide) return "";
    return transposeLyrics(currentSlide.lyrics, originalKey, transposedKey);
  }, [currentSlide, originalKey, transposedKey]);

  const transposedNotes = useMemo(() => {
    if (!currentSlide || !currentSlide.notes) return "";
    return transposeChordNotes(currentSlide.notes, originalKey, transposedKey);
  }, [currentSlide, originalKey, transposedKey]);

  const chordsInNotes = useMemo(() => {
    if (!currentSlide || !currentSlide.notes) return false;
    return extractChordsFromNotes(currentSlide.notes).length > 0;
  }, [currentSlide]);

  return {
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
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    loadFile,
    resetChanges,
    detectionResult,
    isAnalysisConfirmed,
    confirmAnalysis
  };
}
