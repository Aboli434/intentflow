'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiGetProjects } from '@/lib/api-client';
import { Project } from '@intentflow/types';

export default function ProjectsListPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGetProjects()
      .then(setProjects)
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-sm font-mono text-amber-400 animate-pulse">Loading Projects...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-xs text-sky-400 hover:underline">
              ← Dashboard
            </Link>
            <h1 className="text-xl font-bold text-white">Projects Directory</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-6 space-y-6">
        {projects.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center text-slate-400">
            No active projects found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((proj) => (
              <Link
                key={proj.id}
                href={`/projects/${proj.id}`}
                className="block rounded-xl border border-slate-800 bg-slate-900/60 p-5 hover:border-sky-500/50 hover:bg-slate-900 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-sky-400">{proj.organizationName}</span>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono font-medium text-emerald-400 border border-emerald-500/20">
                    {proj.status}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-white mb-1">{proj.name}</h3>
                <p className="text-xs text-slate-400 line-clamp-2">{proj.description || 'No description'}</p>
                <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500 font-mono">
                  Updated: {new Date(proj.updatedAt).toLocaleDateString()}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
