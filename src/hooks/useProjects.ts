"use client";

import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { listProjectsForUser, type Project, type WithId } from '@/services/firestore';

interface ProjectsState {
  projects: WithId<Project>[];
  loading: boolean;
  error: Error | null;
}

export function useProjects(): ProjectsState {
  const { user } = useAuth();
  const [projects, setProjects] = useState<WithId<Project>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchProjects() {
      if (!user) {
        setProjects([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const userProjects = await listProjectsForUser(user.uid);
        if (isMounted) {
          setProjects(userProjects);
          setError(null);
        }
      } catch (e) {
        if (isMounted) {
          setError(e instanceof Error ? e : new Error('Failed to fetch projects'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void fetchProjects();

    return () => {
      isMounted = false;
    };
  }, [user]);

  return { projects, loading, error };
}
