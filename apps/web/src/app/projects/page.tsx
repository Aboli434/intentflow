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
      <div className="flex min-h-screen items-center justify-center bg-[#0B0F19] text-slate-400">
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-5 w-5 text-indigo-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-xs font-semibold">Loading Projects...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#F8FAFC] selection:bg-indigo-600 selection:text-white pb-16">
      <header className="border-b border-[#1F2937] bg-[#111827]/90 backdrop-blur-md px-6 py-4 shadow-md sticky top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-indigo-400 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Dashboard
            </Link>
            <div className="h-4 w-px bg-slate-800" />
            <h1 className="text-lg font-extrabold text-slate-100 tracking-tight">Projects Directory</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-6 lg:p-8 space-y-6">
        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#1F2937] bg-[#111827] p-12 text-center text-slate-400 shadow-md">
            No active projects found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((proj) => (
              <Link
                key={proj.id}
                href={`/projects/${proj.id}`}
                className="block rounded-2xl border border-[#1F2937] bg-[#111827] p-6 shadow-md hover:shadow-xl hover:border-indigo-500/60 transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-indigo-400">{proj.organizationName}</span>
                  <span className="rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase">
                    {proj.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-100 group-hover:text-indigo-400 transition-colors mb-1">{proj.name}</h3>
                <p className="text-xs text-slate-400 line-clamp-2">{proj.description || 'No description provided'}</p>
                <div className="mt-4 pt-3 border-t border-[#1F2937] text-xs text-slate-400 font-medium flex items-center justify-between font-mono text-[11px]">
                  <span>Updated {new Date(proj.updatedAt).toLocaleDateString()}</span>
                  <span className="text-indigo-400 font-bold group-hover:translate-x-0.5 transition-transform">View Workspace &rarr;</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
