import React, { useState } from "react";
import { Copy, Check, Printer, ExternalLink } from "lucide-react";
import { parseChordProLine } from "../../utils/chordParser";
import { transposeChord, calculateTransposition } from "../../utils/chordTransposer";

interface ChordPreviewProps {
  lyrics: string;
  originalKey: string;
  transposedKey: string;
  title: string;
}

export const ChordPreview: React.FC<ChordPreviewProps> = ({
  lyrics,
  originalKey,
  transposedKey,
  title,
}) => {
  const [copied, setCopied] = useState(false);
  const semitones = calculateTransposition(originalKey, transposedKey);
  const preferFlats = ["F", "Bb", "Eb", "Ab", "Db", "Gb"].includes(transposedKey);

  const handleCopy = () => {
    const cleanText = lyrics.replace(/\[([^\]]+)\]/g, (match, chord) => {
      return `[${transposeChord(chord, semitones, preferFlats)}]`;
    });
    navigator.clipboard.writeText(cleanText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const renderLine = (line: string, i: number) => {
    const { lyrics: lineLyrics, chords } = parseChordProLine(line);
    
    if (chords.length === 0) {
      return (
        <div key={i} className="min-h-[1.5rem] text-gray-800 font-medium">
          {lineLyrics || <br />}
        </div>
      );
    }

    // Render chords above lyrics
    return (
      <div key={i} className="relative mt-4 mb-1">
        <div className="flex relative h-5 font-bold text-blue-700 text-xs">
          {chords.map((chord, j) => (
            <span
              key={j}
              className="absolute"
              style={{ left: `${chord.index * 0.6}rem` }}
            >
              {transposeChord(chord.chord, semitones, preferFlats)}
            </span>
          ))}
        </div>
        <div className="text-gray-900 font-medium whitespace-pre">
          {lineLyrics}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm print:border-none print:shadow-none">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-bottom border-gray-200 print:hidden">
        <span className="text-sm font-medium text-gray-700">Stage Preview</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-gray-200 transition-colors text-gray-500"
            title="Copy ChordPro to clipboard"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={handlePrint}
            className="p-1.5 rounded hover:bg-gray-200 transition-colors text-gray-500"
            title="Print sheet"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-auto bg-white font-sans print:p-0">
        <div className="max-w-3xl mx-auto">
          <div className="border-b-2 border-gray-100 pb-4 mb-6 flex items-end justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{title || "Untitled Song"}</h1>
              <p className="text-sm text-gray-500 font-medium">Key: {transposedKey}</p>
            </div>
            <div className="text-right text-[10px] text-gray-400 uppercase tracking-widest font-bold">
              WorshipSlides Chord Sheet
            </div>
          </div>

          <div className="space-y-1">
            {lyrics.split("\n").map((line, i) => renderLine(line, i))}
          </div>
        </div>
      </div>
    </div>
  );
};
