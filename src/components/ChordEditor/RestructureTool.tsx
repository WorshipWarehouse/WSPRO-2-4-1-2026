
import React, { useState, useRef } from 'react';
import { Upload, Download, FileText, CheckCircle, AlertCircle, Loader2, ArrowRight, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { restructurePro7 } from '../../utils/pro7Restructurer';

export const RestructureTool: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.pro')) {
        setFile(selectedFile);
        setResult(null);
        setError(null);
      } else {
        setError('Please select a valid .pro file.');
      }
    }
  };

  const processFile = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const restructured = await restructurePro7(buffer);
      setResult(restructured);
    } catch (err: any) {
      console.error('Restructure error:', err);
      setError(err.message || 'An error occurred while restructuring the file.');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadResult = () => {
    if (!result || !file) return;

    const blob = new Blob([result], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name.replace('.pro', '_restructured.pro');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      <div className="bg-white p-8 rounded-[40px] border border-[#E0E0E0] shadow-sm space-y-6">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
            <FileText size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Pro7 Restructure Tool</h2>
            <p className="text-[#8E8E8E] text-sm">Move chords from display layers to slide notes for musicians.</p>
          </div>
        </div>

        <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-3xl space-y-3">
          <div className="flex items-center gap-2 text-blue-700 font-bold text-sm">
            <Info size={16} />
            <span>How it works</span>
          </div>
          <ul className="text-sm text-blue-600/80 space-y-2 list-disc pl-5">
            <li>Identifies <strong>"Primary Language"</strong> (lyrics) and <strong>"Stage Display (Chords)"</strong> layers.</li>
            <li>Extracts chords from the stage layer and moves them to <strong>Slide Notes</strong>.</li>
            <li>Removes the visual chord layer to keep the audience screen clean.</li>
            <li>Updates lyrics font to <strong>Helvetica</strong> (size 130) for better readability.</li>
            <li>Preserves all transitions, timings, and slide organization.</li>
          </ul>
        </div>

        <div className="space-y-4">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all ${
              file ? 'border-blue-500 bg-blue-50/30' : 'border-[#E0E0E0] hover:border-blue-400 hover:bg-gray-50'
            }`}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept=".pro"
            />
            {file ? (
              <div className="space-y-2">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={32} />
                </div>
                <p className="font-bold text-lg">{file.name}</p>
                <p className="text-sm text-[#8E8E8E]">{(file.size / 1024).toFixed(1)} KB</p>
                <button 
                  onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); }}
                  className="text-xs text-red-500 font-bold hover:underline mt-2"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-16 h-16 bg-gray-100 text-[#8E8E8E] rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Upload size={32} />
                </div>
                <p className="font-bold text-lg">Click to upload .pro file</p>
                <p className="text-sm text-[#8E8E8E]">Drag and drop your ProPresenter 7 presentation here</p>
              </div>
            )}
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-medium">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-center pt-4">
            {!result ? (
              <button
                disabled={!file || isProcessing}
                onClick={processFile}
                className={`px-12 py-4 rounded-2xl font-bold text-lg flex items-center gap-3 transition-all ${
                  !file || isProcessing 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'bg-[#1A1A1A] text-white hover:bg-black shadow-lg hover:shadow-xl active:scale-95'
                }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ArrowRight size={20} />
                    Restructure File
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={downloadResult}
                className="px-12 py-4 bg-green-600 text-white rounded-2xl font-bold text-lg flex items-center gap-3 hover:bg-green-700 shadow-lg hover:shadow-xl active:scale-95 transition-all"
              >
                <Download size={20} />
                Download Restructured File
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-gray-50 p-8 rounded-[40px] border border-[#E0E0E0] space-y-4">
        <h3 className="font-bold text-lg">Why use this tool?</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="font-bold text-sm text-[#1A1A1A]">Clean Audience View</div>
            <p className="text-xs text-[#8E8E8E] leading-relaxed">
              Remove visual clutter from the main screen. Chords are essential for musicians but distracting for the congregation.
            </p>
          </div>
          <div className="space-y-2">
            <div className="font-bold text-sm text-[#1A1A1A]">Musician Support</div>
            <p className="text-xs text-[#8E8E8E] leading-relaxed">
              Stage operators and musicians can see exact chord placements in the slide notes on their monitors.
            </p>
          </div>
          <div className="space-y-2">
            <div className="font-bold text-sm text-[#1A1A1A]">Standardized Format</div>
            <p className="text-xs text-[#8E8E8E] leading-relaxed">
              Automatically applies Helvetica typography and consistent sizing across your entire presentation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
