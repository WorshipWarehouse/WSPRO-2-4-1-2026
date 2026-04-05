import React from 'react';

export const FormattedText: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  
  return (
    <div className={className}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
};
