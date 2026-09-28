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
  apiGetNotifications,
} from '@/lib/api-client';
import { User, Organization, Project, Notification } from '@intentflow/types';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { ActionRequiredCard, ActionItem } from '@/components/dashboard/ActionRequiredCard';
import { getNotificationTargetUrl, formatRelativeTime, getNotificationTypeIcon } from '@/lib/notification-utils';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string>('developer');
  const [organizations, setOrganizations] = useState<(Organization & { role: string })[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
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
      setError(null);
      const meRes = await apiGetMe();
      setUser(meRes.user);

      // Determine primary user role across memberships
      const primaryRole = meRes.memberships[0]?.role || 'developer';
      setUserRole(primaryRole);

      const orgsRes = await apiGetOrganizations();
      setOrganizations(orgsRes);

      const projRes = await apiGetProjects();
      setProjects(projRes);

      const notifsRes = await apiGetNotifications({ limit: 20 });
      setNotifications(notifsRes);

      // Build Action Required items from notifications & project statuses
      const actions: ActionItem[] = [];
      notifsRes.forEach((n) => {
        if (!n.readAt) {
          actions.push({
            id: n.id,
            title: n.title,
            subtitle: n.body,
            projectId: n.projectId || undefined,
            projectName: n.projectName || undefined,
            targetUrl: getNotificationTargetUrl(n),
            badgeLabel: n.type.includes('deliverable') ? 'Deliverable' : n.type.includes('closure') ? 'Closure' : 'Pending',
          });
        }
      });
      setActionItems(actions.slice(0, 5));

      if (orgsRes.length > 0 && !selectedOrgId) {
        setSelectedOrgId(orgsRes[0].id);
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingOrg(true);
    try {
      await apiCreateOrganization({ name: orgName });
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
      <div className="flex min-h-screen items-center justify-center bg-[#0B0F19] text-slate-400">
        <div className="flex items-center gap-3 text-xs font-semibold">
          <svg className="animate-spin h-5 w-5 text-indigo-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Loading Workspace Dashboard...</span>
        </div>
      </div>
    );
  }

  const isClient = userRole === 'client';
  const isAdmin = userRole === 'admin' || userRole === 'owner';

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#F8FAFC] selection:bg-indigo-600 selection:text-white pb-16">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-[#1F2937] bg-[#111827]/90 backdrop-blur-md px-4 sm:px-6 py-3.5 shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-extrabold text-lg sm:text-xl tracking-tight text-indigo-400 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block shadow-sm shadow-indigo-500/50" />
              IntentFlow
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 text-xs">
            <NotificationBell />

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0B0F19] border border-[#1F2937] text-slate-300 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="font-bold text-slate-100">{user?.name}</span>
              <span className="text-slate-500 font-mono">({userRole})</span>
            </div>

            <Link
              href="/settings"
              className="text-slate-400 hover:text-slate-100 font-bold transition-colors px-2.5 py-1.5 rounded-lg hover:bg-[#151D2E]"
            >
              Settings
            </Link>

            <button
              onClick={handleLogout}
              className="rounded-xl bg-[#151D2E] hover:bg-[#1F2937] border border-slate-700/80 px-3.5 py-1.5 font-bold text-slate-300 transition-all"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-6 space-y-8">
        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-semibold text-rose-300 shadow-md flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Top Role-Aware Summary Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          <div className="rounded-2xl border border-[#1F2937] bg-[#111827] p-4 space-y-1.5 shadow-md hover:border-slate-700 transition-all">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
              {isAdmin ? 'Organizations' : isClient ? 'Workspaces' : 'Your Team'}
            </span>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-100">
              {organizations.length}
            </div>
            <p className="text-[11px] text-slate-500 font-medium">Active memberships</p>
          </div>

          <div className="rounded-2xl border border-[#1F2937] bg-[#111827] p-4 space-y-1.5 shadow-md hover:border-indigo-500/60 transition-all">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
              {isClient ? 'Projects' : 'Assigned Projects'}
            </span>
            <div className="text-xl sm:text-2xl font-extrabold text-indigo-400">
              {projects.length}
            </div>
            <p className="text-[11px] text-slate-500 font-medium">In execution phase</p>
          </div>

          <div className="rounded-2xl border border-[#1F2937] bg-[#111827] p-4 space-y-1.5 shadow-md hover:border-amber-500/60 transition-all">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
              {isClient ? 'Approvals Pending' : 'Pending Actions'}
            </span>
            <div className="text-xl sm:text-2xl font-extrabold text-amber-400">
              {actionItems.length}
            </div>
            <p className="text-[11px] text-slate-500 font-medium">Require immediate review</p>
          </div>

          <div className="rounded-2xl border border-[#1F2937] bg-[#111827] p-4 space-y-1.5 shadow-md hover:border-emerald-500/60 transition-all">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
              Notifications
            </span>
            <div className="text-xl sm:text-2xl font-extrabold text-emerald-400">
              {notifications.filter((n) => !n.readAt).length}
            </div>
            <p className="text-[11px] text-slate-500 font-medium">Unread updates</p>
          </div>
        </section>

        {/* Action Required System */}
        <section>
          <ActionRequiredCard userRole={userRole} items={actionItems} />
        </section>

        {/* Main Grid: Projects & Organizations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Projects Column (2 cols on desktop) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-100 tracking-tight">
                  Active Projects
                </h2>
                <p className="text-xs text-slate-400">
                  {isClient ? 'Track deliverable reviews and handoffs' : 'Manage project execution, work, and team workspace'}
                </p>
              </div>
              {organizations.length > 0 && (
                <button
                  onClick={() => setShowProjModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3.5 py-2 text-xs font-bold text-white shadow-md transition-all"
                >
                  + New Project
                </button>
              )}
            </div>

            {projects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#1F2937] bg-[#111827] p-8 text-center text-slate-400 text-xs space-y-2">
                <p className="text-2xl">📁</p>
                <p className="font-bold text-slate-200">No active projects yet.</p>
                <p className="text-slate-400">Create a project inside your organization to start collaboration.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {projects.map((proj) => (
                  <Link
                    key={proj.id}
                    href={`/projects/${proj.id}`}
                    className="group rounded-2xl border border-[#1F2937] bg-[#111827] p-5 shadow-md hover:shadow-xl hover:border-indigo-500/60 transition-all space-y-3 block"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-bold text-indigo-400 truncate max-w-[150px]">
                        {proj.organizationName}
                      </span>
                      <span className="rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase">
                        {proj.status}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-100 group-hover:text-indigo-400 transition-colors">
                        {proj.name}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                        {proj.description || 'No project description provided'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[#1F2937] flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>Updated {formatRelativeTime(proj.updatedAt)}</span>
                      <span className="text-indigo-400 font-bold group-hover:translate-x-0.5 transition-transform">
                        Open Workspace →
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Organizations & Recent Notifications */}
          <div className="space-y-6">
            {/* Organizations */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-100">Your Organizations</h3>
                <button
                  onClick={() => setShowOrgModal(true)}
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  + Create
                </button>
              </div>

              <div className="space-y-2.5">
                {organizations.map((org) => (
                  <div
                    key={org.id}
                    className="rounded-2xl border border-[#1F2937] bg-[#111827] p-4 flex items-center justify-between gap-3 shadow-md"
                  >
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-100 truncate">{org.name}</h4>
                      <p className="text-[10px] font-mono text-slate-500 truncate">slug: {org.slug}</p>
                    </div>
                    <span className="uppercase text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shrink-0">
                      {org.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Updates */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-100">Recent Updates</h3>
                <Link href="/notifications" className="text-xs text-indigo-400 hover:text-indigo-300 font-bold">
                  View All →
                </Link>
              </div>

              <div className="rounded-2xl border border-[#1F2937] bg-[#111827] divide-y divide-[#1F2937] overflow-hidden shadow-md">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500 font-medium">No recent updates</div>
                ) : (
                  notifications.slice(0, 4).map((n) => (
                    <Link
                      key={n.id}
                      href={getNotificationTargetUrl(n)}
                      className="p-3 text-xs block hover:bg-[#151D2E] transition-colors space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-200 truncate flex items-center gap-1.5">
                          <span>{getNotificationTypeIcon(n.type)}</span>
                          <span className="truncate">{n.title}</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono shrink-0">
                          {formatRelativeTime(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-slate-400 line-clamp-1 text-[11px]">{n.body}</p>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Create Org Modal */}
      {showOrgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F19]/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#1F2937] bg-[#111827] p-6 space-y-4 shadow-2xl text-slate-100">
            <h3 className="text-base font-extrabold text-slate-100">Create Workspace</h3>
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Organization Name</label>
                <input
                  type="text"
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Acme Studio"
                  className="w-full rounded-xl border border-[#1F2937] bg-[#0B0F19] px-3.5 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOrgModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingOrg}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-bold text-white shadow-md disabled:opacity-50 transition-all"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F19]/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#1F2937] bg-[#111827] p-6 space-y-4 shadow-2xl text-slate-100">
            <h3 className="text-base font-extrabold text-slate-100">Create New Project</h3>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Target Organization</label>
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="w-full rounded-xl border border-[#1F2937] bg-[#0B0F19] px-3.5 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none cursor-pointer"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  placeholder="e.g. Mobile App Redesign"
                  className="w-full rounded-xl border border-[#1F2937] bg-[#0B0F19] px-3.5 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Description</label>
                <textarea
                  value={projDesc}
                  onChange={(e) => setProjDesc(e.target.value)}
                  placeholder="Optional project scope & context..."
                  className="w-full rounded-xl border border-[#1F2937] bg-[#0B0F19] px-3.5 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none h-20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProjModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingProj}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-bold text-white shadow-md disabled:opacity-50 transition-all"
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
