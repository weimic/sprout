import React, { useState } from 'react';
import { cn } from '@/lib/utils';

export interface IdeaCardProps {
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
  editable?: boolean; // controls whether the title is user-editable
  onDelete?: () => void; // delete handler
  isTrunk?: boolean; // special styling for trunk
}

function IdeaCard({
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
  editable = true,
  onDelete,
  isTrunk = false,
}: IdeaCardProps) {
  const [localExtraContext, setLocalExtraContext] = useState(extraContext);
  const titleRef = React.useRef<HTMLDivElement>(null);
  const isUserEditingRef = React.useRef(false);
  const showGenerateButton = isActive && localExtraContext.trim().length > 0;

  // Sync extraContext prop to local state when it changes externally (e.g., when switching between items)
  React.useEffect(() => {
    setLocalExtraContext(extraContext);
  }, [extraContext]);

  // Sync content prop to local state

  const handleExtraContextChange = (value: string) => {
    setLocalExtraContext(value);
    onExtraContextChange?.(value);
  };


  // Sync label to contentEditable when it changes externally (but NOT during user editing)
  React.useEffect(() => {
    if (titleRef.current && !isUserEditingRef.current && titleRef.current.textContent !== label) {
      titleRef.current.textContent = label;
    }
  }, [label]);

  return (
    <div
      className={cn(
        'rounded-xl border bg-white/95 shadow-sm hover:shadow-md transition-all relative group',
        className
      )}
      style={{ minWidth: 240, maxWidth: 360, padding: '0.9rem 1rem', ...style }}
    >
      {/* Delete button - only show if onDelete is provided and not trunk */}
      {onDelete && !isTrunk && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Delete this item and all its children?')) {
              onDelete();
            }
          }}
          className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 hover:scale-110 transition-all duration-200 flex items-center justify-center text-xs font-bold shadow-md z-10"
          title="Delete"
        >
          ×
        </button>
      )}
      
      <div
        ref={titleRef}
        contentEditable={editable}
        role="textbox"
        aria-label="Idea title"
        data-placeholder="Title"
        onFocus={() => {
          if (!editable) return;
          isUserEditingRef.current = true;
        }}
        onInput={(e) => {
          if (!editable) return;
          const text = (e.target as HTMLDivElement).textContent || '';
          onLabelChange(text);
        }}
        onBlur={(e) => {
          if (!editable) return;
          isUserEditingRef.current = false;
          const text = ((e.target as HTMLDivElement).textContent || '').trim();
          onLabelChange(text);
        }}
        onClick={(_) => {
          // Allow clicks on the title to bubble so the parent can focus/select the card
        }}
        suppressContentEditableWarning
        className={cn(
          'w-full bg-transparent font-semibold text-[1.05rem] outline-none break-words whitespace-pre-wrap min-h-[1.4em] cursor-text',
          editable && 'hover:bg-gray-50/50 rounded px-1 -mx-1',
          titleClassName
        )}
      >
        {label}
      </div>
      
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
}

export default React.memo(IdeaCard);
