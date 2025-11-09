'use client';
// NOTE: This component intentionally uses refs to mirror state for immediate rendering control.
// Refs are mutated directly; ensure any new logic preserves consistency between refs and state.
import React, { useRef, useEffect, useState, useCallback } from 'react';
import Toolbar from './Toolbar';
import Branch from '../Branch';
import Leaf from '../Leaf';
import Note from '../Note';
import { createIdea, listIdeasForProject, updateIdea, toggleIdeaLiked, deleteIdea } from '../../services/firestore';
import { createNote, listNotesForProject, updateNote } from '../../services/firestore';
import { CreateIdeaForm } from './CreateIdeaForm';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type ItemType = 'branch' | 'leaf' | 'note';


interface Item {
    id: string;
    type: ItemType;
    x: number; // world coordinates
    y: number; // world coordinates
    label: string;
    isLiked?: boolean;
    parentId?: string; // track parent relationship
    isManuallyCreated?: boolean; // skip auto-generation for manual items
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// World bounds and padding (in world units)
const WORLD_BOUNDS = {
    minX: -5000,
    minY: -5000,
    maxX: 5000,
    maxY: 5000,
} as const;

const SCREEN_PADDING = 100; // px padding from bounds
const ANIMATION_DURATION = 500; // ms for smooth transitions

// Smooth transition helper with easing
const smoothTransition = (
    start: number,
    end: number,
    onUpdate: (value: number) => void,
    duration: number = ANIMATION_DURATION,
    easing: (t: number) => number = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
) => {
    const startTime = performance.now();
    const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easing(progress);
        const current = start + (end - start) * easedProgress;
        onUpdate(current);
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    };
    requestAnimationFrame(animate);
};

interface CanvasProps {
    userId: string;
    projectId: string;
    projectContext?: string; // provide from page to avoid DOM query races
    onGridToggleReady?: (toggleFn: () => void, getState: () => boolean) => void;
    onAutoToggleReady?: (toggleFn: () => void, getState: () => boolean) => void; // expose auto-gen toggle externally (sidebar)
}

