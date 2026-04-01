import React, { useState, useEffect } from "react";
import { extractChordsFromNotes } from "../../utils/chordNotesParser";

interface ChordNotesEditorProps {
  slideIndex: number;
  slideTitle: string;
  lyrics: string;
  notesText: string;
  originalKey: string;
  onNotesChange: (newNotes: string) => void;
}

export const ChordNotesEditor: React.FC<ChordNotesEditorProps> = ({
  slideIndex,
  slideTitle,
  lyrics,
  notesText,
  originalKey,
  onNotesChange
}) => {
  const [localNotes, setLocalNotes] = useState(notesText || "");
  const uniqueChords = extractChordsFromNotes(localNotes);

  useEffect(() => {
    setLocalNotes(notesText || "");
  }, [notesText]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalNotes(newValue);
    onNotesChange(newValue);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">Notes Editor - {slideTitle}</h3>
        <div className="flex items-center space-x-4">
          <span className="text-xs text-gray-500">
            Chords: <span className="font-mono font-bold text-blue-600">{uniqueChords.length}</span>
          </span>
          <span className="text-xs text-gray-500">
            Key: <span className="font-mono font-bold text-blue-600">{originalKey}</span>
          </span>
        </div>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane: Lyrics Preview */}
        <div className="w-1/3 border-r border-gray-200 bg-gray-50/50 p-4 overflow-y-auto">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Slide Lyrics</h4>
          <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">
            {lyrics || "No lyrics for this slide."}
          </pre>
        </div>
        
        {/* Right Pane: Notes Editor */}
        <div className="flex-1 flex flex-col p-4 bg-white">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">ChordPro Notes</h4>
          <textarea
            value={localNotes}
            onChange={handleChange}
            placeholder="[Verse 1]&#10;[G]Amazing grace [how sweet the sound&#10;[D]That saved a wretch like me"
            className="flex-1 p-4 font-mono text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none outline-none bg-gray-50/30"
          />
          <div className="mt-3 flex items-center justify-between">
            <p className="text-[10px] text-gray-400 italic">
              Use [Chord] notation and [Section] headers.
            </p>
            <button
              onClick={() => {
                const formatted = localNotes.split('\n').map(l => l.trim()).join('\n');
                setLocalNotes(formatted);
                onNotesChange(formatted);
              }}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              Auto-format
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
