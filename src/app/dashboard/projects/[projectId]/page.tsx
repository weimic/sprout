"use client";

import { useParams } from "next/navigation";
import { useProjectData } from "@/hooks/useProjectData";

import {
    SidebarProvider,
    SidebarTrigger,
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarHeader,
    SidebarFooter
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState, useEffect } from 'react';
import { listIdeasForProject } from '@/services/firestore';
import Link from "next/link";
import Canvas from "@/components/canvas/Canvas";
import { useAuth } from "@/hooks/useAuth";
import { useRef } from 'react';
import UsefulLinks from "@/components/UsefulLinks";

function GridToggleButton({ onClick, isActive }: { onClick: () => void; isActive: boolean }) {
    return (
        <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onClick}
            title={isActive ? "Hide Grid" : "Show Grid"}
        >
            <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="16" 
                height="16" 
                viewBox="0 0 16 16" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="1.5"
            >
                <rect x="1" y="1" width="4.5" height="4.5" />
                <rect x="5.75" y="1" width="4.5" height="4.5" />
                <rect x="10.5" y="1" width="4.5" height="4.5" />
                <rect x="1" y="5.75" width="4.5" height="4.5" />
                <rect x="5.75" y="5.75" width="4.5" height="4.5" />
                <rect x="10.5" y="5.75" width="4.5" height="4.5" />
                <rect x="1" y="10.5" width="4.5" height="4.5" />
                <rect x="5.75" y="10.5" width="4.5" height="4.5" />
                <rect x="10.5" y="10.5" width="4.5" height="4.5" />
            </svg>
            <span className="sr-only">Toggle Grid</span>
        </Button>
    );
}

export default function ProjectPage() {
    const projectId = useParams()?.projectId as string | null;
    const { user } = useAuth();
    const info = useProjectData(projectId);
    const data = info.project?.data;
    const [likedIdeas, setLikedIdeas] = useState<{ id: string; text: string }[]>([]);
    const gridToggleRef = useRef<(() => void) | null>(null);
    const gridStateRef = useRef<(() => boolean) | null>(null);
    const [gridActive, setGridActive] = useState(false);
    const autoToggleRef = useRef<(() => void) | null>(null);
    const autoStateRef = useRef<(() => boolean) | null>(null);
    const [autoGenActive, setAutoGenActive] = useState(true);
    
    const handleGridToggleReady = (toggleFn: () => void, getState: () => boolean) => {
        gridToggleRef.current = toggleFn;
        gridStateRef.current = getState;
    };
    const handleAutoToggleReady = (toggleFn: () => void, getState: () => boolean) => {
        autoToggleRef.current = toggleFn;
        autoStateRef.current = getState;
    };
    
    const handleGridButtonClick = () => {
        if (gridToggleRef.current) {
            gridToggleRef.current();
            if (gridStateRef.current) {
                setTimeout(() => setGridActive(gridStateRef.current!()), 0);
            }
        }
    };
    const handleAutoGenButtonClick = () => {
        if (autoToggleRef.current) {
            autoToggleRef.current();
            if (autoStateRef.current) {
                setTimeout(() => setAutoGenActive(autoStateRef.current!()), 0);
            }
        }
    };
    
    const refreshLiked = async () => {
        if (!user || !projectId) return;
        const all = await listIdeasForProject(user.uid, projectId);
        setLikedIdeas(all.filter(i => i.data.isLiked).map(i => ({ id: i.id, text: i.data.text })));
    };

    return (
        <div className="min-h-screen w-full overflow-x-hidden">
            <SidebarProvider>
                <main className="flex-1">
                    {/* Main project content goes here (canvas) */}
                    {user && projectId && (
                        <Canvas 
                            userId={user.uid} 
                            projectId={projectId} 
                            projectContext={data?.mainContext || ''} 
                            onGridToggleReady={handleGridToggleReady}
                            onAutoToggleReady={handleAutoToggleReady}
                        />
                    )}
                </main>
                <div className="fixed right-4 top-4 z-50 flex gap-2">
                    <GridToggleButton onClick={handleGridButtonClick} isActive={gridActive} />
                    <SidebarTrigger />
                </div>
                <Sidebar side="right">
                    <SidebarContent>
                        <SidebarHeader>
                            <h1 className="font-bold">{data?.name || projectId}</h1>
                            <p data-project-main-context>{data?.mainContext}</p>
                        </SidebarHeader>
                        <SidebarGroup>
                            <ActiveIdeaPanel />
                        </SidebarGroup>
                        <SidebarGroup>
                            <Dialog onOpenChange={(open) => { if (open) void refreshLiked(); }}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm">Liked Ideas</Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Liked Ideas</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
                                        {likedIdeas.length === 0 && <p className="text-sm text-muted-foreground">No liked ideas yet.</p>}
                                        {likedIdeas.map(i => (
                                            <div key={i.id} className="p-2 rounded border text-sm bg-card/40">{i.text}</div>
                                        ))}
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </SidebarGroup>
                        <div className="px-2 py-1">
                            <div className="h-px bg-border my-2" />
                        </div>
                        <SidebarGroup>
                            {user && projectId && data?.mainContext && (
                                <UsefulLinks 
                                    userId={user.uid}
                                    projectId={projectId}
                                    projectContext={data.mainContext}
                                />
                            )}
                        </SidebarGroup>
                    </SidebarContent>
                    <SidebarFooter>
                        <div className="flex flex-col w-full gap-2">
                            <Button 
                                className="flex items-center gap-2 w-full" 
                                variant={autoGenActive ? 'default' : 'outline'}
                                onClick={handleAutoGenButtonClick}
                                title={autoGenActive ? 'Disable auto-generation' : 'Enable auto-generation'}
                            >
                                {autoGenActive ? 'Auto-Gen: On' : 'Auto-Gen: Off'}
                            </Button>
                            <Button className="flex items-center gap-2 w-full">
                                <Link className="w-full" href="/dashboard">Return</Link>
                            </Button>
                        </div>
                    </SidebarFooter>
                </Sidebar>
            </SidebarProvider>
        </div>
    );
}

function ActiveIdeaPanel() {
    const [active, setActive] = useState<{ id: string; text: string; addtlText: string } | null>(null);
    useEffect(() => {
        const handler = (e: Event) => {
            const ce = e as CustomEvent;
            setActive(ce.detail as { id: string; text: string; addtlText: string });
        };
        document.addEventListener('active-idea', handler as EventListener);
        return () => document.removeEventListener('active-idea', handler as EventListener);
    }, []);
    if (!active) return <p className="text-xs text-muted-foreground">Select an idea to see details.</p>;
    return (
        <div className="space-y-2">
            <h2 className="font-semibold text-sm">Active Idea</h2>
            <p className="text-sm font-medium">{active.text}</p>
            {active.addtlText ? <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{active.addtlText}</p> : <p className="text-xs italic text-muted-foreground">Generating additional insight...</p>}
        </div>
    );
}
