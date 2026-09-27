'use client';

import React, { useEffect, useState } from 'react';
import { ProjectActivity } from '@intentflow/types';
import { apiGetProjectActivity } from '../../lib/api-client';

interface ProjectActivityTimelineProps {
  projectId: string;
  orgId?: string;
  userRole?: string;
}

export function ProjectActivityTimeline({ projectId, orgId, userRole = 'developer' }: ProjectActivityTimelineProps) {
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

  const formatActivityText = (act: ProjectActivity) => {
    switch (act.type) {
      case 'message_sent':
        return `sent a message`;
      case 'intent_confirmed':
        return `confirmed project requirement: "${act.metadata?.title || 'Intent'}"`;
      case 'clarification_requested':
        return `requested clarification: "${act.metadata?.questionText || 'Question'}"`;
      case 'work_proposal_generated':
        return isClientView ? `updated project work plan` : `generated AI work proposal`;
      case 'work_proposal_approved':
        return `approved work proposal & created execution items`;
      case 'work_assigned':
        return `assigned task "${act.metadata?.title || 'work item'}"`;
      case 'work_started':
      case 'work_in_progress':
        return `moved "${act.metadata?.title || 'work item'}" to In Progress`;
      case 'work_blocked':
        return `marked "${act.metadata?.title || 'work item'}" as Blocked`;
      case 'work_completed':
        return `completed work item: "${act.metadata?.title || 'work item'}"`;
      default:
        return `performed project update (${act.type})`;
    }
  };

  const getBadgeColor = (type: string) => {
    if (type.includes('completed')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    if (type.includes('blocked')) return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
    if (type.includes('in_progress') || type.includes('started')) return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
    if (type.includes('confirmed')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 text-slate-200 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Audit Log</span>
          <h3 className="text-base font-bold text-slate-100">Project Activity Timeline</h3>
        </div>
        <button
          type="button"
          onClick={fetchTimeline}
          className="text-xs text-slate-400 hover:text-slate-200 transition"
        >
          🔄 Refresh
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500 animate-pulse">Loading activity history...</div>
      ) : error ? (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3.5 rounded-lg">
          {error}
        </div>
      ) : activities.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400">No project activity recorded yet.</div>
      ) : (
        <div className="relative border-l border-slate-800 ml-3 space-y-6 pl-6 pt-2">
          {activities.map((act) => {
            const dateStr = new Date(act.createdAt).toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div key={act.id} className="relative group">
                {/* Timeline node marker */}
                <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full bg-indigo-500 border-2 border-slate-900 group-hover:scale-125 transition" />

                <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5 space-y-1.5 hover:border-slate-700 transition">
                  <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-100">{act.actorName || 'System'}</span>
                      <span className="text-slate-300">{formatActivityText(act)}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">{dateStr}</span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border font-semibold ${getBadgeColor(act.type)}`}>
                      {act.entityType}
                    </span>
                    {act.metadata?.from && act.metadata?.to && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        {act.metadata.from} → {act.metadata.to}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
