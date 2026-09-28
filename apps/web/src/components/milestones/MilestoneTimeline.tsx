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
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'in_progress':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
      case 'review':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'blocked':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-[#0B0F19]/60 text-[#94A3B8] border-[#1F2937]';
    }
  };

  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-4 mb-6 shadow-md">
      <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-3">
        🚩 Project Delivery Milestones
      </h3>
      <div className="flex items-center gap-3 overflow-x-auto pb-2 custom-scrollbar">
        {milestones.map((m, idx) => (
          <React.Fragment key={m.id}>
            {idx > 0 && <div className="h-0.5 w-6 bg-[#1F2937] shrink-0" />}
            <div
              className={`flex flex-col p-3.5 rounded-xl border min-w-[180px] max-w-[220px] shrink-0 transition ${getStatusColor(
                m.status
              )}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-extrabold text-xs truncate text-[#F8FAFC]">{m.title}</span>
                <span className="text-xs font-mono font-bold">{getStatusIcon(m.status)}</span>
              </div>
              {m.description && (
                <p className="text-[11px] text-[#94A3B8] line-clamp-2 mt-1 font-normal">{m.description}</p>
              )}

              {isDeveloper && onStatusChange && (
                <select
                  value={m.status}
                  onChange={(e) => onStatusChange(m.id, e.target.value)}
                  className="mt-2 bg-[#111827] border border-[#1F2937] rounded-lg px-2 py-1 text-[10px] font-semibold text-[#F8FAFC] focus:outline-none focus:border-indigo-500 cursor-pointer"
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

