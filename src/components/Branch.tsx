import React, { useState, useCallback } from 'react';
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
}) => {
  const [editLabel, setEditLabel] = useState(label);

  const handleLabelChange = useCallback((newLabel: string) => {
    setEditLabel(newLabel);
    if (onChange) onChange(newLabel);
  }, [onChange]);

  return (
    <IdeaCard
      label={editLabel}
      onLabelChange={handleLabelChange}
      style={{ minWidth: 260, maxWidth: 380 }}
      className={cn('border-amber-200/70', className)}
      titleClassName="text-amber-900 placeholder:text-amber-800/60"
      extraContext={extraContext}
      onExtraContextChange={onExtraContextChange}
      onGenerateMore={onGenerateMore}
      isGenerating={isGenerating}
      isActive={isActive}
    />
  );
};

export default Branch;
