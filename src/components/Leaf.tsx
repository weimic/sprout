import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import IdeaCard from './IdeaCard';

interface LeafProps {
    label: string;
    onChange?: (label: string) => void;
    className?: string;
    extraContext?: string;
    onExtraContextChange?: (value: string) => void;
    onGenerateMore?: () => void;
    isGenerating?: boolean;
    isActive?: boolean;
}

const Leaf: React.FC<LeafProps> = ({ 
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
			className={cn("border-emerald-200/70", className)}
			titleClassName="text-emerald-900 placeholder:text-emerald-700/60"
			extraContext={extraContext}
			onExtraContextChange={onExtraContextChange}
			onGenerateMore={onGenerateMore}
			isGenerating={isGenerating}
			isActive={isActive}
		/>
	);
};

export default Leaf;