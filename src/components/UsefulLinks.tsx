'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import {
  listUsefulLinksForProject,
  deleteUsefulLink,
  deleteAllUsefulLinks,
  createUsefulLink,
  type WithId,
  type UsefulLink,
} from '@/services/firestore';
import { ExternalLink, RefreshCw, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UsefulLinksProps {
  userId: string;
  projectId: string;
  projectContext: string;
  activeIdea?: string | null;
}

/**
 * UsefulLinks Component
 * 
 * Displays a curated list of external resources related to the canvas topic.
 * Features:
 * - Fetch relevant links using Gemini's Google Search integration
 * - Delete individual links
 * - Refresh all links with new suggestions
 * - Persistent storage in Firestore
 * - Responsive, accessible UI with loading states
 * 
 * @component
 */
export default function UsefulLinks({
  userId,
  projectId,
  projectContext,
  activeIdea = null,
}: UsefulLinksProps) {
  const [links, setLinks] = useState<WithId<UsefulLink>[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  /**
   * Load existing links from Firestore
   */
  const loadLinks = useCallback(async () => {
    if (!userId || !projectId) return;
    
    try {
      setIsLoading(true);
      setError(null);
      const fetchedLinks = await listUsefulLinksForProject(userId, projectId);
      setLinks(fetchedLinks);
    } catch (err) {
      console.error('Failed to load useful links:', err);
      setError('Failed to load links');
    } finally {
      setIsLoading(false);
    }
  }, [userId, projectId]);

  // Load links on mount and when dependencies change
  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  /**
   * Generate new links using Gemini API
   * Implements retry logic and comprehensive error handling
   */
  const generateLinks = useCallback(async () => {
    if (!projectContext.trim() || isGenerating) return;

    try {
      setIsGenerating(true);
      setError(null);

      // Call our API route with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch('/api/links/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectContext,
          activeIdea: activeIdea || undefined,
          count: 5,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.links || data.links.length === 0) {
        setError('No links generated. The AI may need more specific context.');
        return;
      }

      // Save all new links to Firestore in parallel
      const savePromises = data.links.map((link: { title: string; url: string; snippet: string }) =>
        createUsefulLink(userId, projectId, {
          title: link.title,
          url: link.url,
          snippet: link.snippet,
        }).catch((err) => {
          console.error('Failed to save link:', link.title, err);
          // Continue with other links even if one fails
          return null;
        })
      );

      await Promise.all(savePromises);

      // Reload to show new links
      await loadLinks();
    } catch (err) {
      console.error('Failed to generate links:', err);
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('Request timed out. Please try again.');
        } else {
          setError(err.message);
        }
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setIsGenerating(false);
    }
  }, [projectContext, activeIdea, userId, projectId, loadLinks, isGenerating]);

  /**
   * Delete a single link
   */
  const handleDeleteLink = useCallback(
    async (linkId: string) => {
      try {
        setDeletingIds((prev) => new Set(prev).add(linkId));
        await deleteUsefulLink(userId, projectId, linkId);
        setLinks((prev) => prev.filter((link) => link.id !== linkId));
      } catch (err) {
        console.error('Failed to delete link:', err);
        setError('Failed to delete link');
      } finally {
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(linkId);
          return next;
        });
      }
    },
    [userId, projectId]
  );

  /**
   * Refresh: Delete all existing links and generate new ones
   */
  const handleRefreshLinks = useCallback(async () => {
    if (isGenerating) return;

    try {
      setIsGenerating(true);
      setError(null);

      // Delete all existing links
      await deleteAllUsefulLinks(userId, projectId);
      setLinks([]);

      // Generate new links
      await generateLinks();
    } catch (err) {
      console.error('Failed to refresh links:', err);
      setError('Failed to refresh links');
      setIsGenerating(false);
    }
  }, [userId, projectId, generateLinks, isGenerating]);

  /**
   * Render loading skeletons
   */
  const renderSkeletons = () => (
    <div className="space-y-3" role="status" aria-label="Loading links">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2 p-3 border rounded-lg bg-card/40">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
      ))}
    </div>
  );

  /**
   * Render empty state
   */
  const renderEmptyState = () => (
    <div className="text-center py-8 space-y-3">
      <div className="text-muted-foreground text-sm">
        <ExternalLink className="mx-auto h-8 w-8 mb-2 opacity-50" />
        <p>No useful links yet.</p>
        <p className="text-xs">Generate relevant external resources for this topic.</p>
      </div>
      <Button
        onClick={generateLinks}
        disabled={isGenerating || !projectContext.trim()}
        size="sm"
        className="mx-auto"
      >
        {isGenerating ? (
          <>
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <ExternalLink className="mr-2 h-4 w-4" />
            Generate Links
          </>
        )}
      </Button>
    </div>
  );

  /**
   * Render link card
   */
  const renderLinkCard = (linkWithId: WithId<UsefulLink>) => {
    const isDeleting = deletingIds.has(linkWithId.id);
    
    return (
      <div
        key={linkWithId.id}
        className={cn(
          'group relative p-3 border rounded-lg bg-card hover:bg-accent/5 transition-all duration-200',
          isDeleting && 'opacity-50 pointer-events-none'
        )}
        role="article"
        aria-label={`Link: ${linkWithId.data.title}`}
      >
        {/* Delete button */}
        <button
          onClick={() => handleDeleteLink(linkWithId.id)}
          disabled={isDeleting}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 hover:text-destructive focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-destructive"
          aria-label="Delete this link"
          title="Delete this link"
        >
          {isDeleting ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <X className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Link content */}
        <a
          href={linkWithId.data.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block pr-6 space-y-2 focus:outline-none focus:ring-2 focus:ring-primary rounded"
        >
          {/* Title */}
          <h4 className="font-medium text-sm leading-tight text-foreground group-hover:text-primary transition-colors line-clamp-2">
            {linkWithId.data.title}
          </h4>

          {/* Snippet */}
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
            {linkWithId.data.snippet}
          </p>

          {/* URL preview */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
            <ExternalLink className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{new URL(linkWithId.data.url).hostname}</span>
          </div>
        </a>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Useful Links</h3>
        {links.length > 0 && (
          <Button
            onClick={handleRefreshLinks}
            disabled={isGenerating}
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            title="Replace all links with new suggestions"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isGenerating && 'animate-spin')} />
            <span className="sr-only">Refresh links</span>
          </Button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div
          className="p-3 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Content area */}
      <div className="space-y-2">
        {isLoading ? (
          renderSkeletons()
        ) : links.length === 0 ? (
          renderEmptyState()
        ) : (
          <>
            {/* Links list */}
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
              {links.map(renderLinkCard)}
            </div>

            {/* Add more links button */}
            <Button
              onClick={generateLinks}
              disabled={isGenerating}
              variant="outline"
              size="sm"
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <ExternalLink className="mr-2 h-3.5 w-3.5" />
                  Add More Links
                </>
              )}
            </Button>
          </>
        )}
      </div>

      {/* Help text */}
      {!isLoading && links.length > 0 && (
        <p className="text-xs text-muted-foreground/70 italic">
          Tip: Click refresh to replace with new suggestions
        </p>
      )}
    </div>
  );
}
