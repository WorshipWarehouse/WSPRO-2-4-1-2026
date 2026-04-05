import React from 'react';
import { Music } from 'lucide-react';
import { FormattedText } from './FormattedText';
import type { Slide, SermonSlide } from '../../types';

interface SongSlidePreviewProps {
  slide: Slide;
  index: number;
  mode: 'multilingual' | 'stage-chord';
  showChords?: boolean;
}

export const SongSlidePreview: React.FC<SongSlidePreviewProps> = ({ slide, index, mode, showChords = true }) => (
  <div className="space-y-3 group relative">
    <div className="absolute -top-3 left-4 bg-neutral-900 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full z-10">
      {slide.section} &middot; {index + 1}
    </div>
    <div className="aspect-video bg-neutral-900 rounded-2xl overflow-hidden shadow-lg flex flex-col items-center justify-center p-8 text-center">
      <div className="w-full space-y-4">
        <div className="space-y-1">
          {slide.primaryLines.map((line, i) => (
            <FormattedText key={i} text={line} className="text-white text-sm font-medium tracking-wide" />
          ))}
        </div>
        {mode === 'multilingual' && slide.secondaryLines.length > 0 && (
          <>
            <div className="w-12 h-[1px] bg-white/20 mx-auto" />
            <div className="space-y-1">
              {slide.secondaryLines.map((line, i) => (
                <FormattedText key={i} text={line} className="text-neutral-400 text-xs italic" />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
    {showChords && slide.chordsText && (
      <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
          <Music size={10} /> Stage Notes
        </p>
        <p className="font-mono text-xs text-emerald-800 whitespace-pre-wrap leading-relaxed">
          {slide.chordsText}
        </p>
      </div>
    )}
  </div>
);

interface SermonSlidePreviewProps {
  slide: SermonSlide;
  index: number;
}

export const SermonSlidePreview: React.FC<SermonSlidePreviewProps> = ({ slide, index }) => (
  <div className="group relative">
    <div className="absolute -top-3 left-4 bg-neutral-900 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full z-10">
      Slide {index + 1}
    </div>
    <div className="aspect-video bg-neutral-900 rounded-2xl overflow-hidden shadow-lg flex flex-col items-center justify-center p-8 text-center">
      <p className="text-white text-sm font-medium tracking-wide leading-relaxed">
        {slide.content}
      </p>
    </div>
  </div>
);
