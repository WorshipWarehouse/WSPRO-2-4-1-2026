import React, { useState, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { saveAs } from 'file-saver';
import { Languages, Music, Plus, ChevronDown, ChevronUp, ArrowLeft, Settings, Info, Upload } from 'lucide-react';
import { motion } from 'motion/react';
import pptxgen from 'pptxgenjs';
import { ExportButtons } from '../shared/ExportButtons';
import { SongSlidePreview } from '../shared/SlidePreview';
import { writePresentation } from '../../lib/pro7-writer';
import { parseChordProLine } from '../../utils/chordProLine';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import type { Slide, SongData, AppUser, ActivePage } from '../../types';

interface MultilingualPageProps {
  user: AppUser | null;
  setActivePage: (page: ActivePage) => void;
  initialData?: {
    title: string;
    key: string;
    ccliInfo: string;
    primaryText: string;
    secondaryText: string;
    linesPerLanguage: number;
  };
}

export const MultilingualPage: React.FC<MultilingualPageProps> = ({ user, setActivePage, initialData }) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [key, setKey] = useState(initialData?.key || '');
  const [ccliInfo, setCcliInfo] = useState(initialData?.ccliInfo || '');
  const [primaryText, setPrimaryText] = useState(initialData?.primaryText || '');
  const [secondaryText, setSecondaryText] = useState(initialData?.secondaryText || '');
  const [linesPerLanguage, setLinesPerLanguage] = useState(initialData?.linesPerLanguage || 2);
  const [showPreview, setShowPreview] = useState(false);
  const [exportMode, setExportMode] = useState<'native-chords' | 'stage-notes'>('native-chords');

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setKey(initialData.key);
      setCcliInfo(initialData.ccliInfo);
      setPrimaryText(initialData.primaryText);
      setSecondaryText(initialData.secondaryText);
      setLinesPerLanguage(initialData.linesPerLanguage);
    }
  }, [initialData]);

  useEffect(() => {
    const lines = primaryText.split('\n');
    let foundTitle = '';
    let foundKey = '';
    lines.forEach(line => {
      const trimmed = line.trim();
      const tagMatch = trimmed.match(/^\{(title|key|t|k):\s*(.*)\}$/i);
      if (tagMatch) {
        const tag = tagMatch[1].toLowerCase();
        const value = tagMatch[2].trim();
        if (tag === 'title' || tag === 't') foundTitle = value;
        if (tag === 'key' || tag === 'k') foundKey = value;
      }
    });
    if (foundTitle && foundTitle !== title) setTitle(foundTitle);
    if (foundKey && foundKey !== key) setKey(foundKey);
  }, [primaryText]);

  const handleChordProUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setPrimaryText(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const songData = useMemo((): SongData => {
    const isCcliLine = (line: string) =>
      line.startsWith('CCLI Song #') || line.startsWith('©') || line.startsWith('CCLI License #') || line.startsWith('For use solely with');
    const isTag = (line: string) => line.startsWith('{') && line.endsWith('}') && !line.startsWith('{comment:');
    const primaryLinesRaw = primaryText.split('\n').map(l => l.trim()).filter(l => l !== '' && !isTag(l) && !isCcliLine(l));
    const secondaryLinesRaw = secondaryText.split('\n').map(l => l.trim()).filter(l => l !== '' && !isTag(l) && !isCcliLine(l));

    const slides: Slide[] = [];
    let currentSection = 'Verse 1';
    let pIdx = 0;
    let sIdx = 0;

    const isSection = (line: string) =>
      (line.startsWith('[') && line.endsWith(']')) || line.startsWith('#') || (line.startsWith('{comment:') && line.endsWith('}'));

    while (pIdx < primaryLinesRaw.length || sIdx < secondaryLinesRaw.length) {
      const pLineRaw = primaryLinesRaw[pIdx] || '';
      const sLineRaw = secondaryLinesRaw[sIdx] || '';

      if (isSection(pLineRaw)) {
        if (pLineRaw.startsWith('#')) currentSection = pLineRaw.slice(1).trim();
        else if (pLineRaw.startsWith('{comment:')) currentSection = pLineRaw.slice(9, -1).trim();
        else currentSection = pLineRaw.slice(1, -1);
        pIdx++;
        if (isSection(sLineRaw)) sIdx++;
        continue;
      }
      if (isSection(sLineRaw)) { sIdx++; continue; }

      const pBatch: string[] = [];
      const sBatch: string[] = [];
      const chordsBatch: { chord: string; index: number }[] = [];
      const stageNotesBatch: string[] = [];
      const chordsTextBatch: string[] = [];
      let currentLyricsOffset = 0;

      for (let i = 0; i < linesPerLanguage; i++) {
        if (pIdx < primaryLinesRaw.length) {
          const nextP = primaryLinesRaw[pIdx];
          if (isSection(nextP)) break;
          const { lyrics, chords } = parseChordProLine(nextP);
          pBatch.push(lyrics);
          chords.forEach(c => chordsBatch.push({ chord: c.chord, index: currentLyricsOffset + c.index }));
          if (chords.length > 0) {
            let chordLine = "";
            let lastPos = 0;
            chords.forEach(c => { const spaces = Math.max(0, c.index - lastPos); chordLine += " ".repeat(spaces) + c.chord; lastPos = c.index + c.chord.length; });
            stageNotesBatch.push(chordLine);
          }
          stageNotesBatch.push(lyrics);
          chordsTextBatch.push(nextP);
          currentLyricsOffset += lyrics.length + 1;
          pIdx++;
        }
        if (sIdx < secondaryLinesRaw.length) {
          const nextS = secondaryLinesRaw[sIdx];
          if (isSection(nextS)) break;
          const { lyrics } = parseChordProLine(nextS);
          sBatch.push(lyrics);
          sIdx++;
        }
      }

      if (pBatch.length > 0 || sBatch.length > 0) {
        slides.push({
          id: uuidv4(),
          section: currentSection,
          primaryLines: pBatch,
          secondaryLines: sBatch,
          chordsText: chordsTextBatch.join('\n'),
          chords: exportMode === 'native-chords' ? chordsBatch : [],
          notes: exportMode === 'stage-notes' ? stageNotesBatch.join('\n') : '',
        });
      }
    }
    return { title, artist: '', key, slides };
  }, [title, key, primaryText, secondaryText, linesPerLanguage, exportMode]);

  const exportPro7 = () => {
    if (songData.slides.length === 0) { alert('Enter lyrics first.'); return; }
    const settings = {
      presentationName: songData.title || 'Song',
      fontFamily: exportMode === 'stage-notes' ? 'Helvetica' : 'Arial',
      fontSize: exportMode === 'stage-notes' ? 130 : 50,
      backgroundColor: '#000000',
      textColor: '#ffffff',
      hideChordsFromAudience: exportMode === 'stage-notes',
    };
    const writerSlides = songData.slides.map(s => ({
      group: s.section,
      primaryText: s.primaryLines.join('\n'),
      secondaryText: s.secondaryLines.join('\n'),
      chordsText: s.chordsText,
      chords: s.chords,
      notes: s.notes,
    }));
    const presentationWriter = writePresentation(writerSlides, settings);
    const blob = new Blob([presentationWriter.toBytes()], { type: 'application/octet-stream' });
    saveAs(blob, `${songData.title || 'Song'}.pro`);
  };

  const exportPPTX = () => {
    const pres = new pptxgen();
    pres.layout = 'LAYOUT_WIDE';
    songData.slides.forEach(slide => {
      const pSlide = pres.addSlide();
      pSlide.background = { color: '1A1A1A' };
      pSlide.addText(slide.primaryLines.join('\n'), {
        x: 0, y: '10%', w: '100%', h: '40%', align: 'center', valign: 'middle', color: 'FFFFFF', fontSize: 44, fontFace: 'Arial', bold: true,
      });
      if (slide.secondaryLines.length > 0) {
        pSlide.addShape(pres.ShapeType.line, { x: '45%', y: '50%', w: '10%', h: 0, line: { color: 'FFFFFF', width: 1, transparency: 80 } });
        pSlide.addText(slide.secondaryLines.join('\n'), {
          x: 0, y: '55%', w: '100%', h: '35%', align: 'center', valign: 'middle', color: '8E8E8E', fontSize: 32, fontFace: 'Arial', italic: true,
        });
      }
      pSlide.addText(slide.section, { x: '5%', y: '5%', w: '20%', h: '5%', fontSize: 12, color: '8E8E8E', fontFace: 'Arial' });
    });
    pres.writeFile({ fileName: `${songData.title || 'Song'}.pptx` });
  };

  const exportText = () => {
    let content = `{title: ${songData.title}}\n`;
    if (key) content += `{key: ${key}}\n`;
    content += '\n';
    let lastSection = '';
    songData.slides.forEach(slide => {
      if (slide.section !== lastSection) { content += `{comment: ${slide.section}}\n`; lastSection = slide.section; }
      if (exportMode === 'stage-notes' && slide.notes) content += slide.notes + '\n';
      else if (slide.chordsText) content += slide.chordsText + '\n';
      else content += slide.primaryLines.join('\n') + '\n';
      if (slide.secondaryLines.length > 0) content += slide.secondaryLines.join('\n') + '\n';
      content += '\n';
    });
    if (ccliInfo) content += `\n${ccliInfo}\n`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `${songData.title || 'Song'}.txt`);
  };

  const addToLibrary = async () => {
    if (!user) return;
    try {
      const id = uuidv4();
      await setDoc(doc(db, 'library', id), {
        type: 'song', id, userId: user.uid, title: title || 'Untitled', key, ccliInfo, artist: '',
        primaryText, secondaryText, linesPerLanguage, mode: 'multilingual', createdAt: new Date().toISOString(),
      });
      alert('Song added to library!');
    } catch { alert('Failed to save to library.'); }
  };

  return (
    <motion.div key="multilingual" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => setActivePage('dashboard')} className="p-2 rounded-lg hover:bg-neutral-100 transition-colors">
          <ArrowLeft size={20} className="text-neutral-500" />
        </button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900">Multilingual Mode</h2>
          <p className="text-neutral-500 text-sm">Create bilingual slides with ChordPro support and stage chord notes.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-5">
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-2"><Info size={12} /> Song Details</h3>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1 uppercase">Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900/5" placeholder="Song Title" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1 uppercase">Key</label>
              <input type="text" value={key} onChange={e => setKey(e.target.value)} className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900/5" placeholder="e.g. E" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1 uppercase">CCLI Info</label>
              <textarea value={ccliInfo} onChange={e => setCcliInfo(e.target.value)} className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900/5 font-mono text-xs h-20 resize-none" placeholder="Paste CCLI info here..." />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-neutral-200 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-2"><Settings size={12} /> Settings</h3>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-2 uppercase">Lines Per Slide</label>
              <div className="flex gap-2">
                {[1, 2, 3].map(n => (
                  <button key={n} onClick={() => setLinesPerLanguage(n)} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${linesPerLanguage === n ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'}`}>{n}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-2 uppercase">Chord Export Mode</label>
              <div className="flex gap-1 bg-neutral-100 p-1 rounded-lg">
                <button onClick={() => setExportMode('native-chords')} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${exportMode === 'native-chords' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500'}`}>Native Chords</button>
                <button onClick={() => setExportMode('stage-notes')} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${exportMode === 'stage-notes' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500'}`}>Stage Notes</button>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-neutral-200 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Export</h3>
            <ExportButtons onExportPro7={exportPro7} onExportPPTX={exportPPTX} onExportText={exportText} />
          </div>

          <button onClick={addToLibrary} className="w-full py-3 bg-white border border-neutral-200 text-neutral-900 rounded-xl font-semibold hover:bg-neutral-50 transition-all flex items-center justify-center gap-2 text-sm">
            <Plus size={16} /> Add to Library
          </button>
        </div>

        <div className="lg:col-span-8 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-2"><Languages size={14} /> Lyrics</h3>
              <label className="flex items-center gap-2 px-3 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-semibold cursor-pointer hover:bg-neutral-50 transition-all">
                <Upload size={14} /> Upload ChordPro
                <input type="file" accept=".cho,.chordpro,.chopro,.txt" className="hidden" onChange={handleChordProUpload} />
              </label>
              <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded">CHORD PRO SUPPORTED</span>
            </div>
            <button onClick={() => setShowPreview(!showPreview)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors">
              {showPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-400 uppercase">Primary Language</span>
                <span className="text-[10px] font-bold bg-neutral-100 px-2 py-0.5 rounded text-neutral-500">TOP</span>
              </div>
              <textarea value={primaryText} onChange={e => setPrimaryText(e.target.value)} className="w-full h-[450px] p-5 bg-white border border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-neutral-900/5 font-mono text-sm leading-relaxed resize-none shadow-sm" placeholder="Paste primary lyrics (ChordPro supported)..." />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-400 uppercase">Secondary Language</span>
                <span className="text-[10px] font-bold bg-neutral-100 px-2 py-0.5 rounded text-neutral-500">BOTTOM</span>
              </div>
              <textarea value={secondaryText} onChange={e => setSecondaryText(e.target.value)} className="w-full h-[450px] p-5 bg-white border border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-neutral-900/5 font-mono text-sm leading-relaxed resize-none shadow-sm" placeholder="Paste secondary lyrics..." />
            </div>
          </div>

          {showPreview && songData.slides.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Slide Preview &middot; {songData.slides.length} slides</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {songData.slides.map((slide, idx) => (
                  <SongSlidePreview key={slide.id} slide={slide} index={idx} mode="multilingual" />
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
