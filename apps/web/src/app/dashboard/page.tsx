'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  apiGetMe,
  apiGetOrganizations,
  apiGetProjects,
  apiCreateOrganization,
  apiCreateProject,
  apiLogout,
} from '@/lib/api-client';
import { User, Organization, Project, OrganizationMember } from '@intentflow/types';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<(Organization & { role: string })[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Form States
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);

  const [showProjModal, setShowProjModal] = useState(false);
  const [projName, setProjName] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [creatingProj, setCreatingProj] = useState(false);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const meRes = await apiGetMe();
      setUser(meRes.user);

      const orgsRes = await apiGetOrganizations();
      setOrganizations(orgsRes);

      const projRes = await apiGetProjects();
      setProjects(projRes);

      if (orgsRes.length > 0 && !selectedOrgId) {
        setSelectedOrgId(orgsRes[0].id);
      }
    } catch (err) {
      // Unauthenticated -> redirect to login
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingOrg(true);
    try {
      const newOrg = await apiCreateOrganization({ name: orgName });
      setOrgName('');
      setShowOrgModal(false);
      await loadDashboardData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setCreatingOrg(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId) return;
    setCreatingProj(true);
    try {
      await apiCreateProject({
        organizationId: selectedOrgId,
        name: projName,
        description: projDesc,
      });
      setProjName('');
      setProjDesc('');
      setShowProjModal(false);
      await loadDashboardData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setCreatingProj(false);
    }
  };

  const handleLogout = async () => {
    await apiLogout();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-sm font-mono text-amber-400 animate-pulse">Loading Workspace Foundation...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Navigation Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-xl tracking-tight text-white">IntentFlow</span>
            <span className="rounded-md bg-sky-500/10 px-2.5 py-0.5 text-xs font-mono font-medium text-sky-400 border border-sky-500/20">
              Phase 2 Foundation
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-300 font-medium">{user?.name} ({user?.email})</span>
            <Link href="/settings" className="text-slate-400 hover:text-white transition-colors">
              Settings
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs text-slate-200 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl p-6 space-y-8">
        {error && (
          <div className="rounded-md border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-400 font-mono">
            {error}
          </div>
        )}

        {/* Organizations Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Your Organizations</h2>
              <p className="text-xs text-slate-400">Workspaces & teams you belong to</p>
            </div>
            <button
              onClick={() => setShowOrgModal(true)}
              className="rounded-lg bg-sky-600 hover:bg-sky-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors"
            >
              + Create Workspace
            </button>
          </div>

          {organizations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center">
              <h3 className="text-base font-semibold text-slate-200">No organization yet</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                Create a workspace to collaborate on projects with clients and developers.
              </p>
              <button
                onClick={() => setShowOrgModal(true)}
                className="rounded-lg bg-sky-600 hover:bg-sky-500 px-4 py-2 text-xs font-semibold text-white transition-colors"
              >
                Create your workspace
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {organizations.map((org) => (
                <div
                  key={org.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 hover:border-slate-700 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-slate-100">{org.name}</h3>
                    <span className="uppercase text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      {org.role}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-slate-500">slug: {org.slug}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Projects Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Active Projects</h2>
              <p className="text-xs text-slate-400">Real projects retrieved from PostgreSQL database</p>
            </div>
            {organizations.length > 0 && (
              <button
                onClick={() => setShowProjModal(true)}
                className="rounded-lg bg-sky-600 hover:bg-sky-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors"
              >
                + New Project
              </button>
            )}
          </div>

          {projects.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-400 text-sm">
              No projects yet.
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
                    Created: {new Date(proj.createdAt).toLocaleDateString()}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Create Org Modal */}
      {showOrgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Create Workspace</h3>
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Organization Name</label>
                <input
                  type="text"
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Acme Studio"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOrgModal(false)}
                  className="rounded-lg px-3.5 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingOrg}
                  className="rounded-lg bg-sky-600 hover:bg-sky-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {creatingOrg ? 'Creating...' : 'Create Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      {showProjModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Create New Project</h3>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Target Organization</label>
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  placeholder="e.g. Mobile App Redesign"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Description</label>
                <textarea
                  value={projDesc}
                  onChange={(e) => setProjDesc(e.target.value)}
                  placeholder="Optional project scope & context..."
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none h-20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProjModal(false)}
                  className="rounded-lg px-3.5 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingProj}
                  className="rounded-lg bg-sky-600 hover:bg-sky-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {creatingProj ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
