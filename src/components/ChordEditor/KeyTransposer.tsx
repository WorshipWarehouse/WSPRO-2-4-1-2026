import React from "react";
import { RefreshCw, ArrowRight, Music } from "lucide-react";
import { calculateTransposition } from "../../utils/chordTransposer";

interface KeyTransposerProps {
  originalKey: string;
  transposedKey: string;
  onKeyChange: (original: string, transposed: string) => void;
}

const KEYS = ["C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B"];

export const KeyTransposer: React.FC<KeyTransposerProps> = ({
  originalKey,
  transposedKey,
  onKeyChange,
}) => {
  const semitones = calculateTransposition(originalKey, transposedKey);

  const handleOriginalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onKeyChange(e.target.value, transposedKey);
  };

  const handleTransposedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onKeyChange(originalKey, e.target.value);
  };

  const resetToOriginal = () => {
    onKeyChange(originalKey, originalKey);
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
        <Music className="w-4 h-4 text-blue-500" />
        Key Transposer
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Original Key</label>
          <select
            value={originalKey}
            onChange={handleOriginalChange}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
          >
            {KEYS.map((key) => (
              <option key={key} value={key}>{key}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-center pt-5">
          <ArrowRight className="w-4 h-4 text-gray-300" />
        </div>

        <div className="flex-1 flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Target Key</label>
          <select
            value={transposedKey}
            onChange={handleTransposedChange}
            className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm font-bold text-blue-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
          >
            {KEYS.map((key) => (
              <option key={key} value={key}>{key}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono px-2 py-1 rounded-full ${semitones === 0 ? "bg-gray-100 text-gray-500" : "bg-blue-100 text-blue-600"}`}>
            {semitones > 0 ? `+${semitones}` : semitones} semitones
          </span>
        </div>
        <button
          onClick={resetToOriginal}
          disabled={semitones === 0}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-gray-500 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Reset
        </button>
      </div>
    </div>
  );
};
