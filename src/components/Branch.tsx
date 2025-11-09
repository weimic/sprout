import React from 'react';
import { cn } from '@/lib/utils';
import IdeaCard from './IdeaCard';

interface BranchProps {
  label: string;
  onChange?: (label: string) => void;
  className?: string;
  extraContext?: string;
  onExtraContextChange?: (value: string) => void;
  onGenerateMore?: () => void;
  isGenerating?: boolean;
  isActive?: boolean;
  isTrunk?: boolean; // Identifies the root/trunk branch
  onDelete?: () => void;
}

const Branch: React.FC<BranchProps> = ({ 
  label, 
  onChange, 
  className,
  extraContext,
  onExtraContextChange,
  onGenerateMore,
  isGenerating,
  isActive,
  isTrunk = false,
  onDelete,
}) => {
  return (
    <IdeaCard
      label={label}
      onLabelChange={(newLabel) => onChange?.(newLabel)}
      style={{ minWidth: 260, maxWidth: 380 }}
      className={cn(
        isTrunk 
          ? 'border-amber-600/90 bg-gradient-to-br from-amber-100 to-amber-200/95 ring-2 ring-amber-500/40 shadow-lg' 
          : 'border-amber-200/70',
        className
      )}
      titleClassName={cn(
        isTrunk 
          ? 'text-amber-950 placeholder:text-amber-900/70 font-bold text-lg' 
          : 'text-amber-900 placeholder:text-amber-800/60'
      )}
      extraContext={extraContext}
      onExtraContextChange={onExtraContextChange}
      onGenerateMore={onGenerateMore}
      isGenerating={isGenerating}
      isActive={isActive}
      onDelete={onDelete}
      isTrunk={isTrunk}
      editable={false} // Titles are not editable, only context can be edited
    />
  );
};

export default React.memo(Branch);
