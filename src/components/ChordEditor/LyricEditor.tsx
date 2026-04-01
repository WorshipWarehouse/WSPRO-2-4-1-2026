import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "motion/react";

interface LyricEditorProps {
  lyrics: string;
  onUpdate: (newLyrics: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isDirty: boolean;
}

export const LyricEditor: React.FC<LyricEditorProps> = ({
  lyrics,
  onUpdate,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  isDirty,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Undo: Ctrl+Z
    if (e.ctrlKey && e.key === "z") {
      e.preventDefault();
      onUndo();
    }
    // Redo: Ctrl+Y or Ctrl+Shift+Z
    if (e.ctrlKey && (e.key === "y" || (e.shiftKey && e.key === "Z"))) {
      e.preventDefault();
      onRedo();
    }
    // Save: Ctrl+S (prevent default browser save)
    if (e.ctrlKey && e.key === "s") {
      e.preventDefault();
      // In a real app, this would trigger a save to backend
      console.log("Saving changes...");
    }
  };

  // Sync scroll between textarea and highlight pre
  const handleScroll = () => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  // Highlight chords in ChordPro format [G]
  const renderHighlightedText = (text: string) => {
    const parts = text.split(/(\[[^\]]+\])/g);
    return parts.map((part, i) => {
      if (part.startsWith("[") && part.endsWith("]")) {
        return (
          <span key={i} className="text-blue-600 font-bold bg-blue-50 rounded px-0.5">
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const lineNumbers = lyrics.split("\n").map((_, i) => i + 1);

  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-bottom border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Editor</span>
          {isDirty && (
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" title="Unsaved changes" />
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Undo (Ctrl+Z)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Redo (Ctrl+Y)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
              </svg>
            </button>
          </div>
          <span className="text-xs text-gray-400 font-mono">ChordPro Format</span>
        </div>
      </div>

      <div className="flex flex-1 relative overflow-hidden">
        {/* Line Numbers */}
        <div className="w-10 bg-gray-50 border-r border-gray-100 flex flex-col items-center py-4 text-[10px] font-mono text-gray-400 select-none">
          {lineNumbers.map((n) => (
            <div key={n} className="h-6 flex items-center justify-center">
              {n}
            </div>
          ))}
        </div>

        {/* Editor Container */}
        <div className="flex-1 relative font-mono text-sm leading-6">
          {/* Highlighting Layer */}
          <pre
            ref={highlightRef}
            aria-hidden="true"
            className="absolute inset-0 p-4 m-0 pointer-events-none whitespace-pre-wrap break-words text-transparent overflow-hidden"
          >
            {renderHighlightedText(lyrics)}
            {"\n"}
          </pre>

          {/* Textarea Layer */}
          <textarea
            ref={textareaRef}
            value={lyrics}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            spellCheck={false}
            className="absolute inset-0 w-full h-full p-4 m-0 bg-transparent border-none focus:ring-0 resize-none whitespace-pre-wrap break-words text-gray-800 caret-blue-600 overflow-auto"
            placeholder="Enter lyrics with chords like [G] Amazing Grace..."
          />
        </div>
      </div>
    </div>
  );
};
