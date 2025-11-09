'use client';
import React from 'react';
import { Button } from '../ui/button';


interface ToolbarProps {
    onAddBranch: () => void;
    onAddLeaf: () => void;
    onAddNote: () => void;
    onCenter: () => void;
    onRefresh?: () => void;
    canRefresh?: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({ 
    onAddBranch, 
    onAddLeaf, 
    onAddNote, 
    onCenter, 
    onRefresh, 
    canRefresh = false
}) => {
    return (
        <div className="absolute top-4 left-4 bg-card p-4 rounded-lg shadow-md z-10">
            <div className="gap-3 flex flex-row items-center">
                <Button 
                    variant="outline"
                    onClick={onAddBranch}
                    className="px-4 py-2 cursor-pointer bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900 hover:text-amber-950 font-medium transition-all"
                    title="Add a new branch"
                >
                    Add Branch
                </Button>
                <Button 
                    variant="outline"
                    onClick={onAddLeaf}
                    className="px-4 py-2 cursor-pointer bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-900 hover:text-emerald-950 font-medium transition-all"
                    title="Add a new leaf"
                >
                    Add Leaf
                </Button>
                <Button 
                    variant="outline"
                    onClick={onAddNote}
                    className="px-4 py-2 cursor-pointer bg-yellow-50 hover:bg-yellow-100 border-yellow-400 text-yellow-900 hover:text-yellow-950 font-medium transition-all"
                    title="Add a sticky note"
                >
                    Add Note
                </Button>
                <div className="w-px h-6 bg-gray-300" />
                <Button 
                    variant="outline"
                    onClick={onCenter}
                    className="px-4 py-2 cursor-pointer bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-900 hover:text-blue-950 font-medium transition-all"
                    title="Center view and reset zoom"
                >
                    Center View
                </Button>
                {canRefresh && onRefresh && (
                    <Button 
                        variant="outline"
                        onClick={onRefresh}
                        className="px-4 py-2 cursor-pointer bg-purple-50 hover:bg-purple-100 border-purple-300 text-purple-900 hover:text-purple-950 font-medium transition-all"
                        title="Refresh child ideas of active item"
                    >
                        Refresh Ideas
                    </Button>
                )}
            </div>
        </div>
    );
};

export default Toolbar;
