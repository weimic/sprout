import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface IdeaCardProps {
  label: string;
  onLabelChange: (newLabel: string) => void;
  style?: React.CSSProperties;
  className?: string;
  titleClassName?: string;
  extraContext?: string;
  onExtraContextChange?: (value: string) => void;
  onGenerateMore?: () => void;
  isGenerating?: boolean;
  isActive?: boolean;
}

const IdeaCard: React.FC<IdeaCardProps> = ({
  label,
  onLabelChange,
  style,
  className,
  titleClassName,
  extraContext = '',
  onExtraContextChange,
  onGenerateMore,
  isGenerating = false,
  isActive = false,
}) => {
  const [localExtraContext, setLocalExtraContext] = useState(extraContext);
  const showGenerateButton = isActive && localExtraContext.trim().length > 0;

  const handleExtraContextChange = (value: string) => {
    setLocalExtraContext(value);
    onExtraContextChange?.(value);
  };

  return (
    <div
      className={cn(
        'rounded-xl border bg-white/95 shadow-sm hover:shadow-md transition-colors',
        className
      )}
      style={{ minWidth: 240, maxWidth: 360, padding: '0.9rem 1rem', ...style }}
    >
      <div
        contentEditable
        role="textbox"
        aria-label="Idea title"
        data-placeholder="Title"
        onInput={(e) => onLabelChange((e.target as HTMLDivElement).innerText)}
        onBlur={(e) => onLabelChange((e.target as HTMLDivElement).innerText.trim())}
        suppressContentEditableWarning
        className={cn(
          'w-full bg-transparent font-semibold text-[1.05rem] outline-none break-words whitespace-pre-wrap min-h-[1.4em]',
          titleClassName
        )}
        dangerouslySetInnerHTML={{ __html: label }}
      />
      
      {isActive && (
        <div className="mt-3 pt-3 border-t border-gray-200/50 space-y-2">
          <textarea
            placeholder="Add context to refine (tone, constraints, direction...)..."
            value={localExtraContext}
            onChange={(e) => handleExtraContextChange(e.target.value)}
            className="w-full text-xs rounded-md border border-gray-200 bg-gray-50/50 px-2 py-1.5 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none"
            rows={2}
            onClick={(e) => e.stopPropagation()}
          />
          {showGenerateButton && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onGenerateMore?.();
              }}
              disabled={isGenerating}
              className="w-full text-xs px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm transition-colors"
            >
              {isGenerating ? 'Generating...' : 'Generate More Ideas'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default IdeaCard;