const Canvas: React.FC<CanvasProps> = ({ userId, projectId, projectContext = '', onGridToggleReady, onAutoToggleReady }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    // Throttled display-only transform state. Actual transform lives in refs and is applied imperatively
    const [displayScale, setDisplayScale] = useState<number>(1);
    const [displayTx, setDisplayTx] = useState<number>(0);
    const [displayTy, setDisplayTy] = useState<number>(0);
    const [items, setItems] = useState<Item[]>([]);
    const [notes, setNotes] = useState<Array<{ id: string; x: number; y: number; text: string }>>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [itemContextMap, setItemContextMap] = useState<Record<string, string>>({}); // Per-item context storage
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [isAtEdge, setIsAtEdge] = useState(false);
    const [showGrid, setShowGrid] = useState<boolean>(false);
    const [formOpen, setFormOpen] = useState(false);
    const [formItemType, setFormItemType] = useState<'branch' | 'leaf'>('branch');
    const [autoGenerateEnabled, setAutoGenerateEnabled] = useState<boolean>(true); // Toggle for Gemini generation
    const [visitedLeafs, setVisitedLeafs] = useState<Set<string>>(new Set()); // Track clicked leaves
    const edgeTimeoutRef = useRef<number | null>(null);
    // Maintain an effective projectContext derived from props or DOM so generation never silently skips
    const [effectiveProjectContext, setEffectiveProjectContext] = useState<string>(projectContext);
    const showGridRef = useRef(showGrid);
    const labelSaveTimeoutRef = useRef<Record<string, number>>({});
    // Removed addtlText/content support; focusing on minimal card data

    // refs for immediate responsiveness and to avoid stale closures in render
    const scaleRef = useRef(1);
    const txRef = useRef(0);
    const tyRef = useRef(0);
    const itemsRef = useRef<Item[]>(items);

    // rAF-throttled sync from refs -> lightweight state for UI (e.g., zoom indicator)
    const transformSyncRef = useRef<number | null>(null);
    const scheduleDisplaySync = useCallback(() => {
        if (transformSyncRef.current) return;
        transformSyncRef.current = window.requestAnimationFrame(() => {
            setDisplayScale(scaleRef.current);
            setDisplayTx(txRef.current);
            setDisplayTy(tyRef.current);
            transformSyncRef.current = null;
        });
    }, []);
    useEffect(() => () => { if (transformSyncRef.current) cancelAnimationFrame(transformSyncRef.current); }, []);
    useEffect(() => { itemsRef.current = items; }, [items]);
    useEffect(() => { showGridRef.current = showGrid; }, [showGrid]);
    const autoGenerateEnabledRef = useRef(autoGenerateEnabled);
    useEffect(() => { autoGenerateEnabledRef.current = autoGenerateEnabled; }, [autoGenerateEnabled]);

    // Keep effective context in sync with prop changes
    useEffect(() => {
        setEffectiveProjectContext(projectContext);
    }, [projectContext]);

    // Derive project context from DOM if not provided via props (e.g., legacy pages)
    useEffect(() => {
        if (projectContext) return; // already provided
        if (typeof document === 'undefined') return;
        const el = document.querySelector('[data-project-main-context]');
        const text = el?.textContent?.trim() || '';
        if (text) setEffectiveProjectContext(text);
        // Optional: observe future changes
        if (el) {
            const observer = new MutationObserver(() => {
                const t = el.textContent?.trim() || '';
                setEffectiveProjectContext(t);
            });
            observer.observe(el, { characterData: true, subtree: true, childList: true });
            return () => observer.disconnect();
        }
    }, [projectContext]);

    // Expose grid toggle function to parent - call only once
    useEffect(() => {
        if (onGridToggleReady) {
            const toggleFn = () => setShowGrid(prev => !prev);
            const getState = () => showGridRef.current;
            onGridToggleReady(toggleFn, getState);
        }
        if (onAutoToggleReady) {
            const toggleFn = () => setAutoGenerateEnabled(prev => !prev);
            const getState = () => autoGenerateEnabledRef.current;
            onAutoToggleReady(toggleFn, getState);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // World layer (DOM) that we transform imperatively to avoid stutter
    const worldLayerRef = useRef<HTMLDivElement | null>(null);
    const rafRef = useRef<number | null>(null);

    const applyTransform = useCallback(() => {
        const el = worldLayerRef.current;
        if (el) {
            el.style.transform = `translate(${txRef.current}px, ${tyRef.current}px) scale(${scaleRef.current})`;
            el.style.transformOrigin = '0 0';
        }
        scheduleDisplaySync();
        // grid depends on transform (for line width, view bounds) so re-render
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => { render(); rafRef.current = null; });
    }, [scheduleDisplaySync]);

    // Smoothly center the view and reset zoom
    const centerView = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const startScale = scaleRef.current;
        const startTx = txRef.current;
        const startTy = tyRef.current;
        const targetScale = 1;
        const cssWidth = canvas.clientWidth;
        const cssHeight = canvas.clientHeight;
        const targetTx = cssWidth / 2;
        const targetTy = cssHeight / 2;
        smoothTransition(startScale, targetScale, (value) => { scaleRef.current = value; applyTransform(); });
        smoothTransition(startTx, targetTx, (value) => { txRef.current = value; applyTransform(); });
        smoothTransition(startTy, targetTy, (value) => { tyRef.current = value; applyTransform(); });
    }, [applyTransform]);

    // Compute allowed translation range for current scale
    const clampTranslation = useCallback((tx: number, ty: number, currentScale: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return { tx, ty };

        // screen dimensions in CSS pixels
        const cssWidth = canvas.clientWidth;
        const cssHeight = canvas.clientHeight;

        // compute allowed ranges (with padding)
        const txMin = cssWidth - (WORLD_BOUNDS.maxX * currentScale) - SCREEN_PADDING;
        const txMax = -(WORLD_BOUNDS.minX * currentScale) + SCREEN_PADDING;
        const tyMin = cssHeight - (WORLD_BOUNDS.maxY * currentScale) - SCREEN_PADDING;
        const tyMax = -(WORLD_BOUNDS.minY * currentScale) + SCREEN_PADDING;

        // clamp and detect if we hit an edge
        const clampedTx = clamp(tx, txMin, txMax);
        const clampedTy = clamp(ty, tyMin, tyMax);
        const hitEdge = clampedTx !== tx || clampedTy !== ty;

        // show edge feedback briefly
        if (hitEdge) {
            setIsAtEdge(true);
            if (edgeTimeoutRef.current) window.clearTimeout(edgeTimeoutRef.current);
            edgeTimeoutRef.current = window.setTimeout(() => {
                setIsAtEdge(false);
                edgeTimeoutRef.current = null;
            }, 450) as unknown as number;
        }

        return { tx: clampedTx, ty: clampedTy };
    }, []);

    // RAF ref moved above

    // render function uses refs for latest values
    const render = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        // ensure context scale for high-DPI
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const cssWidth = canvas.clientWidth;
        const cssHeight = canvas.clientHeight;

        ctx.clearRect(0, 0, cssWidth, cssHeight);

        ctx.save();
        ctx.translate(txRef.current, tyRef.current);
        ctx.scale(scaleRef.current, scaleRef.current);

        // Grid - only render if showGrid is true
        if (showGridRef.current) {
            const gridSize = 50;
            ctx.lineWidth = 1 / Math.max(1, scaleRef.current);
            ctx.strokeStyle = 'rgba(128,128,128,0.12)';

            const viewLeft = (-txRef.current) / scaleRef.current;
            const viewTop = (-tyRef.current) / scaleRef.current;
            const viewRight = (cssWidth - txRef.current) / scaleRef.current;
            const viewBottom = (cssHeight - tyRef.current) / scaleRef.current;

            const startX = Math.floor(viewLeft / gridSize) * gridSize;
            const startY = Math.floor(viewTop / gridSize) * gridSize;

            for (let x = startX; x <= viewRight; x += gridSize) {
                for (let y = startY; y <= viewBottom; y += gridSize) {
                    ctx.strokeRect(x, y, gridSize, gridSize);
                }
            }
        }

        ctx.restore();
    }, []);

    // setup: size canvas to viewport and schedule an initial render
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;

        const resize = () => {
            const cssWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
            const cssHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
            canvas.style.width = cssWidth + 'px';
            canvas.style.height = cssHeight + 'px';
            canvas.width = Math.floor(cssWidth * dpr);
            canvas.height = Math.floor(cssHeight * dpr);
            // schedule render
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(() => { render(); rafRef.current = null; });
        };

        const onResize = () => resize();
        window.addEventListener('resize', onResize);
        // initial
        resize();
        // Center the view on initial mount (animate via rAF callbacks)
        centerView();

        return () => {
            window.removeEventListener('resize', onResize);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [render, centerView]);

    // Load existing ideas as items on mount / when project changes
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!userId || !projectId) return;
            try {
                const ideas = await listIdeasForProject(userId, projectId);
                if (cancelled) return;
                setItems(
                    ideas.map((i) => ({
                        id: i.id,
                        type: 'leaf',
                        x: i.data.x ?? 0,
                        y: i.data.y ?? 0,
                        label: i.data.text,
                        // content removed
                        isLiked: i.data.isLiked,
                        parentId: i.data.parentId,
                    }))
                );
                
                // Load notes
                const loadedNotes = await listNotesForProject(userId, projectId);
                if (cancelled) return;
                setNotes(
                    loadedNotes.map((n) => ({
                        id: n.id,
                        x: n.data.x,
                        y: n.data.y,
                        text: n.data.text,
                    }))
                );
                // If no ideas exist yet, generate 3 initial ones based on project context (handled externally via effect)
            } catch (err) {
                console.error('Failed to load ideas for canvas', err);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [userId, projectId]);

    // Utility: find a non-overlapping position near a target using increasing radius
    // Default spacing reduced to bring generated leaves closer without overlap
    const findOpenSpot = useCallback((targetX: number, targetY: number, minDist = 200) => {
        const positions = itemsRef.current.map((i) => ({ x: i.x, y: i.y }));
        // also avoid overlapping with origin where the context card sits
        positions.push({ x: 0, y: 0 });
        let radius = 0;
        let angle = 0;
        for (let iter = 0; iter < 64; iter++) {
            const x = targetX + Math.cos(angle) * radius;
            const y = targetY + Math.sin(angle) * radius;
            const ok = positions.every((p) => {
                const dx = x - p.x; const dy = y - p.y; return Math.hypot(dx, dy) > minDist;
            });
            if (ok) return { x, y };
            radius += 24; angle += Math.PI / 7;
        }
        return { x: targetX + radius, y: targetY };
    }, []);

    // Auto-generate initial ideas if project empty and a main context is available
    useEffect(() => {
        const runInitial = async () => {
            if (!userId || !projectId) return;
            if (itemsRef.current.length > 0) return; // already have ideas
            if (!effectiveProjectContext) return;
            setIsGenerating(true);
            try {
                const resp = await fetch('/api/ideas/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mode: 'initial', projectContext: effectiveProjectContext }),
                });
                const json = await resp.json();
                if (json?.ideas?.length) {
                    // Layout: triangle around center to feel spacious/flowchart-like
                    const canvas = canvasRef.current;
                    if (!canvas) return;
                    const cx = (canvas.clientWidth / 2 - txRef.current) / scaleRef.current;
                    const cy = (canvas.clientHeight / 2 - tyRef.current) / scaleRef.current;
                    const created: Item[] = [];
                    const baseRadius = 380;
                    const baseAngles = [-Math.PI / 6, Math.PI / 2, Math.PI + Math.PI / 6]; // roughly top, left, right triangle pattern
                    for (let i = 0; i < json.ideas.length; i++) {
                        const angle = baseAngles[i % baseAngles.length];
                        const tx = cx + Math.cos(angle) * baseRadius;
                        const ty = cy + Math.sin(angle) * baseRadius;
                        const spot = findOpenSpot(tx, ty, 340);
                        const ideaText = json.ideas[i];
                        // Set parentId to 'trunk' to indicate these connect to the root
                        const ideaId = await createIdea(userId, projectId, { text: ideaText, x: spot.x, y: spot.y, parentId: 'trunk' });
                        created.push({ id: ideaId, type: 'leaf', x: spot.x, y: spot.y, label: ideaText, parentId: 'trunk' });
                    }
                    setItems(created);
                    itemsRef.current = created;
                }
            } catch (e) {
                console.error('Initial idea generation failed', e);
            } finally {
                setIsGenerating(false);
            }
        };
        void runInitial();
    }, [userId, projectId, effectiveProjectContext, findOpenSpot]);

    // Handle clicking an item: make active, center view smoothly, fetch addtlText if missing
    const handleItemClick = useCallback(async (item: Item) => {
        setActiveId(item.id);
        
        // Mark this leaf as visited
        const isFirstVisit = !visitedLeafs.has(item.id);
        if (isFirstVisit) {
            setVisitedLeafs((prev) => new Set([...prev, item.id]));
        }
        
        // Notify sidebar (details content removed)
        try { document.dispatchEvent(new CustomEvent('active-idea', { detail: { id: item.id, text: item.label, addtlText: '' } })); } catch {}
        
        // Center view on item
        const canvas = canvasRef.current;
        if (canvas) {
            const cssWidth = canvas.clientWidth;
            const cssHeight = canvas.clientHeight;
            const targetScreenX = cssWidth / 2;
            const targetScreenY = cssHeight / 2;
            const currentScreenX = item.x * scaleRef.current + txRef.current;
            const currentScreenY = item.y * scaleRef.current + tyRef.current;
            // new translate to move item to center
            const newTxTarget = txRef.current + (targetScreenX - currentScreenX);
            const newTyTarget = tyRef.current + (targetScreenY - currentScreenY);
            smoothTransition(txRef.current, newTxTarget, (v) => { txRef.current = v; applyTransform(); });
            smoothTransition(tyRef.current, newTyTarget, (v) => { tyRef.current = v; applyTransform(); });
        }
        
        // Only generate addtlText if: auto-generation enabled, first visit, no content exists, not manually created
        if (autoGenerateEnabled && isFirstVisit && !item.isManuallyCreated && effectiveProjectContext) {
            try {
                setIsGenerating(true);
                const itemContext = itemContextMap[item.id] || '';
                const resp = await fetch('/api/ideas/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mode: 'addtl', projectContext: effectiveProjectContext, parentText: item.label, extraContext: itemContext || undefined }),
                });
                const json = await resp.json();
                // Ignoring addtlText generation (feature removed)
            } catch (e) {
                console.error('Failed to get addtlText', e);
            } finally {
                setIsGenerating(false);
            }
        }
        
        // Auto-generate child ideas if enabled, first visit, and doesn't have children yet
        const hasChildren = itemsRef.current.some(i => i.parentId === item.id);
        if (autoGenerateEnabled && isFirstVisit && !hasChildren && effectiveProjectContext) {
            try {
                setIsGenerating(true);
                const itemContext = itemContextMap[item.id] || '';
                const resp = await fetch('/api/ideas/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mode: 'related', projectContext: effectiveProjectContext, parentText: item.label, extraContext: itemContext || undefined }),
                });
                const json = await resp.json();
                if (json?.ideas?.length) {
                    const newOnes: Item[] = [];
                    const outAngle = Math.atan2(item.y - 0, item.x - 0);
                    const offsets = [-0.5, 0, 0.5];
                    for (let i = 0; i < json.ideas.length; i++) {
                        const angle = outAngle + offsets[i % offsets.length];
                        const baseDist = 220 + i * 30;
                        const targetX = item.x + Math.cos(angle) * baseDist;
                        const targetY = item.y + Math.sin(angle) * baseDist;
                        const spot = findOpenSpot(targetX, targetY, 200);
                        const ideaText = json.ideas[i];
                        const ideaId = await createIdea(userId, projectId, { text: ideaText, parentId: item.id, x: spot.x, y: spot.y });
                        newOnes.push({ id: ideaId, type: 'leaf', x: spot.x, y: spot.y, label: ideaText, parentId: item.id });
                    }
                    setItems((prev) => {
                        const merged = [...prev, ...newOnes];
                        itemsRef.current = merged;
                        return merged;
                    });
                }
            } catch (e) {
                console.error('Failed to generate child ideas', e);
            } finally {
                setIsGenerating(false);
            }
        }
    }, [projectId, userId, itemContextMap, effectiveProjectContext, findOpenSpot, autoGenerateEnabled, visitedLeafs]);

    // Generate related ideas (3) branching from active item with user's extra context
    const handleGenerateMore = useCallback(async (item: Item) => {
        if (!effectiveProjectContext) return;
        try {
            setIsGenerating(true);
            const itemContext = itemContextMap[item.id] || '';
            const resp = await fetch('/api/ideas/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'related', projectContext: effectiveProjectContext, parentText: item.label, extraContext: itemContext || undefined }),
            });
            const json = await resp.json();
            if (json?.ideas?.length) {
                const newOnes: Item[] = [];
                // preferred outward direction from origin
                const outAngle = Math.atan2(item.y - 0, item.x - 0);
                const offsets = [-0.5, 0, 0.5]; // radians offsets for branching feel
                for (let i = 0; i < json.ideas.length; i++) {
                    const angle = outAngle + offsets[i % offsets.length];
                    const baseDist = 220 + i * 30;
                    const targetX = item.x + Math.cos(angle) * baseDist;
                    const targetY = item.y + Math.sin(angle) * baseDist;
                    const spot = findOpenSpot(targetX, targetY, 200);
                    const ideaText = json.ideas[i];
                    const ideaId = await createIdea(userId, projectId, { text: ideaText, parentId: item.id, x: spot.x, y: spot.y });
                    newOnes.push({ id: ideaId, type: 'leaf', x: spot.x, y: spot.y, label: ideaText, parentId: item.id });
                }
                setItems((prev) => {
                    const merged = [...prev, ...newOnes];
                    itemsRef.current = merged;
                    return merged;
                });
            }
            // Clear the extra context for this item after successful generation
            setItemContextMap((prev) => ({ ...prev, [item.id]: '' }));
        } catch (e) {
            console.error('Related idea generation failed', e);
        } finally {
            setIsGenerating(false);
        }
    }, [projectId, userId, itemContextMap, effectiveProjectContext, findOpenSpot]);

    // Refresh child ideas: delete existing children and generate new ones
    const handleRefreshChildren = useCallback(async () => {
    if (!activeId || !effectiveProjectContext) return;
        const activeItem = itemsRef.current.find(i => i.id === activeId);
        if (!activeItem) return;
        
        try {
            setIsGenerating(true);
            
            // Find all children of the active item
            const childrenToDelete = itemsRef.current.filter(i => i.parentId === activeId);
            
            // Delete children from Firestore
            await Promise.all(childrenToDelete.map(child => 
                deleteIdea(userId, projectId, child.id)
            ));
            
            // Remove children from state
            setItems((prev) => {
                const filtered = prev.filter(i => i.parentId !== activeId);
                itemsRef.current = filtered;
                return filtered;
            });
            
            // Generate new children
            const itemContext = itemContextMap[activeId] || '';
            const resp = await fetch('/api/ideas/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    mode: 'related', 
                    projectContext: effectiveProjectContext, 
                    parentText: activeItem.label, 
                    extraContext: itemContext || undefined 
                }),
            });
            const json = await resp.json();
            
            if (json?.ideas?.length) {
                const newOnes: Item[] = [];
                const outAngle = Math.atan2(activeItem.y - 0, activeItem.x - 0);
                const offsets = [-0.5, 0, 0.5];
                
                for (let i = 0; i < json.ideas.length; i++) {
                    const angle = outAngle + offsets[i % offsets.length];
                    const baseDist = 220 + i * 30;
                    const targetX = activeItem.x + Math.cos(angle) * baseDist;
                    const targetY = activeItem.y + Math.sin(angle) * baseDist;
                    const spot = findOpenSpot(targetX, targetY, 200);
                    const ideaText = json.ideas[i];
                    const ideaId = await createIdea(userId, projectId, { 
                        text: ideaText, 
                        parentId: activeItem.id, 
                        x: spot.x, 
                        y: spot.y 
                    });
                    newOnes.push({ 
                        id: ideaId, 
                        type: 'leaf', 
                        x: spot.x, 
                        y: spot.y, 
                        label: ideaText, 
                        parentId: activeItem.id 
                    });
                }
                
                setItems((prev) => {
                    const merged = [...prev, ...newOnes];
                    itemsRef.current = merged;
                    return merged;
                });
            }
            // Clear the extra context for this item after successful generation
            setItemContextMap((prev) => ({ ...prev, [activeId]: '' }));
        } catch (e) {
            console.error('Failed to refresh child ideas', e);
        } finally {
            setIsGenerating(false);
        }
    }, [activeId, projectId, userId, itemContextMap, effectiveProjectContext, findOpenSpot]);

    const handleToggleLike = useCallback(async (id: string) => {
        try {
            await toggleIdeaLiked(userId, projectId, id);
            setItems((prev) => prev.map((i) => i.id === id ? { ...i, isLiked: !i.isLiked } : i));
        } catch (e) {
            console.error('Toggle like failed', e);
        }
    }, [projectId, userId]);

    // Delete an item and all its descendants recursively
    const handleDeleteItem = useCallback(async (id: string) => {
        try {
            // Find all descendants recursively
            const findDescendants = (itemId: string): string[] => {
                const children = itemsRef.current.filter(i => i.parentId === itemId);
                const childIds = children.map(c => c.id);
                const grandchildIds = children.flatMap(c => findDescendants(c.id));
                return [...childIds, ...grandchildIds];
            };
            
            const toDelete = [id, ...findDescendants(id)];
            
            // Delete from Firestore
            await Promise.all(toDelete.map(itemId => deleteIdea(userId, projectId, itemId)));
            
            // Remove from state
            setItems((prev) => {
                const filtered = prev.filter(i => !toDelete.includes(i.id));
                itemsRef.current = filtered;
                return filtered;
            });
            
            // Clear from context map
            setItemContextMap((prev) => {
                const newMap = { ...prev };
                toDelete.forEach(itemId => delete newMap[itemId]);
                return newMap;
            });
            
            // Clear active if deleted
            if (toDelete.includes(activeId || '')) {
                setActiveId(null);
            }
        } catch (e) {
            console.error('Failed to delete item', e);
        }
    }, [userId, projectId, activeId]);

    // Handle label change with debouncing
    const handleLabelChange = useCallback((id: string, newLabel: string) => {
        // Update state immediately for responsive UI
        setItems((prev) => prev.map((i) => i.id === id ? { ...i, label: newLabel } : i));
        
        // Debounce save to Firestore
        if (labelSaveTimeoutRef.current[id]) {
            window.clearTimeout(labelSaveTimeoutRef.current[id]);
        }
        
        labelSaveTimeoutRef.current[id] = window.setTimeout(() => {
            updateIdea(userId, projectId, id, { text: newLabel }).catch((e) => {
                console.error('Failed to save label', e);
            });
            delete labelSaveTimeoutRef.current[id];
        }, 500) as unknown as number;
    }, [userId, projectId]);

    // Handle content change with debouncing
    // Removed content editing handler

    // Redraw grid when toggled or item count changes (geometry lines/blocks are CSS transformed)
    useEffect(() => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => { render(); rafRef.current = null; });
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [showGrid, items.length, render]);

    // wheel zoom (zoom towards pointer)
    const handleWheel: React.WheelEventHandler<HTMLCanvasElement> = (e) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomIntensity = 0.0015;
        const delta = -e.deltaY;

        const prevScale = scaleRef.current;
        const newScale = clamp(prevScale * (1 + delta * zoomIntensity), 0.2, 1);

        let newTx = mouseX - ((mouseX - txRef.current) / prevScale) * newScale;
        let newTy = mouseY - ((mouseY - tyRef.current) / prevScale) * newScale;

        const { tx: clampedTx, ty: clampedTy } = clampTranslation(newTx, newTy, newScale);
        newTx = clampedTx;
        newTy = clampedTy;

        scaleRef.current = newScale;
        txRef.current = newTx;
        tyRef.current = newTy;
        applyTransform();
    };

    // pointer events for panning
    const isPanningRef = useRef(false);
    const startRef = useRef<{ x: number; y: number } | null>(null);

    const handlePointerDown: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        isPanningRef.current = true;
        startRef.current = { x: e.clientX - txRef.current, y: e.clientY - tyRef.current };
    };

    const handlePointerMove: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
        if (!isPanningRef.current || !startRef.current) return;
        let newTx = e.clientX - startRef.current.x;
        let newTy = e.clientY - startRef.current.y;

        const { tx: clampedTx, ty: clampedTy } = clampTranslation(newTx, newTy, scaleRef.current);
        newTx = clampedTx;
        newTy = clampedTy;

        txRef.current = newTx;
        tyRef.current = newTy;
        applyTransform();
    };

    const handlePointerUp: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
        try { (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId); } catch {};
        isPanningRef.current = false;
        startRef.current = null;
    };

    // Create a new item and persist as an Idea with coordinates
    const addItem = useCallback(async (type: ItemType, data?: { label: string; context: string }) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const cssWidth = canvas.clientWidth;
        const cssHeight = canvas.clientHeight;
        const worldX = (cssWidth / 2 - txRef.current) / scaleRef.current;
        const worldY = (cssHeight / 2 - tyRef.current) / scaleRef.current;
        
        if (type === 'note') {
            // Create a note
            try {
                const noteId = await createNote(userId, projectId, {
                    x: worldX,
                    y: worldY,
                    text: '',
                });
                setNotes((prev) => [...prev, { id: noteId, x: worldX, y: worldY, text: '' }]);
            } catch (err) {
                console.error('Failed to create note', err);
            }
        } else if (data) {
            // Create an idea (branch or leaf) from form data
            try {
                const ideaId = await createIdea(userId, projectId, {
                    text: data.label,
                    x: worldX,
                    y: worldY,
                });
                const newItem: Item = {
                    id: ideaId,
                    type,
                    x: worldX,
                    y: worldY,
                    label: data.label,
                    isManuallyCreated: true,
                };
                setItems((prev) => {
                    const next = [...prev, newItem];
                    itemsRef.current = next;
                    return next;
                });
                // Store provided context to influence subsequent generations for this item
                if (data.context?.trim()) {
                    setItemContextMap((prev) => ({ ...prev, [ideaId]: data.context }));
                }
                // Automatically trigger generation for the new item
                setTimeout(() => {
                    setActiveId(newItem.id);
                    void handleItemClick(newItem);
                }, 20);
            } catch (err) {
                console.error('Failed to create idea for canvas item', err);
            }
        }
    }, [userId, projectId, handleItemClick]);

    const handleAddBranch = () => {
        setFormItemType('branch');
        setFormOpen(true);
    };

    const handleAddLeaf = () => {
        setFormItemType('leaf');
        setFormOpen(true);
    };

    const handleAddNote = () => {
        addItem('note');
    };

    const handleFormSubmit = (data: { label: string; context: string }) => {
        addItem(formItemType, data);
        setFormOpen(false);
    };

    // Auto-generation is controlled via onAutoToggleReady in the parent (sidebar)

    // Main render
    return (
        <div className="absolute inset-0 flex flex-col overflow-hidden bg-background">
            {/* Top toolbar - always visible */}
            <div className="w-full flex-none z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 border-b">
                <Toolbar 
                    onAddBranch={handleAddBranch}
                    onAddLeaf={handleAddLeaf}
                    onAddNote={handleAddNote}
                    onCenter={centerView}
                    onRefresh={handleRefreshChildren}
                    canRefresh={!!activeId && itemsRef.current.some(i => i.parentId === activeId)}
                />
            </div>
            <CreateIdeaForm
                open={formOpen}
                onOpenChange={setFormOpen}
                itemType={formItemType}
                onSubmit={handleFormSubmit}
            />
            {/* Canvas container - fills remaining space */}
            <div className="flex-1 relative overflow-hidden">
                <canvas
                    ref={canvasRef}
                    onWheel={handleWheel}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        display: 'block',
                        touchAction: 'none',
                        opacity: isAtEdge ? 0.95 : 1,
                        transition: 'opacity 150ms ease-in-out',
                    }}
                    className="bg-background"
                />
                {/* Block container */}
                <div className="absolute inset-0 pointer-events-none">
                    {/* SVG layer for connection lines */}
                    {/* Legacy absolute positioned layer retained for trunk before world ref is applied */}
                    {/* (Will be superseded by worldLayerRef transform) */}
                    
                    {/* New world layer (single transform) */}
                    <div ref={worldLayerRef} className="absolute inset-0 pointer-events-none" style={{ 
                        transformOrigin: '0 0', 
                        willChange: 'transform',
                        backfaceVisibility: 'hidden',
                        transform: 'translateZ(0)',
                    }}>
                        <svg className="absolute inset-0 overflow-visible pointer-events-none" width={1} height={1}>
                            {items.map(item => {
                                if (!item.parentId) return null;
                                const parent = items.find(i => i.id === item.parentId);
                                const parentX = (!parent || item.parentId === 'trunk') ? 0 : parent.x;
                                const parentY = (!parent || item.parentId === 'trunk') ? 0 : parent.y;
                                return (
                                    <line
                                        key={`line-${item.id}`}
                                        x1={parentX}
                                        y1={parentY}
                                        x2={item.x}
                                        y2={item.y}
                                        stroke={(!parent || item.parentId === 'trunk') ? 'rgba(217,119,6,0.5)' : 'rgba(16,185,129,0.4)'}
                                        strokeWidth={(!parent || item.parentId === 'trunk') ? 3 : 2}
                                        strokeDasharray={(!parent || item.parentId === 'trunk') ? undefined : '5,5'}
                                        strokeLinecap="round"
                                    />
                                );
                            })}
                        </svg>
                        {effectiveProjectContext && (
                            <div style={{ position: 'absolute', left: 0, top: 0, transform: 'translate(-50%, -50%)', transformOrigin: 'center center', pointerEvents: 'none', zIndex: 1 }}>
                                <Branch label={effectiveProjectContext} isTrunk={true} />
                            </div>
                        )}
                        {items.map(item => {
                            const isActive = item.id === activeId;
                            const itemStyle: React.CSSProperties = { position: 'absolute', left: item.x, top: item.y, transform: 'translate(-50%, -50%)', transformOrigin: 'center center', pointerEvents: 'auto' };

                        const commonProps = {
                            label: item.label,
                            onChange: (newLabel: string) => handleLabelChange(item.id, newLabel),
                            extraContext: itemContextMap[item.id] || '',
                            onExtraContextChange: (value: string) => {
                                setItemContextMap((prev) => ({ ...prev, [item.id]: value }));
                            },
                            onGenerateMore: () => handleGenerateMore(item),
                            isGenerating,
                            isActive,
                            // content removed
                            onDelete: () => handleDeleteItem(item.id),
                        };

                            return (
                                <div key={item.id} style={itemStyle} className={cn('group transition-transform', isActive ? 'scale-[1.04] z-10' : 'scale-[1.0] z-0')} onClick={() => handleItemClick(item)}>
                                    <div className={cn('rounded-2xl backdrop-blur-sm', isActive ? 'ring-4 ring-indigo-400/70 shadow-lg' : 'ring-1 ring-black/5 shadow-sm')} style={{ willChange: 'transform' }}>
                                        {item.type === 'branch' ? <Branch {...commonProps} className={isActive ? 'bg-gradient-to-br from-amber-50 to-amber-100' : ''} /> : <Leaf {...commonProps} className={isActive ? 'bg-gradient-to-br from-emerald-50 to-emerald-100' : ''} />}
                                    </div>
                                    <div className="absolute -top-2 -right-2 flex gap-1">
                                        <button onClick={(e) => { e.stopPropagation(); handleToggleLike(item.id); }} className={cn('text-xs px-2 py-1 rounded-full shadow bg-white/80 backdrop-blur transition border', item.isLiked ? 'bg-pink-500 border-pink-600 text-white' : 'hover:bg-white border-neutral-300')} title={item.isLiked ? 'Unlike' : 'Like'}>{item.isLiked ? '♥' : '♡'}</button>
                                    </div>
                                </div>
                            );
                    })}
                        {/* Render notes within world layer */}
                        {notes.map((note) => {
                        const noteStyle: React.CSSProperties = {
                            position: 'absolute',
                            left: note.x,
                            top: note.y,
                            transform: 'translate(-50%, -50%)',
                            transformOrigin: 'center center',
                            pointerEvents: 'auto',
                        };
                        return (
                            <div key={note.id} style={noteStyle} className="transition-transform hover:scale-105 z-5">
                                <Note
                                    text={note.text}
                                    onChange={(newText) => {
                                        setNotes((prev) => prev.map((n) => n.id === note.id ? { ...n, text: newText } : n));
                                        updateNote(userId, projectId, note.id, { text: newText }).catch(() => {});
                                    }}
                                />
                            </div>
                        );
                        })}
                    </div>
                    {/* Render notes (moved into world layer above) */}
                    {isGenerating && items.length === 0 && (
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-3" aria-label="Loading initial ideas">
                            <Skeleton className="h-24 w-48" />
                            <Skeleton className="h-24 w-48" />
                            <Skeleton className="h-24 w-48" />
                        </div>
                    )}
                </div>
                {/* Zoom indicator */}
                <div className="absolute bottom-4 left-4 z-10 bg-card p-2 rounded shadow text-sm">
                    Zoom: {(displayScale * 100).toFixed(0)}% {isGenerating && '· generating...'}
                </div>
                
                {/* Auto-Generate toggle moved to sidebar; button removed from canvas */}
            </div>
        </div>
    );
}

export default Canvas;