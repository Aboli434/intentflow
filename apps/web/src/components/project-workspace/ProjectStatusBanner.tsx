'use client';

import React from 'react';
import { WorkspaceTabKey } from './ProjectWorkspaceTabs';

export type DerivedProjectState =
  | 'ACTIVE'
  | 'WORK_IN_PROGRESS'
  | 'CLIENT_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'COMPLETION_REVIEW'
  | 'HANDOFF_READY'
  | 'COMPLETED';

interface ProjectStatusBannerProps {
  state: DerivedProjectState;
  userRole?: string; // 'client' | 'developer' | 'manager' | 'admin'
  onNavigateTab?: (tab: WorkspaceTabKey) => void;
  pendingDeliverableCount?: number;
  changesRequestedCount?: number;
}

export function ProjectStatusBanner({
  state,
  userRole = 'developer',
  onNavigateTab,
  pendingDeliverableCount = 0,
  changesRequestedCount = 0,
}: ProjectStatusBannerProps) {
  const isClient = userRole === 'client';

  const getStateConfig = () => {
    switch (state) {
      case 'CLIENT_REVIEW':
        return {
          badge: 'CLIENT REVIEW',
          badgeStyle: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          title: isClient
            ? `${pendingDeliverableCount || 'Deliverables'} waiting for your review`
            : `${pendingDeliverableCount || 'Deliverables'} submitted for client review`,
          description: isClient
            ? 'The development team has submitted deliverables for your review and approval.'
            : 'Deliverables are currently with the client awaiting review.',
          actionLabel: isClient ? 'Review Deliverables' : 'View Deliverables',
          targetTab: 'deliverables' as WorkspaceTabKey,
          accentColor: 'border-amber-500/30 bg-amber-950/20',
        };

      case 'CHANGES_REQUESTED':
        return {
          badge: 'CHANGES REQUESTED',
          badgeStyle: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
          title: isClient
            ? 'Revision requested on deliverables'
            : `Client requested changes on ${changesRequestedCount || 'deliverable(s)'}`,
          description: isClient
            ? 'Your feedback has been sent to the team. Revisions are in progress.'
            : 'Please review client comments and resolve requested revisions.',
          actionLabel: isClient ? 'View Revisions' : 'View Changes & Resolve',
          targetTab: 'deliverables' as WorkspaceTabKey,
          accentColor: 'border-rose-500/30 bg-rose-950/20',
        };

      case 'COMPLETION_REVIEW':
        return {
          badge: 'COMPLETION REVIEW',
          badgeStyle: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
          title: isClient
            ? 'Final project closure pending your approval'
            : 'Final project closure submitted for client approval',
          description: isClient
            ? 'The team has completed all checklist criteria. Please review final project closure.'
            : 'Project closure is currently waiting for client final sign-off.',
          actionLabel: isClient ? 'Review Project Closure' : 'View Completion Status',
          targetTab: 'completion' as WorkspaceTabKey,
          accentColor: 'border-indigo-500/30 bg-indigo-950/20',
        };

      case 'HANDOFF_READY':
        return {
          badge: 'HANDOFF READY',
          badgeStyle: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
          title: 'Final handoff package prepared',
          description: isClient
            ? 'Project handoff package and documentation are ready for your acknowledgement.'
            : 'Handoff assets delivered. Awaiting client acknowledgement.',
          actionLabel: isClient ? 'Acknowledge Handoff' : 'View Handoff Package',
          targetTab: 'completion' as WorkspaceTabKey,
          accentColor: 'border-sky-500/30 bg-sky-950/20',
        };

      case 'COMPLETED':
        return {
          badge: 'COMPLETED 🎉',
          badgeStyle: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          title: 'Project successfully completed!',
          description: 'All work items, deliverables, and handoffs have been finalized and acknowledged.',
          actionLabel: 'View Final Summary',
          targetTab: 'completion' as WorkspaceTabKey,
          accentColor: 'border-emerald-500/30 bg-emerald-950/20',
        };

      case 'WORK_IN_PROGRESS':
        return {
          badge: 'WORK IN PROGRESS',
          badgeStyle: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
          title: 'Development actively in progress',
          description: isClient
            ? 'The team is actively executing work items and preparing deliverables.'
            : 'Execute assigned tasks and submit work for review.',
          actionLabel: isClient ? 'Track Work Progress' : 'View Work Items',
          targetTab: 'work' as WorkspaceTabKey,
          accentColor: 'border-indigo-500/30 bg-indigo-950/20',
        };

      default:
        return {
          badge: 'ACTIVE',
          badgeStyle: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          title: 'Project is active',
          description: 'Team collaboration and workspace operations are active.',
          actionLabel: 'View Work',
          targetTab: 'work' as WorkspaceTabKey,
          accentColor: 'border-[#1F2937] bg-[#111827]',
        };
    }
  };

  const config = getStateConfig();

  return (
    <div
      className={`rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-md ${config.accentColor}`}
    >
      <div className="space-y-1.5 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span
            className={`px-2.5 py-0.5 text-[10px] font-mono font-bold rounded-full border uppercase tracking-wider ${config.badgeStyle}`}
          >
            {config.badge}
          </span>
          <h3 className="text-sm sm:text-base font-bold text-slate-100 tracking-tight truncate">
            {config.title}
          </h3>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
          {config.description}
        </p>
      </div>

      {onNavigateTab && (
        <button
          onClick={() => onNavigateTab(config.targetTab)}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-all shrink-0 min-h-[40px] cursor-pointer"
        >
          <span>{config.actionLabel}</span>
          <span>→</span>
        </button>
      )}
    </div>
  );
}
