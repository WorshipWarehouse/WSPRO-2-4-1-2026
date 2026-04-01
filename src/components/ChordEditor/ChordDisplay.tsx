import React, { useState, useCallback } from "react";
import { parseChordProLine } from "../../utils/chordParser";
import { transposeChord } from "../../utils/chordTransposer";

interface ChordDisplayProps {
  lyrics: string;
  originalKey: string;
  transposedKey: string;
  onUpdateChord: (oldChord: string, newChord: string) => void;
}

export const ChordDisplay: React.FC<ChordDisplayProps> = ({
  lyrics,
  originalKey,
  transposedKey,
  onUpdateChord,
}) => {
  const [editingChord, setEditingChord] = useState<{ original: string; index: number } | null>(null);
  const [newChordValue, setNewChordValue] = useState("");

  const lines = lyrics.split("\n");

  const handleChordClick = (chord: string, index: number) => {
    setEditingChord({ original: chord, index });
    setNewChordValue(chord);
  };

  const handleChordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingChord) {
      onUpdateChord(editingChord.original, newChordValue);
      setEditingChord(null);
    }
  };

  const renderLine = (line: string, lineIdx: number) => {
    const { lyrics: lineLyrics, chords } = parseChordProLine(line);
    
    // If no chords, just render the lyrics
    if (chords.length === 0) {
      return (
        <div key={lineIdx} className="min-h-[2.5rem] flex items-end pb-1 text-gray-800">
          {lineLyrics || <br />}
        </div>
      );
    }

    // Render chords above lyrics
    return (
      <div key={lineIdx} className="relative mt-6 mb-2">
        {/* Chords Layer */}
        <div className="flex relative h-6 font-mono text-xs">
          {chords.map((chord, i) => {
            const semitones = 0; // We'll calculate this if needed
            const isTransposed = originalKey !== transposedKey;
            const transposed = transposeChord(chord.chord, 0); // Placeholder for display

            return (
              <div
                key={i}
                className="absolute group cursor-pointer"
                style={{ left: `${chord.index * 0.6}rem` }} // Rough estimation for monospace
                onClick={() => handleChordClick(chord.chord, i)}
              >
                <div className="flex flex-col items-center -translate-y-4">
                  <span className="text-blue-600 font-bold hover:bg-blue-50 px-1 rounded transition-colors">
                    {chord.chord}
                  </span>
                  {isTransposed && (
                    <span className="text-emerald-600 font-bold text-[10px]">
                      {transposeChord(chord.chord, 0)} {/* This should be the transposed version */}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {/* Lyrics Layer */}
        <div className="text-gray-800 whitespace-pre font-mono">
          {lineLyrics}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-bottom border-gray-200">
        <span className="text-sm font-medium text-gray-700">Chord View</span>
        <span className="text-[10px] text-gray-400 uppercase tracking-wider">Visual Preview</span>
      </div>
      <div className="flex-1 p-6 overflow-auto font-mono">
        {lines.map((line, i) => renderLine(line, i))}
      </div>

      {/* Chord Edit Modal/Overlay */}
      {editingChord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl shadow-xl border border-gray-200 w-full max-w-xs">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Edit Chord</h3>
            <form onSubmit={handleChordSubmit}>
              <input
                autoFocus
                type="text"
                value={newChordValue}
                onChange={(e) => setNewChordValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono text-lg mb-4"
                placeholder="e.g. Gmaj7"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingChord(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                >
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
