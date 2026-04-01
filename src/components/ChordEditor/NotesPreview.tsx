import React from "react";
import { parseChordsWithSectionHeaders } from "../../utils/chordNotesParser";
import { transposeChordNotes } from "../../utils/notesTransposer";
import { Copy } from "lucide-react";

interface NotesPreviewProps {
  notesText: string;
  originalKey: string;
  transposedKey: string;
}

export const NotesPreview: React.FC<NotesPreviewProps> = ({
  notesText,
  originalKey,
  transposedKey
}) => {
  const effectiveNotes = transposeChordNotes(notesText || "", originalKey, transposedKey);
  const sections = parseChordsWithSectionHeaders(effectiveNotes);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (!notesText) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 italic py-12">
        No notes to preview.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 max-w-2xl mx-auto">
      {sections.map((section, idx) => (
        <div key={idx} className="relative group bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <button
            onClick={() => copyToClipboard(`[${section.header}]\n${section.content}`)}
            className="absolute top-3 right-3 p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
            title="Copy section"
          >
            <Copy size={14} />
          </button>
          
          <h4 className="text-xs font-bold text-blue-600 mb-3 uppercase tracking-widest border-b border-blue-50 pb-2">
            {section.header}
          </h4>
          
          <div className="text-sm font-mono text-gray-700 whitespace-pre-wrap leading-relaxed">
            {section.content.split('\n').map((line, lIdx) => {
              const parts = line.split(/(\[[^\]]+\])/);
              return (
                <div key={lIdx} className="min-h-[1.5em]">
                  {parts.map((part, pIdx) => (
                    part.startsWith('[') && part.endsWith(']') ? (
                      <span key={pIdx} className="text-blue-600 font-bold bg-blue-50 px-1 rounded">{part}</span>
                    ) : (
                      <span key={pIdx}>{part}</span>
                    )
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
