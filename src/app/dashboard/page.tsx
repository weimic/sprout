"use client";

import { useRouter } from "next/navigation";
import { useProjects } from "@/hooks/useProjects";
import { CreateProjectModal } from "@/components/CreateProjectModal";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { FolderIcon, CalendarIcon, SparklesIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const LoadingSpinner: React.FC = () => (
    <div className="flex items-center justify-center min-h-full">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
);

export default function Dashboard() {
  const { loading } = useAuth();
  const router = useRouter();
  const { projects, loading: pLoading, error } = useProjects();

  if (loading) {
    return <LoadingSpinner />;
  }

  const handleProjectCreated = (projectId: string) => {
    router.push(`/dashboard/projects/${projectId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-12 sm:px-8 lg:px-12">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
                Projects
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                {projects.length > 0
                  ? `${projects.length} ${projects.length === 1 ? "project" : "projects"} in your workspace`
                  : "Create your first project to get started"}
              </p>
            </div>
            <CreateProjectModal onProjectCreated={handleProjectCreated} />
          </div>
        </div>

        {/* Loading State */}
        {pLoading && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="group relative">
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="space-y-4">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                    </div>
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <SparklesIcon className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-red-900">Unable to load projects</h3>
            <p className="text-sm text-red-700">{error.message}</p>
            <p className="mt-1 text-xs text-red-600">Please refresh the page or try again later.</p>
          </div>
        )}

        {/* Empty State */}
        {!pLoading && !error && projects.length === 0 && (
          <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <FolderIcon className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-slate-900">No projects yet</h3>
            <p className="mb-6 text-sm text-slate-600">
              Get started by creating your first project. Organize your ideas and let AI help you brainstorm.
            </p>
            <CreateProjectModal onProjectCreated={handleProjectCreated} />
          </div>
        )}

        {/* Projects Grid */}
        {!pLoading && projects.length > 0 && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map(({ id, data }) => (
              <Link
                key={id}
                href={`/dashboard/projects/${id}`}
                className="cursor-pointer group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
              >
                {/* Icon */}
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 transition-all duration-200 group-hover:bg-slate-200 group-hover:scale-110">
                  <FolderIcon className="h-5 w-5 text-slate-600 transition-colors group-hover:text-slate-900" />
                </div>

                {/* Content */}
                <div className="mb-4">
                  <h3
                    className="mb-2 text-lg font-semibold text-slate-900 line-clamp-1"
                    title={data.name}
                  >
                    {data.name}
                  </h3>
                  <p
                    className="text-sm text-slate-600 line-clamp-2"
                    title={data.mainContext}
                  >
                    {data.mainContext}
                  </p>
                </div>

                {/* Footer */}
                <div className="flex items-center text-xs text-slate-500">
                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                  <span>
                    {data.dateCreated
                      ? new Date(data.dateCreated.seconds * 1000).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "Just now"}
                  </span>
                </div>

                {/* Hover Effect Indicator */}
                <div className="absolute bottom-0 left-0 h-1 w-full origin-left scale-x-0 bg-slate-900 transition-transform duration-200 group-hover:scale-x-100" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}