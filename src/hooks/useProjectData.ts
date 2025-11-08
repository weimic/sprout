"use client";

import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { getProject, listIdeasForProject, type Project, type Idea, type WithId } from '@/services/firestore';

interface ProjectDataState {
  project: WithId<Project> | null;
  ideas: WithId<Idea>[];
  loading: boolean;
  error: Error | null;
}

export function useProjectData(projectId: string | null): ProjectDataState {
  const { user } = useAuth();
  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [ideas, setIdeas] = useState<WithId<Idea>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchProjectData() {
      if (!user || !projectId) {
        setProject(null);
        setIdeas([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [projectData, ideasData] = await Promise.all([
          getProject(user.uid, projectId),
          listIdeasForProject(user.uid, projectId),
        ]);

        if (isMounted) {
          setProject(projectData);
          setIdeas(ideasData);
          setError(null);
        }
      } catch (e) {
        if (isMounted) {
          setError(e instanceof Error ? e : new Error('Failed to fetch project data'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void fetchProjectData();

    return () => {
      isMounted = false;
    };
  }, [user, projectId]);

  return { project, ideas, loading, error };
}
