import React from 'react';
import { Library as LibraryIcon, Music, BookOpen, Languages, FileText, Trash2, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import type { LibraryItem, ActivePage } from '../../types';

interface LibraryPageProps {
  library: LibraryItem[];
  onLoadFromLibrary: (item: LibraryItem) => void;
  onRemoveFromLibrary: (id: string) => void;
  setActivePage: (page: ActivePage) => void;
}

export const LibraryPage: React.FC<LibraryPageProps> = ({ library, onLoadFromLibrary, onRemoveFromLibrary, setActivePage }) => {
  return (
    <motion.div key="library" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => setActivePage('dashboard')} className="p-2 rounded-lg hover:bg-neutral-100 transition-colors">
          <ArrowLeft size={20} className="text-neutral-500" />
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900">Library</h2>
          <p className="text-neutral-500 text-sm">Manage saved songs and sermons.</p>
        </div>
        <div className="bg-neutral-100 px-4 py-1.5 rounded-full text-xs font-bold text-neutral-500 uppercase tracking-wider">
          {library.length} {library.length === 1 ? 'item' : 'items'}
        </div>
      </div>

      {library.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-neutral-200 rounded-2xl p-12 text-center space-y-4">
          <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto">
            <LibraryIcon size={28} className="text-neutral-300" />
          </div>
          <h3 className="text-lg font-bold text-neutral-900">Your library is empty</h3>
          <p className="text-sm text-neutral-500">Create a song or sermon to save it here.</p>
          <button onClick={() => setActivePage('dashboard')} className="px-5 py-2 bg-neutral-900 text-white rounded-lg text-sm font-semibold hover:bg-black transition-all">
            Go to Dashboard
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {library.map((item) => (
            <div key={item.id} className="bg-white p-5 rounded-xl border border-neutral-200 hover:border-neutral-400 transition-all group">
              <div className="flex items-center justify-between">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {item.type === 'song' ? <Music size={14} className="text-blue-500 shrink-0" /> : <BookOpen size={14} className="text-violet-500 shrink-0" />}
                    <h3 className="font-bold text-neutral-900 truncate">{item.title}</h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-neutral-400">
                    {item.type === 'song' ? (
                      <span className="flex items-center gap-1"><Languages size={12} /> {item.linesPerLanguage} Lines/Slide</span>
                    ) : (
                      <span className="flex items-center gap-1"><FileText size={12} /> {item.manuscript.length} chars</span>
                    )}
                    <span>&middot;</span>
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onLoadFromLibrary(item)}
                    className="px-4 py-2 bg-neutral-100 text-neutral-900 rounded-lg text-sm font-semibold hover:bg-neutral-900 hover:text-white transition-all"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => onRemoveFromLibrary(item.id)}
                    className="p-2 text-neutral-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};
