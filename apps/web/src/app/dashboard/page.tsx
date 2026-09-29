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
  apiGetNotifications,
} from '@/lib/api-client';
import { User, Organization, Project, Notification } from '@intentflow/types';
import { AppHeader } from '@/components/common/Header';
import { ActionRequiredCard, ActionItem } from '@/components/dashboard/ActionRequiredCard';
import { getNotificationTargetUrl, formatRelativeTime, getNotificationTypeIcon } from '@/lib/notification-utils';
import { Modal, Button, Input, Select, Textarea } from '@/components/ui';

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

      const primaryRole = meRes.memberships[0]?.role || 'developer';
      setUserRole(primaryRole);

      const orgsRes = await apiGetOrganizations();
      setOrganizations(orgsRes);

      const projRes = await apiGetProjects();
      setProjects(projRes);

      const notifsRes = await apiGetNotifications({ limit: 20 });
      setNotifications(notifsRes);

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
    if (!orgName.trim()) return;
    setCreatingOrg(true);
    try {
      await apiCreateOrganization({ name: orgName.trim() });
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
    if (!selectedOrgId || !projName.trim()) return;
    setCreatingProj(true);
    try {
      await apiCreateProject({
        organizationId: selectedOrgId,
        name: projName.trim(),
        description: projDesc.trim(),
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

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-[#0B0F19] text-[#F8FAFC]">
        <AppHeader />
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="flex items-center gap-3 text-xs font-semibold text-slate-400">
            <svg className="animate-spin h-5 w-5 text-indigo-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span>Loading Workspace Dashboard...</span>
          </div>
        </div>
      </div>
    );
  }

  const isClient = userRole === 'client';
  const isAdmin = userRole === 'admin' || userRole === 'owner';

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#F8FAFC] selection:bg-indigo-600 selection:text-white pb-16">
      <AppHeader
        user={user}
        userRole={userRole}
        organizations={organizations}
        currentOrgId={selectedOrgId}
        onSelectOrg={(orgId) => setSelectedOrgId(orgId)}
      />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-6 space-y-8">
        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-semibold text-rose-300 shadow-md flex justify-between items-center animate-fade-in">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold underline hover:text-white">
              Dismiss
            </button>
          </div>
        )}

        {/* Welcome Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Welcome back, {user?.name || 'Workspace Member'} 👋
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Overview of active projects, pending deliverables, and intent intelligence.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowProjModal(true)}
              leftIcon={<span>+</span>}
            >
              New Project
            </Button>
          </div>
        </div>

        {/* Role-Aware Summary Metrics */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4 sm:p-5 space-y-2 shadow-md hover:border-slate-700 transition-all card-glow-hover">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
              {isAdmin ? 'Organizations' : isClient ? 'Workspaces' : 'Your Team'}
            </span>
            <div className="text-2xl font-extrabold text-slate-100">{organizations.length}</div>
            <p className="text-[11px] text-slate-500 font-medium">Active memberships</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4 sm:p-5 space-y-2 shadow-md hover:border-indigo-500/60 transition-all card-glow-hover">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
              {isClient ? 'Projects' : 'Assigned Projects'}
            </span>
            <div className="text-2xl font-extrabold text-indigo-400">{projects.length}</div>
            <p className="text-[11px] text-slate-500 font-medium">In execution phase</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4 sm:p-5 space-y-2 shadow-md hover:border-amber-500/60 transition-all card-glow-hover">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
              {isClient ? 'Approvals Pending' : 'Pending Actions'}
            </span>
            <div className="text-2xl font-extrabold text-amber-400">{actionItems.length}</div>
            <p className="text-[11px] text-slate-500 font-medium">Require immediate review</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4 sm:p-5 space-y-2 shadow-md hover:border-emerald-500/60 transition-all card-glow-hover">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
              Notifications
            </span>
            <div className="text-2xl font-extrabold text-emerald-400">
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
          {/* Projects Column */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-100 tracking-tight">
                  Active Projects
                </h2>
                <p className="text-xs text-slate-400">
                  {isClient ? 'Track deliverable reviews and handoffs' : 'Manage project execution, work items, and team workspace'}
                </p>
              </div>
              <Link
                href="/projects"
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                View All Projects →
              </Link>
            </div>

            {projects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-[#111827] p-8 text-center text-slate-400 text-xs space-y-2">
                <p className="text-3xl">📁</p>
                <p className="font-bold text-slate-200 text-sm">No active projects yet.</p>
                <p className="text-slate-400 max-w-sm mx-auto">
                  Create a project inside your organization to start messaging, requirement tracking, and deliverable reviews.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowProjModal(true)}
                >
                  Create Your First Project
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {projects.map((proj) => (
                  <Link
                    key={proj.id}
                    href={`/projects/${proj.id}`}
                    className="group rounded-2xl border border-slate-800 bg-[#111827] p-5 shadow-md hover:shadow-xl hover:border-indigo-500/60 transition-all space-y-3 block"
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

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
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
                  + Create Workspace
                </button>
              </div>

              <div className="space-y-2.5">
                {organizations.map((org) => (
                  <div
                    key={org.id}
                    className="rounded-2xl border border-slate-800 bg-[#111827] p-4 flex items-center justify-between gap-3 shadow-md"
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
                <h3 className="text-sm font-extrabold text-slate-100">Recent Activity</h3>
                <Link href="/notifications" className="text-xs text-indigo-400 hover:text-indigo-300 font-bold">
                  View All →
                </Link>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-[#111827] divide-y divide-slate-800 overflow-hidden shadow-md">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500 font-medium">No recent updates</div>
                ) : (
                  notifications.slice(0, 4).map((n) => (
                    <Link
                      key={n.id}
                      href={getNotificationTargetUrl(n)}
                      className="p-3 text-xs block hover:bg-[#1E293B]/60 transition-colors space-y-1"
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
      <Modal
        isOpen={showOrgModal}
        onClose={() => setShowOrgModal(false)}
        title="Create New Organization"
        description="Establish a shared workspace for client collaboration and project management."
      >
        <form onSubmit={handleCreateOrg} className="space-y-4">
          <Input
            label="Organization Name"
            required
            value={orgName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOrgName(e.target.value)}
            placeholder="e.g. Nexus Digital Agency"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowOrgModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={creatingOrg}
            >
              Create Workspace
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Project Modal */}
      <Modal
        isOpen={showProjModal}
        onClose={() => setShowProjModal(false)}
        title="Create New Project"
        description="Add a new project to your organization to start messaging, work items, and deliverable tracking."
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          <Select
            label="Target Organization"
            value={selectedOrgId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedOrgId(e.target.value)}
            options={organizations.map((org) => ({
              label: `${org.name} (${org.role})`,
              value: org.id,
            }))}
          />

          <Input
            label="Project Name"
            required
            value={projName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProjName(e.target.value)}
            placeholder="e.g. E-Commerce Redesign"
          />

          <Textarea
            label="Description (Optional)"
            value={projDesc}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setProjDesc(e.target.value)}
            placeholder="Project goals, scope, and key deliverables..."
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowProjModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={creatingProj}
            >
              Create Project
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
