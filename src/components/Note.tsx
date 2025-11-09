import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface NoteProps {
    text: string;
    onChange?: (text: string) => void;
    className?: string;
}

const Note: React.FC<NoteProps> = ({ text, onChange, className }) => {
    const [editText, setEditText] = useState(text);

    const handleTextChange = useCallback((newText: string) => {
        setEditText(newText);
        if (onChange) onChange(newText);
    }, [onChange]);

    return (
        <div
            className={cn(
                'rounded-lg border-2 border-yellow-400/50 bg-gradient-to-br from-yellow-100 to-yellow-200/90 shadow-md hover:shadow-lg transition-shadow',
                'backdrop-blur-sm',
                className
            )}
            style={{ minWidth: 180, maxWidth: 280, padding: '0.85rem' }}
        >
            <textarea
                value={editText}
                onChange={(e) => handleTextChange(e.target.value)}
                onBlur={(e) => handleTextChange(e.target.value.trim())}
                placeholder="Add a note..."
                className={cn(
                    'w-full bg-transparent text-sm outline-none resize-none',
                    'text-yellow-900 placeholder:text-yellow-700/50',
                    'font-handwriting min-h-[60px]'
                )}
                rows={3}
                onClick={(e) => e.stopPropagation()}
            />
        </div>
    );
};

export default Note;
