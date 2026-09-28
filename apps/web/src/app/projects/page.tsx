'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiGetProjects } from '@/lib/api-client';
import { Project } from '@intentflow/types';
import { AppHeader } from '@/components/common/Header';
import { Button, Input, Select } from '@/components/ui';
import { WorkspaceSkeleton } from '@/components/common/WorkspaceSkeleton';

export default function ProjectsListPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGetProjects();
      setProjects(data);
    } catch (err: any) {
      console.error('Fetch projects error:', err);
      if (err?.message?.includes('401') || err?.message?.includes('unauthorized')) {
        router.push('/login');
      } else {
        setError(err.message || 'Failed to load projects');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.organizationName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus =
      statusFilter === 'all' || p.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#F8FAFC] selection:bg-indigo-600 selection:text-white pb-16">
      <AppHeader />

      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Projects Directory
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              All active client projects and collaborative workspaces across your organizations.
            </p>
          </div>
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              ← Back to Dashboard
            </Button>
          </Link>
        </div>

        {/* Filter & Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Input
              placeholder="Search by project name, description, or organization..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              leftIcon={<span>🔍</span>}
            />
          </div>
          <div>
            <Select
              value={statusFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
              options={[
                { label: 'All Statuses', value: 'all' },
                { label: 'Active / Discovery', value: 'active' },
                { label: 'In Progress', value: 'in_progress' },
                { label: 'Completed / Closure', value: 'completed' },
              ]}
            />
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <WorkspaceSkeleton />
        ) : error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center space-y-3">
            <p className="text-xs font-bold text-rose-300">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchProjects}>
              Retry Loading Projects
            </Button>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-[#111827] p-12 text-center text-slate-400 space-y-3">
            <p className="text-3xl">📁</p>
            <p className="font-bold text-slate-200 text-sm">No projects match your filter criteria.</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Try adjusting your search query or status filter to locate active workspace projects.
            </p>
            {(searchTerm || statusFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
              >
                Reset Search Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((proj) => (
              <Link
                key={proj.id}
                href={`/projects/${proj.id}`}
                className="block rounded-2xl border border-slate-800 bg-[#111827] p-5 shadow-md hover:shadow-xl hover:border-indigo-500/60 transition-all group flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-indigo-400 truncate max-w-[160px]">
                      {proj.organizationName}
                    </span>
                    <span className="rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase">
                      {proj.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-100 group-hover:text-indigo-400 transition-colors">
                    {proj.name}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-2">
                    {proj.description || 'No detailed description provided.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800 text-xs text-slate-400 font-medium flex items-center justify-between font-mono text-[11px]">
                  <span>Updated {new Date(proj.updatedAt).toLocaleDateString()}</span>
                  <span className="text-indigo-400 font-bold group-hover:translate-x-0.5 transition-transform">
                    View Workspace →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
