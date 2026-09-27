'use client';

import React from 'react';
import { ProjectMilestone } from '@intentflow/types';

interface MilestoneTimelineProps {
  milestones: ProjectMilestone[];
  isDeveloper: boolean;
  onStatusChange?: (milestoneId: string, newStatus: string) => void;
}

export const MilestoneTimeline: React.FC<MilestoneTimelineProps> = ({
  milestones,
  isDeveloper,
  onStatusChange,
}) => {
  if (!milestones || milestones.length === 0) {
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'in_progress':
        return '●';
      case 'review':
        return '🔍';
      case 'blocked':
        return '⚠️';
      default:
        return '○';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'in_progress':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
      case 'review':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/40';
      case 'blocked':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 mb-6">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        🚩 Project Delivery Milestones
      </h3>
      <div className="flex items-center gap-3 overflow-x-auto pb-2">
        {milestones.map((m, idx) => (
          <React.Fragment key={m.id}>
            {idx > 0 && <div className="h-0.5 w-6 bg-slate-800 shrink-0" />}
            <div
              className={`flex flex-col p-3 rounded-lg border min-w-[180px] max-w-[220px] shrink-0 transition ${getStatusColor(
                m.status
              )}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs truncate text-white">{m.title}</span>
                <span className="text-xs font-mono font-bold">{getStatusIcon(m.status)}</span>
              </div>
              {m.description && (
                <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">{m.description}</p>
              )}

              {isDeveloper && onStatusChange && (
                <select
                  value={m.status}
                  onChange={(e) => onStatusChange(m.id, e.target.value)}
                  className="mt-2 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-[10px] text-slate-300 focus:outline-none"
                >
                  <option value="upcoming">○ Upcoming</option>
                  <option value="in_progress">● In Progress</option>
                  <option value="review">🔍 Review</option>
                  <option value="completed">✓ Completed</option>
                  <option value="blocked">⚠️ Blocked</option>
                </select>
              )}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
