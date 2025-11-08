"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { createProject } from "@/services/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet";
import { PlusIcon, Loader2Icon } from "lucide-react";

interface CreateProjectModalProps {
  onProjectCreated: (projectId: string) => void;
}

export function CreateProjectModal({ onProjectCreated }: CreateProjectModalProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [mainContext, setMainContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim() && mainContext.trim() && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !user) return;

    setLoading(true);
    setError(null);

    try {
      const projectId = await createProject(user.uid, { name, mainContext });
      onProjectCreated(projectId);
      setOpen(false);
      // Reset form for next time
      setName("");
      setMainContext("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-slate-700 hover:shadow-md hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2">
          <PlusIcon className="h-4 w-4" />
          New Project
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full bg-white p-0 sm:max-w-md">
        <div className="flex h-full flex-col">
          {/* Header Section with Padding */}
          <SheetHeader className="space-y-1 border-b border-slate-100 px-6 py-6 text-left">
            <SheetTitle className="text-xl font-semibold text-slate-900">
              Create New Project
            </SheetTitle>
            <SheetDescription className="text-sm leading-relaxed text-slate-600">
              Give your project a name and describe what you&apos;d like to explore.
            </SheetDescription>
          </SheetHeader>

          {/* Form Section with Padding */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="projectName" className="block text-sm font-medium text-slate-900">
                  Project Name
                </label>
                <Input
                  id="projectName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Novel Ideas"
                  disabled={loading}
                  className="h-11 w-full rounded-lg border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-slate-400 focus-visible:ring-1 focus-visible:ring-slate-400"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="mainContext" className="block text-sm font-medium text-slate-900">
                  Main Context
                </label>
                <Input
                  id="mainContext"
                  value={mainContext}
                  onChange={(e) => setMainContext(e.target.value)}
                  placeholder="A sci-fi adventure exploring AI consciousness"
                  disabled={loading}
                  className="h-11 w-full rounded-lg border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-slate-400 focus-visible:ring-1 focus-visible:ring-slate-400"
                />
                <p className="text-xs leading-relaxed text-slate-500">
                  This context will be used to generate AI-powered ideas
                </p>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm leading-relaxed text-red-900">{error}</p>
                </div>
              )}

              {/* Buttons Section with Top Border */}
              <div className="border-t border-slate-100 pt-6">
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                    disabled={loading}
                    className="cursor-pointer h-11 flex-1 rounded-lg border-slate-300 bg-white text-sm font-medium text-slate-700 transition-all duration-150 hover:bg-slate-100 hover:text-slate-900 hover:border-slate-400 active:scale-[0.98] disabled:cursor-not-allowed"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!canSubmit}
                    className="cursor-pointer h-11 flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-slate-700 hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2Icon className="h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <PlusIcon className="h-4 w-4" />
                        Create
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
