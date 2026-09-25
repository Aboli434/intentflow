'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiGetProjectDetail } from '@/lib/api-client';
import { Project } from '@intentflow/types';

export default function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGetProjectDetail(resolvedParams.projectId)
      .then(setProject)
      .catch((err) => setError(err instanceof Error ? err.message : 'Access denied or project not found'))
      .finally(() => setLoading(false));
  }, [resolvedParams.projectId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-sm font-mono text-amber-400 animate-pulse">Loading Project Details...</div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100 p-4">
        <div className="max-w-md rounded-xl border border-rose-500/20 bg-slate-900/60 p-6 text-center space-y-4">
          <h2 className="text-lg font-bold text-rose-400">Access Restricted</h2>
          <p className="text-xs text-slate-400">{error || 'You do not have authorization to view this project.'}</p>
          <Link href="/dashboard" className="inline-block rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-xs text-sky-400 hover:underline">
              ← Dashboard
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-xs font-mono text-slate-400">{project.organizationName}</span>
          </div>

          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-mono font-medium text-emerald-400 border border-emerald-500/20">
            {project.status}
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl p-6 space-y-8">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">{project.name}</h1>
            <p className="text-sm text-slate-300">{project.description || 'No project description provided.'}</p>
          </div>

          <div className="flex gap-6 border-t border-slate-800 pt-4 text-xs font-mono text-slate-400">
            <div>Organization: <span className="text-slate-200">{project.organizationName}</span></div>
            <div>Created: <span className="text-slate-200">{new Date(project.createdAt).toLocaleDateString()}</span></div>
          </div>
        </div>

        {/* Project Members */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Project Members</h2>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            {project.members && project.members.length > 0 ? (
              <div className="divide-y divide-slate-800">
                {project.members.map((pm) => (
                  <div key={pm.id} className="flex items-center justify-between p-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-100">{pm.user?.name}</div>
                      <div className="text-xs text-slate-400 font-mono">{pm.user?.email}</div>
                    </div>
                    <span className="uppercase text-[10px] font-mono px-2.5 py-1 rounded bg-slate-800 text-sky-400 font-semibold">
                      {pm.role}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs">No project members assigned yet.</div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800/80 bg-slate-950 p-4 text-xs text-slate-500 text-center font-mono">
          Phase 2 Project Scope — Communication & Work Streams will be enabled in Phase 3.
        </div>
      </main>
    </div>
  );
}
