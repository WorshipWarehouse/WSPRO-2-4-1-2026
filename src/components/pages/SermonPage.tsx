import React, { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { saveAs } from 'file-saver';
import { BookOpen, FileText, Cloud, Plus, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import pptxgen from 'pptxgenjs';
import { ExportButtons } from '../shared/ExportButtons';
import { SermonSlidePreview } from '../shared/SlidePreview';
import { writePresentation } from '../../lib/pro7-writer';
import { libraryApi } from '../../lib/api';
import type { SermonSlide, AppUser, ActivePage } from '../../types';

interface SermonPageProps {
  user: AppUser | null;
  setActivePage: (page: ActivePage) => void;
}

export const SermonPage: React.FC<SermonPageProps> = ({ user, setActivePage }) => {
  const [sermonTitle, setSermonTitle] = useState('');
  const [sermonManuscript, setSermonManuscript] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const sermonSlides = useMemo((): SermonSlide[] => {
    const slides: SermonSlide[] = [];
    const regex = /\[(.*?)\]/gs;
    let match;
    let index = 0;
    while ((match = regex.exec(sermonManuscript)) !== null) {
      if (match[1].trim()) {
        slides.push({ id: uuidv4(), content: match[1].trim(), index: index++ });
      }
    }
    return slides;
  }, [sermonManuscript]);

  const exportSermonPro7 = () => {
    if (sermonSlides.length === 0) { alert('Add [bracketed] text to create slides.'); return; }
    const settings = {
      presentationName: sermonTitle || 'Sermon',
      fontFamily: 'Arial',
      fontSize: 50,
      backgroundColor: '#000000',
      textColor: '#ffffff',
    };
    const writerSlides = sermonSlides.map((s) => ({ group: 'Sermon', primaryText: s.content, secondaryText: '' }));
    const presentationWriter = writePresentation(writerSlides, settings);
    const blob = new Blob([presentationWriter.toBytes()], { type: 'application/octet-stream' });
    saveAs(blob, `${sermonTitle || 'Sermon'}.pro`);
  };

  const exportSermonPPTX = () => {
    if (sermonSlides.length === 0) { alert('Add [bracketed] text to create slides.'); return; }
    const pres = new pptxgen();
    pres.layout = 'LAYOUT_WIDE';
    sermonSlides.forEach((slide) => {
      const pSlide = pres.addSlide();
      pSlide.background = { color: '1A1A1A' };
      pSlide.addText(slide.content, {
        x: '10%', y: '10%', w: '80%', h: '80%',
        align: 'center', valign: 'middle', color: 'FFFFFF',
        fontSize: 44, fontFace: 'Arial', bold: true,
      });
    });
    pres.writeFile({ fileName: `${sermonTitle || 'Sermon'}.pptx` });
  };

  const addToLibrary = async () => {
    if (!user) return;
    try {
      await libraryApi.save({
        type: 'sermon',
        id: uuidv4(),
        title: sermonTitle || 'Untitled Sermon',
        manuscript: sermonManuscript,
      });
      alert('Sermon added to library!');
    } catch {
      alert('Failed to save to library.');
    }
  };

  return (
    <motion.div
      key="sermon"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8"
    >
      <div className="flex items-center gap-4">
        <button onClick={() => setActivePage('dashboard')} className="p-2 rounded-lg hover:bg-neutral-100 transition-colors">
          <ArrowLeft size={20} className="text-neutral-500" />
        </button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900">Sermon Mode</h2>
          <p className="text-neutral-500 text-sm">Paste your manuscript and wrap slide content in [brackets].</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-5">
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Sermon Details</h3>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1 uppercase">Title</label>
              <input
                type="text"
                value={sermonTitle}
                onChange={(e) => setSermonTitle(e.target.value)}
                className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900/5 transition-all"
                placeholder="Sermon Title"
              />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-neutral-200 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Formatting</h3>
            <ul className="space-y-2 text-sm text-neutral-600">
              <li className="flex items-start gap-2"><div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-neutral-900" /><span>Bracketed text <code className="bg-neutral-100 px-1.5 py-0.5 rounded text-xs">[...]</code> becomes a slide.</span></li>
              <li className="flex items-start gap-2"><div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-neutral-900" /><span>Non-bracketed text is ignored for slides.</span></li>
            </ul>
            <div className="pt-3 border-t border-neutral-100 text-center">
              <p className="text-3xl font-light text-neutral-900">{sermonSlides.length}</p>
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">Detected Slides</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-neutral-200 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Export</h3>
            <ExportButtons onExportPro7={exportSermonPro7} onExportPPTX={exportSermonPPTX} />
          </div>

          <button
            onClick={addToLibrary}
            className="w-full py-3 bg-white border border-neutral-200 text-neutral-900 rounded-xl font-semibold hover:bg-neutral-50 transition-all flex items-center justify-center gap-2 text-sm"
          >
            <Plus size={16} /> Add to Library
          </button>
        </div>

        {/* Editor / Preview */}
        <div className="lg:col-span-8 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                <FileText size={14} /> Manuscript
              </h3>
              <label className="flex items-center gap-2 px-3 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-semibold cursor-pointer hover:bg-neutral-50 transition-all">
                <Cloud size={14} /> Upload .txt
                <input type="file" accept=".txt" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) { const reader = new FileReader(); reader.onload = (ev) => setSermonManuscript(ev.target?.result as string); reader.readAsText(file); }
                }} />
              </label>
            </div>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              {showPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </button>
          </div>

          <div className="relative">
            <textarea
              value={sermonManuscript}
              onChange={(e) => setSermonManuscript(e.target.value)}
              className="w-full h-[500px] p-6 bg-white border border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-neutral-900/5 transition-all font-mono text-sm leading-relaxed resize-none shadow-sm relative z-10 bg-transparent"
              placeholder="Paste your sermon manuscript here. Wrap slide content in [brackets]."
            />
            <div className="absolute inset-0 p-6 font-mono text-sm leading-relaxed pointer-events-none whitespace-pre-wrap break-words overflow-auto">
              {sermonManuscript.split(/(\[.*?\])/gs).map((part, i) => (
                <span key={i} className={part.startsWith('[') && part.endsWith(']') ? 'bg-amber-100 text-amber-800 rounded px-0.5 font-bold border border-amber-200' : 'text-transparent'}>
                  {part}
                </span>
              ))}
            </div>
          </div>

          {showPreview && sermonSlides.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Slide Preview</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {sermonSlides.map((slide, idx) => (
                  <SermonSlidePreview key={slide.id} slide={slide} index={idx} />
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
