'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiGetProjectDetail } from '@/lib/api-client';
import { Project, User } from '@intentflow/types';
import { ConversationView } from '@/components/conversations/ConversationView';
import { WorkView } from '@/components/work/WorkView';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { DeliverablesView } from '@/components/deliverables/DeliverablesView';
import { ProjectActivityTimeline } from '@/components/activity/ProjectActivityTimeline';
import { ProjectCompletionView } from '@/components/completion/ProjectCompletionView';

export default function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'conversations' | 'work' | 'deliverables' | 'completion' | 'activity' | 'overview'>('conversations');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const rawUser = typeof window !== 'undefined' ? localStorage.getItem('intentflow_user') : null;
    if (rawUser) {
      try { setCurrentUser(JSON.parse(rawUser)); } catch {}
    }

    apiGetProjectDetail(resolvedParams.projectId)
      .then(setProject)
      .catch((err) => setError(err instanceof Error ? err.message : 'Access denied or project not found'))
      .finally(() => setLoading(false));
  }, [resolvedParams.projectId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-sm font-mono text-indigo-400 animate-pulse">Loading Project Workspace...</div>
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

  const membersList = project.members ? (project.members.map((m) => m.user).filter(Boolean) as User[]) : [];
  const myMember = project.members?.find((m) => m.userId === currentUser?.id);
  const isClientRole = myMember?.role === 'client';
  const isDeveloperRole = myMember?.role === 'developer' || !isClientRole;

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-xs text-sky-400 hover:underline">
              ← Projects
            </Link>
            <span className="text-slate-700">/</span>
            <span className="text-xs font-mono text-slate-400">{project.organizationName}</span>
            <span className="text-slate-700">/</span>
            <h1 className="text-sm font-bold text-white">{project.name}</h1>
          </div>

          <div className="flex items-center gap-4">
            <NotificationBell />
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-mono font-medium text-emerald-400 border border-emerald-500/20 uppercase">
              {project.status}
            </span>
          </div>
        </div>
      </header>

      {/* Navigation Sub-Header */}
      <div className="border-b border-slate-800/80 bg-slate-950 px-6 overflow-x-auto scrollbar-none">
        <div className="mx-auto flex max-w-7xl gap-4 sm:gap-8 whitespace-nowrap">
          <button
            onClick={() => setActiveTab('conversations')}
            className={`py-3 text-xs font-semibold border-b-2 transition shrink-0 ${
              activeTab === 'conversations'
                ? 'border-indigo-400 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            💬 Conversations
          </button>
          <button
            onClick={() => setActiveTab('work')}
            className={`py-3 text-xs font-semibold border-b-2 transition shrink-0 ${
              activeTab === 'work'
                ? 'border-indigo-400 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ⚡ Work Execution Workspace
          </button>
          <button
            onClick={() => setActiveTab('deliverables')}
            className={`py-3 text-xs font-semibold border-b-2 transition shrink-0 ${
              activeTab === 'deliverables'
                ? 'border-indigo-400 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📦 Deliverables & Approval
          </button>
          <button
            onClick={() => setActiveTab('completion')}
            className={`py-3 text-xs font-semibold border-b-2 transition shrink-0 ${
              activeTab === 'completion'
                ? 'border-indigo-400 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ✅ Completion & Handoff
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`py-3 text-xs font-semibold border-b-2 transition shrink-0 ${
              activeTab === 'activity'
                ? 'border-indigo-400 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📜 Activity Log
          </button>
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 text-xs font-semibold border-b-2 transition shrink-0 ${
              activeTab === 'overview'
                ? 'border-indigo-400 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📋 Overview
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="mx-auto flex-1 w-full max-w-7xl p-6">
        {activeTab === 'conversations' ? (
          <ConversationView
            projectId={project.id}
            onNavigateToWorkTab={() => setActiveTab('work')}
          />
        ) : activeTab === 'work' ? (
          <WorkView
            projectId={project.id}
            projectMembers={membersList}
          />
        ) : activeTab === 'deliverables' ? (
          <DeliverablesView
            projectId={project.id}
            isClient={isClientRole}
            isDeveloper={isDeveloperRole}
          />
        ) : activeTab === 'completion' ? (
          <ProjectCompletionView
            projectId={project.id}
            isClient={isClientRole}
            isDeveloper={isDeveloperRole}
          />
        ) : activeTab === 'activity' ? (
          <ProjectActivityTimeline
            projectId={project.id}
            orgId={project.organizationId}
          />
        ) : (
          <div className="space-y-8">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-white mb-2">{project.name}</h2>
                <p className="text-sm text-slate-300">{project.description || 'No project description provided.'}</p>
              </div>

              <div className="flex gap-6 border-t border-slate-800 pt-4 text-xs font-mono text-slate-400">
                <div>Organization: <span className="text-slate-200">{project.organizationName}</span></div>
                <div>Created: <span className="text-slate-200">{new Date(project.createdAt).toLocaleDateString()}</span></div>
              </div>
            </div>

            {/* Project Members */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-white">Project Members</h3>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                {project.members && project.members.length > 0 ? (
                  <div className="divide-y divide-slate-800">
                    {project.members.map((pm) => (
                      <div key={pm.id} className="flex items-center justify-between p-4">
                        <div>
                          <div className="text-sm font-semibold text-slate-100">{pm.user?.name}</div>
                          <div className="text-xs text-slate-400 font-mono">{pm.user?.email}</div>
                        </div>
                        <span className="uppercase text-[10px] font-mono px-2.5 py-1 rounded bg-slate-800 text-indigo-400 font-semibold">
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
          </div>
        )}
      </main>
    </div>
  );
}
