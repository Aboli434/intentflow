'use client';

import React, { useEffect, useState } from 'react';
import {
  Project,
  ProjectMemberDetail,
  Deliverable,
  ProjectCompletionEligibility,
  ProjectActivity,
  WorkItem,
} from '@intentflow/types';
import {
  apiGetProjectMembers,
  apiGetProjectDeliverables,
  apiGetProjectCompletionStatus,
  apiGetProjectActivity,
  apiGetProjectWork,
  apiGetProjectClosures,
} from '../../lib/api-client';
import { WorkspaceTabKey } from './ProjectWorkspaceTabs';
import { ProjectStatusBanner, DerivedProjectState } from './ProjectStatusBanner';
import { ActionRequiredCard, ActionItem } from '../dashboard/ActionRequiredCard';
import { getNotificationTargetUrl } from '../../lib/notification-utils';

interface ProjectWorkspaceOverviewProps {
  project: Project;
  userRole?: string; // Org role
  projectRole?: string; // Project role
  onNavigateTab: (tab: WorkspaceTabKey) => void;
}

export function ProjectWorkspaceOverview({
  project,
  userRole,
  projectRole,
  onNavigateTab,
}: ProjectWorkspaceOverviewProps) {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<ProjectMemberDetail[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [completion, setCompletion] = useState<ProjectCompletionEligibility | null>(null);
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [closures, setClosures] = useState<any[]>([]);

  const effectiveRole = projectRole || userRole || 'developer';
  const isClientRole = effectiveRole === 'client';
  const isManagerRole = userRole === 'admin' || effectiveRole === 'manager';
  const isDeveloperRole = effectiveRole === 'developer' || (isManagerRole && !isClientRole);

  useEffect(() => {
    loadOverviewData();
  }, [project.id]);

  const loadOverviewData = async () => {
    setLoading(true);
    try {
      const [mList, dList, cStatus, actList, wData, clList] = await Promise.all([
        apiGetProjectMembers(project.id).catch(() => []),
        apiGetProjectDeliverables(project.id).catch(() => []),
        apiGetProjectCompletionStatus(project.id).catch(() => null),
        apiGetProjectActivity(project.id, 5).catch(() => []),
        apiGetProjectWork(project.id).catch(() => ({ workItems: [], metrics: {} })),
        apiGetProjectClosures(project.id).catch(() => []),
      ]);

      setMembers(mList);
      setDeliverables(dList);
      setCompletion(cStatus);
      setActivities(actList);
      setWorkItems(wData.workItems || []);
      setClosures(clList);
    } finally {
      setLoading(false);
    }
  };

  // Metrics
  const completedWorkCount = workItems.filter((w) => w.status === 'completed').length;
  const totalWorkCount = workItems.length;
  const approvedDeliverablesCount = deliverables.filter((d) => d.status === 'approved').length;
  const totalDeliverablesCount = deliverables.length;
  const completionPercentage = completion
    ? completion.totalWorkCount > 0
      ? Math.round((completion.completedWorkCount / completion.totalWorkCount) * 100)
      : completion.eligible
      ? 100
      : 0
    : 0;

  // State Banner calculation
  const pendingReviewDeliverables = deliverables.filter(
    (d) => d.status === 'ready_for_review' || d.status === 'in_review'
  );
  const changesReqDeliverables = deliverables.filter((d) => d.status === 'changes_requested');
  const pendingClosure = closures.find((c) => c.status === 'pending_client_approval');

  let derivedState: DerivedProjectState = 'ACTIVE';
  if (project.status === 'completed' || completion?.eligible) {
    derivedState = 'COMPLETED';
  } else if (pendingClosure) {
    derivedState = 'COMPLETION_REVIEW';
  } else if (pendingReviewDeliverables.length > 0) {
    derivedState = 'CLIENT_REVIEW';
  } else if (changesReqDeliverables.length > 0) {
    derivedState = 'CHANGES_REQUESTED';
  } else if (workItems.some((w) => w.status === 'in_progress')) {
    derivedState = 'WORK_IN_PROGRESS';
  }

  // Derive Action Required items strictly from project state
  const actionItems: ActionItem[] = [];
  if (isClientRole) {
    if (pendingReviewDeliverables.length > 0) {
      actionItems.push({
        id: 'review-delivs',
        title: `Review ${pendingReviewDeliverables.length} Deliverable(s)`,
        subtitle: 'Review and approve submitted project deliverables.',
        targetUrl: `/projects/${project.id}?tab=deliverables`,
        badgeLabel: 'Action Required',
      });
    }
    if (pendingClosure) {
      actionItems.push({
        id: 'review-closure',
        title: 'Review Final Project Closure',
        subtitle: 'The team has submitted the project for final client closure.',
        targetUrl: `/projects/${project.id}?tab=completion`,
        badgeLabel: 'Final Review',
      });
    }
  } else if (isDeveloperRole) {
    if (changesReqDeliverables.length > 0) {
      actionItems.push({
        id: 'resolve-revisions',
        title: `Resolve ${changesReqDeliverables.length} Revision Request(s)`,
        subtitle: 'Client requested changes on submitted deliverables.',
        targetUrl: `/projects/${project.id}?tab=deliverables`,
        badgeLabel: 'Revisions Needed',
      });
    }
    const myAssignedWork = workItems.filter((w) => w.status !== 'completed');
    if (myAssignedWork.length > 0) {
      actionItems.push({
        id: 'execute-work',
        title: `Execute ${myAssignedWork.length} Work Item(s)`,
        subtitle: 'Complete assigned work items in execution list.',
        targetUrl: `/projects/${project.id}?tab=work`,
        badgeLabel: 'In Progress',
      });
    }
  }

  if (isManagerRole && members.length <= 1) {
    actionItems.push({
      id: 'assign-team',
      title: 'Assign Project Team Members',
      subtitle: 'Add organization members or clients to this project workspace.',
      targetUrl: `/projects/${project.id}?tab=team`,
      badgeLabel: 'Setup Team',
    });
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-20 bg-[#111827] rounded-2xl border border-[#1F2937]" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-[#111827] rounded-2xl border border-[#1F2937]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-[#F8FAFC]">
      {/* 1. Project Header Banner */}
      <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-5 sm:p-6 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-100 tracking-tight">{project.name}</h2>
            <span className="px-3 py-0.5 text-xs font-mono font-bold rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 uppercase">
              {project.status}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1.5 max-w-2xl leading-relaxed font-medium">
            {project.description || 'No project description provided.'}
          </p>
        </div>

        <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-1 border-t sm:border-t-0 border-[#1F2937] pt-3 sm:pt-0 text-xs font-mono text-slate-400 shrink-0">
          <div>
            Org: <span className="text-slate-100 font-bold">{project.organizationName}</span>
          </div>
          <div>
            Created: <span className="text-slate-400">{new Date(project.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* 2. Prominent Project Status Banner */}
      <ProjectStatusBanner
        state={derivedState}
        userRole={effectiveRole}
        onNavigateTab={onNavigateTab}
        pendingDeliverableCount={pendingReviewDeliverables.length}
        changesRequestedCount={changesReqDeliverables.length}
      />

      {/* 3. Top Summary Metrics Grid (4 Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div
          onClick={() => onNavigateTab('work')}
          className="bg-[#111827] border border-[#1F2937] hover:border-indigo-500/60 rounded-2xl p-4 cursor-pointer transition-all shadow-md hover:shadow-xl group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Work Progress</span>
            <span className="text-sm">⚡</span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-100 mt-2 group-hover:text-indigo-400 transition-colors">
            {completedWorkCount} <span className="text-xs text-slate-500 font-normal">/ {totalWorkCount}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Work Items Completed</p>
        </div>

        <div
          onClick={() => onNavigateTab('deliverables')}
          className="bg-[#111827] border border-[#1F2937] hover:border-cyan-500/60 rounded-2xl p-4 cursor-pointer transition-all shadow-md hover:shadow-xl group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Deliverables</span>
            <span className="text-sm">📦</span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-cyan-400 mt-2 group-hover:text-cyan-300 transition-colors">
            {approvedDeliverablesCount} <span className="text-xs text-slate-500 font-normal">/ {totalDeliverablesCount}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Approved Deliverables</p>
        </div>

        <div
          onClick={() => onNavigateTab('completion')}
          className="bg-[#111827] border border-[#1F2937] hover:border-emerald-500/60 rounded-2xl p-4 cursor-pointer transition-all shadow-md hover:shadow-xl group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Completion</span>
            <span className="text-sm">✅</span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-400 mt-2 group-hover:text-emerald-300 transition-colors">
            {completionPercentage}%
          </div>
          <div className="w-full bg-[#1F2937] h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('team')}
          className="bg-[#111827] border border-[#1F2937] hover:border-purple-500/60 rounded-2xl p-4 cursor-pointer transition-all shadow-md hover:shadow-xl group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Team Members</span>
            <span className="text-sm">👥</span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-purple-400 mt-2 group-hover:text-purple-300 transition-colors">
            {members.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Assigned Members</p>
        </div>
      </div>

      {/* 4. Action Required Section */}
      <ActionRequiredCard userRole={effectiveRole} items={actionItems} />

      {/* 5. 2-Column Grid: Team Summary & Deliverables Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Summary */}
        <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-5 space-y-4 shadow-md">
          <div className="flex items-center justify-between border-b border-[#1F2937] pb-3">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>👥</span> Project Team ({members.length})
            </h3>
            <button
              onClick={() => onNavigateTab('team')}
              className="text-xs text-indigo-400 hover:underline font-bold"
            >
              View Team →
            </button>
          </div>

          <div className="space-y-2">
            {members.slice(0, 4).map((m) => {
              const initials = m.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
              return (
                <div
                  key={m.id}
                  className="p-3 bg-[#0B0F19]/60 border border-[#1F2937] rounded-xl flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-950 border border-indigo-500/30 flex items-center justify-center font-bold text-xs text-indigo-300 shrink-0 font-mono">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-100 truncate">{m.name}</div>
                      <div className="text-[11px] text-slate-400 truncate">{m.email}</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] uppercase font-mono font-bold rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shrink-0">
                    {m.projectRole}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Deliverables Summary */}
        <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-5 space-y-4 shadow-md">
          <div className="flex items-center justify-between border-b border-[#1F2937] pb-3">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>📦</span> Deliverables Summary ({deliverables.length})
            </h3>
            <button
              onClick={() => onNavigateTab('deliverables')}
              className="text-xs text-indigo-400 hover:underline font-bold"
            >
              View Deliverables →
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3.5 bg-[#0B0F19]/60 border border-[#1F2937] rounded-xl">
              <div className="text-slate-400 font-semibold">Approved</div>
              <div className="text-lg font-bold text-emerald-400 mt-1">
                {approvedDeliverablesCount}
              </div>
            </div>
            <div className="p-3.5 bg-[#0B0F19]/60 border border-[#1F2937] rounded-xl">
              <div className="text-slate-400 font-semibold">In Review</div>
              <div className="text-lg font-bold text-cyan-400 mt-1">
                {pendingReviewDeliverables.length}
              </div>
            </div>
            <div className="p-3.5 bg-[#0B0F19]/60 border border-[#1F2937] rounded-xl">
              <div className="text-slate-400 font-semibold">Changes Requested</div>
              <div className="text-lg font-bold text-amber-400 mt-1">
                {changesReqDeliverables.length}
              </div>
            </div>
            <div className="p-3.5 bg-[#0B0F19]/60 border border-[#1F2937] rounded-xl">
              <div className="text-slate-400 font-semibold">Draft</div>
              <div className="text-lg font-bold text-slate-300 mt-1">
                {deliverables.filter((d) => d.status === 'draft').length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Recent Activity Timeline Preview */}
      <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-5 space-y-4 shadow-md">
        <div className="flex items-center justify-between border-b border-[#1F2937] pb-3">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <span>📜</span> Recent Activity Timeline
          </h3>
          <button
            onClick={() => onNavigateTab('activity')}
            className="text-xs text-indigo-400 hover:underline font-bold"
          >
            View Full Timeline →
          </button>
        </div>

        {activities.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs">
            No recent activity logged for this project yet.
          </div>
        ) : (
          <div className="space-y-2">
            {activities.slice(0, 4).map((act) => (
              <div
                key={act.id}
                className="p-3 bg-[#0B0F19]/60 border border-[#1F2937] rounded-xl flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                  <div className="min-w-0">
                    <span className="font-bold text-slate-100 block capitalize truncate">
                      {act.type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[11px] text-slate-400 block truncate font-medium">
                      By {act.actorName || 'User'} • {new Date(act.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
