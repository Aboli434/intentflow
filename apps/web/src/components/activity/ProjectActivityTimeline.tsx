'use client';

import React, { useEffect, useState } from 'react';
import { ProjectActivity } from '@intentflow/types';
import { apiGetProjectActivity } from '../../lib/api-client';

interface ProjectActivityTimelineProps {
  projectId: string;
  orgId?: string;
  userRole?: string;
}

type ActivityCategory = 'All' | 'Work' | 'Deliverables' | 'Team' | 'Conversations' | 'Completion' | 'System';

export function ProjectActivityTimeline({
  projectId,
  orgId,
  userRole = 'developer',
}: ProjectActivityTimelineProps) {
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ActivityCategory>('All');

  const fetchTimeline = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGetProjectActivity(projectId, 50, orgId);
      setActivities(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load project activity timeline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchTimeline();
    }
  }, [projectId]);

  const isClientView = userRole === 'client';

  const formatActivityText = (act: ProjectActivity): string => {
    const title = act.metadata?.title || act.metadata?.name || '';
    switch (act.type) {
      case 'message_sent':
        return `sent a message`;
      case 'intent_confirmed':
        return `confirmed project requirement: "${title || 'Intent'}"`;
      case 'clarification_requested':
        return `requested clarification: "${act.metadata?.questionText || 'Question'}"`;
      case 'work_proposal_generated':
        return isClientView ? `updated project work plan` : `generated AI work proposal`;
      case 'work_proposal_approved':
        return `approved work proposal & created execution items`;
      case 'work_assigned':
        return `assigned task "${title || 'work item'}"`;
      case 'work_started':
      case 'work_in_progress':
        return `started work on "${title || 'work item'}"`;
      case 'work_blocked':
        return `marked "${title || 'work item'}" as Blocked`;
      case 'work_completed':
        return `completed work item: "${title || 'work item'}"`;
      case 'deliverable_created':
        return `created deliverable: "${title || 'Deliverable'}"`;
      case 'deliverable_submitted':
        return `submitted deliverable "${title}" for client review`;
      case 'deliverable_approved':
        return `approved deliverable: "${title}"`;
      case 'deliverable_changes_requested':
        return `requested changes on deliverable "${title}"`;
      case 'revision_started':
        return `started working on requested revisions`;
      case 'revision_resolved':
      case 'closure_revision_resolved':
        return `resolved revision request for "${title || 'deliverable'}"`;
      case 'project_member_assigned':
        return `assigned team member ${act.metadata?.userName || ''} to project`;
      case 'project_member_role_changed':
        return `updated team member role to ${act.metadata?.newRole || act.metadata?.role || 'new role'}`;
      case 'project_member_removed':
        return `removed team member from project`;
      case 'closure_submitted':
        return `submitted final project closure for client approval`;
      case 'closure_approved':
        return `approved project closure and initiated handoff`;
      case 'closure_changes_requested':
        return `requested changes on project closure`;
      case 'handoff_delivered':
        return `delivered project final handoff package`;
      case 'handoff_acknowledged':
        return `acknowledged final project handoff and completed closure`;
      case 'project_completed':
        return `marked project as completed! 🎉`;
      default:
        // Replace technical underscores with clean spaces for fallback
        return act.type.replace(/_/g, ' ');
    }
  };

  const getCategoryFromType = (type: string, entityType?: string): ActivityCategory => {
    if (type.startsWith('work_') || type.startsWith('intent_') || entityType === 'work_item' || entityType === 'work_proposal') return 'Work';
    if (type.startsWith('deliverable_') || type.startsWith('revision_') || type === 'milestone_completed' || entityType === 'deliverable') return 'Deliverables';
    if (type.startsWith('project_member_') || entityType === 'project_member') return 'Team';
    if (type === 'message_sent' || type === 'clarification_requested' || entityType === 'conversation') return 'Conversations';
    if (type.startsWith('closure_') || type.startsWith('handoff_') || type === 'project_completed' || entityType === 'project_closure') return 'Completion';
    return 'System';
  };

  const getCategoryIcon = (cat: ActivityCategory): string => {
    switch (cat) {
      case 'Work': return '⚡';
      case 'Deliverables': return '📦';
      case 'Team': return '👥';
      case 'Conversations': return '💬';
      case 'Completion': return '✅';
      default: return '📜';
    }
  };

  const getBadgeStyle = (cat: ActivityCategory): string => {
    switch (cat) {
      case 'Work': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
      case 'Deliverables': return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      case 'Team': return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'Conversations': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      case 'Completion': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      default: return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
    }
  };

  // Group activities into date headers ("Today", "Yesterday", "MMM D, YYYY")
  const groupActivitiesByDate = (items: ProjectActivity[]) => {
    const groups: { label: string; items: ProjectActivity[] }[] = [];
    const now = new Date();
    const todayStr = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    items.forEach((item) => {
      const itemDate = new Date(item.createdAt);
      const itemDateStr = itemDate.toDateString();

      let label = itemDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      if (itemDateStr === todayStr) label = 'Today';
      else if (itemDateStr === yesterdayStr) label = 'Yesterday';

      let group = groups.find((g) => g.label === label);
      if (!group) {
        group = { label, items: [] };
        groups.push(group);
      }
      group.items.push(item);
    });

    return groups;
  };

  // Filter activities
  const filteredActivities = activities.filter((act) => {
    if (activeFilter === 'All') return true;
    const cat = getCategoryFromType(act.type, act.entityType || undefined);
    return cat === activeFilter;
  });

  const groupedActivities = groupActivitiesByDate(filteredActivities);

  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-4 sm:p-6 space-y-6 text-[#F8FAFC] shadow-md">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1F2937] pb-4">
        <div>
          <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest">
            Audit Log & History
          </span>
          <h3 className="text-base font-extrabold text-[#F8FAFC] tracking-tight">Project Activity Timeline</h3>
        </div>

        <button
          type="button"
          onClick={fetchTimeline}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto text-xs font-bold text-[#94A3B8] hover:text-[#F8FAFC] bg-[#151D2E] hover:bg-[#1F2937] px-3 py-1.5 rounded-xl border border-[#1F2937] transition-all"
        >
          <span>🔄</span>
          <span>Refresh</span>
        </button>
      </div>

      {/* Category Filters */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-none">
        {(['All', 'Work', 'Deliverables', 'Team', 'Conversations', 'Completion', 'System'] as ActivityCategory[]).map(
          (cat) => {
            const isActive = activeFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveFilter(cat)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-[#111827] text-[#94A3B8] border-[#1F2937] hover:text-[#F8FAFC] hover:bg-[#151D2E]'
                }`}
              >
                {getCategoryIcon(cat)} {cat}
              </button>
            );
          }
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-12 text-center text-xs text-[#94A3B8] space-y-2 animate-pulse">
          <div className="h-4 bg-[#1F2937] rounded-xl w-1/3 mx-auto" />
          <p className="font-semibold">Loading activity history...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs p-4 rounded-xl flex items-center justify-between font-semibold">
          <span>{error}</span>
          <button onClick={fetchTimeline} className="underline font-bold hover:text-rose-300 ml-4">
            Retry
          </button>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="py-12 text-center text-xs text-[#94A3B8] space-y-1">
          <p className="text-base">📜</p>
          <p className="font-bold text-[#F8FAFC]">No activity recorded for this view.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedActivities.map((group) => (
            <div key={group.label} className="space-y-3">
              {/* Date Header */}
              <div className="sticky top-0 z-10 bg-[#111827]/95 backdrop-blur-sm py-1">
                <span className="text-xs font-bold font-mono uppercase text-indigo-400 tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30">
                  {group.label}
                </span>
              </div>

              {/* Entries */}
              <div className="relative border-l border-[#1F2937] ml-3 space-y-4 pl-5">
                {group.items.map((act) => {
                  const cat = getCategoryFromType(act.type, act.entityType || undefined);
                  const icon = getCategoryIcon(cat);
                  const badgeStyle = getBadgeStyle(cat);
                  const timeStr = new Date(act.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div key={act.id} className="relative group">
                      {/* Timeline dot */}
                      <div className="absolute -left-[26px] top-1.5 h-3.5 w-3.5 rounded-full bg-[#111827] border-2 border-indigo-500 group-hover:bg-indigo-500 transition-all shadow-sm" />

                      <div className="bg-[#0B0F19]/60 border border-[#1F2937] rounded-2xl p-3.5 space-y-2 hover:border-[#374151] transition-all">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-extrabold text-[#F8FAFC]">
                                {act.actorName || 'System'}
                              </span>
                              <span className="text-xs text-[#94A3B8] leading-snug font-medium">
                                {formatActivityText(act)}
                              </span>
                            </div>
                          </div>

                          <span className="text-[10px] text-[#64748B] font-mono shrink-0 pt-0.5">
                            {timeStr}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${badgeStyle}`}
                          >
                            {icon} {cat}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

