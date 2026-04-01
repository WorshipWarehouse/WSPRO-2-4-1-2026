import React from "react";
import { KeyTransposer } from "./KeyTransposer";
import { transposeChordNotes } from "../../utils/notesTransposer";

interface ChordNotesTransposerProps {
  notesText: string;
  originalKey: string;
  transposedKey: string;
  onKeyChange: (original: string, transposed: string) => void;
}

export const ChordNotesTransposer: React.FC<ChordNotesTransposerProps> = ({
  notesText,
  originalKey,
  transposedKey,
  onKeyChange
}) => {
  const transposedNotes = transposeChordNotes(notesText || "", originalKey, transposedKey);

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Transposition Settings</h4>
        <KeyTransposer
          originalKey={originalKey}
          transposedKey={transposedKey}
          onKeyChange={onKeyChange}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[400px]">
        <div className="flex flex-col border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Original</span>
            <span className="text-xs font-mono font-bold text-gray-600 bg-gray-200 px-2 py-0.5 rounded">{originalKey}</span>
          </div>
          <pre className="flex-1 p-4 text-xs font-mono text-gray-500 overflow-auto bg-gray-50/30 leading-relaxed">
            {notesText || "No notes to transpose."}
          </pre>
        </div>
        
        <div className="flex flex-col border border-blue-200 rounded-xl overflow-hidden bg-white shadow-sm">
          <div className="bg-blue-50 px-4 py-2 border-b border-blue-200 flex justify-between items-center">
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Transposed</span>
            <span className="text-xs font-mono font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">{transposedKey}</span>
          </div>
          <pre className="flex-1 p-4 text-xs font-mono text-blue-600 overflow-auto bg-blue-50/30 leading-relaxed">
            {transposedNotes || "No notes to transpose."}
          </pre>
        </div>
      </div>
    </div>
  );
};
