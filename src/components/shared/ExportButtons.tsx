import React from 'react';
import { Download, Presentation, Monitor, FileText } from 'lucide-react';

interface ExportButtonsProps {
  onExportPro7: () => void;
  onExportPPTX: () => void;
  onExportText?: () => void;
  layout?: 'horizontal' | 'vertical';
}

export const ExportButtons: React.FC<ExportButtonsProps> = ({ onExportPro7, onExportPPTX, onExportText, layout = 'vertical' }) => {
  const containerClass = layout === 'horizontal' 
    ? 'flex flex-wrap gap-3' 
    : 'grid grid-cols-1 gap-2';

  return (
    <div className={containerClass}>
      <button 
        onClick={onExportPro7}
        className="flex items-center gap-3 px-5 py-3 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-black transition-all group"
      >
        <Presentation size={16} />
        <span>ProPresenter 7</span>
        <Download size={14} className="ml-auto opacity-50 group-hover:opacity-100 transition-opacity" />
      </button>
      <button 
        onClick={onExportPPTX}
        className="flex items-center gap-3 px-5 py-3 bg-white border border-neutral-200 text-neutral-900 rounded-xl text-sm font-semibold hover:border-neutral-900 transition-all group"
      >
        <Monitor size={16} />
        <span>PowerPoint</span>
        <Download size={14} className="ml-auto opacity-50 group-hover:opacity-100 transition-opacity" />
      </button>
      {onExportText && (
        <button 
          onClick={onExportText}
          className="flex items-center gap-3 px-5 py-3 bg-white border border-neutral-200 text-neutral-900 rounded-xl text-sm font-semibold hover:border-neutral-900 transition-all group"
        >
          <FileText size={16} />
          <span>Plain Text</span>
          <Download size={14} className="ml-auto opacity-50 group-hover:opacity-100 transition-opacity" />
        </button>
      )}
    </div>
  );
};
