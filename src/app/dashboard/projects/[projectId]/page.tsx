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

export default function ProjectPage() {
    const projectId = useParams()?.projectId as string | null;
    const { user } = useAuth();
    const info = useProjectData(projectId);
    const data = info.project?.data;
    const [likedIdeas, setLikedIdeas] = useState<{ id: string; text: string }[]>([]);
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
                        <Canvas userId={user.uid} projectId={projectId} projectContext={data?.mainContext || ''} />
                    )}
                </main>
                <div className="fixed right-4 top-4 z-50">
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
                    </SidebarContent>
                    <SidebarFooter>
                        <Button className="flex items-center gap-2">
                            <Link className="w-full" href="/dashboard">Return</Link>
                        </Button>
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
