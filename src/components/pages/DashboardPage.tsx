import React from 'react';
import { BookOpen, Languages, Music, Library as LibraryIcon, User, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import type { ActivePage, LibraryItem } from '../../types';

interface DashboardPageProps {
  setActivePage: (page: ActivePage) => void;
  library: LibraryItem[];
  onLoadFromLibrary: (item: LibraryItem) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ setActivePage, library, onLoadFromLibrary }) => {
  const quickLinks = [
    {
      page: 'sermon' as ActivePage,
      icon: BookOpen,
      title: 'Sermon Mode',
      description: 'Generate slides from your sermon manuscript using bracketed text.',
      color: 'bg-violet-50 text-violet-600',
      accent: 'violet',
    },
    {
      page: 'multilingual' as ActivePage,
      icon: Languages,
      title: 'Multilingual Mode',
      description: 'Create bilingual slides with automatic alignment, chords, and stage notes.',
      color: 'bg-blue-50 text-blue-600',
      accent: 'blue',
    },
    {
      page: 'stage-chord' as ActivePage,
      icon: Music,
      title: 'Stage Chord Mode',
      description: 'Single-language slides with ChordPro chord charts in slide notes.',
      color: 'bg-emerald-50 text-emerald-600',
      accent: 'emerald',
    },
  ];

  return (
    <motion.div
      key="dashboard"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-10"
    >
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-neutral-900">Welcome back</h2>
        <p className="text-neutral-500">Choose a mode to get started or pick up where you left off.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {quickLinks.map((link) => (
          <button
            key={link.page}
            onClick={() => setActivePage(link.page)}
            className="bg-white p-8 rounded-2xl border border-neutral-200 hover:border-neutral-400 hover:shadow-lg transition-all text-left group"
          >
            <div className={`w-12 h-12 ${link.color} rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
              <link.icon size={22} />
            </div>
            <h3 className="text-lg font-bold mb-1.5 text-neutral-900">{link.title}</h3>
            <p className="text-neutral-500 text-sm leading-relaxed">{link.description}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <button
          onClick={() => setActivePage('library')}
          className="bg-white p-6 rounded-2xl border border-neutral-200 hover:border-neutral-400 hover:shadow-lg transition-all text-left group flex items-center gap-5"
        >
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <LibraryIcon size={22} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-neutral-900">Library</h3>
            <p className="text-neutral-500 text-sm">Access your saved songs and sermons.</p>
          </div>
        </button>

        <button
          onClick={() => setActivePage('profile')}
          className="bg-white p-6 rounded-2xl border border-neutral-200 hover:border-neutral-400 hover:shadow-lg transition-all text-left group flex items-center gap-5"
        >
          <div className="w-12 h-12 bg-neutral-100 text-neutral-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <User size={22} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-neutral-900">Profile &amp; Subscription</h3>
            <p className="text-neutral-500 text-sm">Manage your account, plan, and team.</p>
          </div>
        </button>
      </div>

      {library.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
            <Plus size={14} /> Recent Activity
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {library.slice(0, 4).map((item) => (
              <div
                key={item.id}
                onClick={() => onLoadFromLibrary(item)}
                className="p-4 bg-white rounded-xl border border-neutral-200 hover:border-neutral-400 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${item.type === 'song' ? 'bg-blue-50 text-blue-600' : 'bg-violet-50 text-violet-600'}`}>
                    {item.type === 'song' ? <Music size={14} /> : <BookOpen size={14} />}
                  </div>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{item.type}</span>
                </div>
                <h4 className="font-bold text-sm truncate group-hover:text-blue-600 transition-colors">{item.title}</h4>
                <p className="text-[10px] text-neutral-400 mt-1">Saved {new Date(item.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};
