'use client';

import React from 'react';

export type WorkspaceTabKey =
  | 'overview'
  | 'conversations'
  | 'work'
  | 'deliverables'
  | 'completion'
  | 'team'
  | 'activity';

interface ProjectWorkspaceTabsProps {
  activeTab: WorkspaceTabKey;
  onTabChange: (tab: WorkspaceTabKey) => void;
  actionRequiredCount?: number;
}

const TABS: { key: WorkspaceTabKey; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: '🏠' },
  { key: 'conversations', label: 'Conversations', icon: '💬' },
  { key: 'work', label: 'Work Execution', icon: '⚡' },
  { key: 'deliverables', label: 'Deliverables & Approval', icon: '📦' },
  { key: 'completion', label: 'Completion & Handoff', icon: '✅' },
  { key: 'team', label: 'Team', icon: '👥' },
  { key: 'activity', label: 'Activity Log', icon: '📜' },
];

export function ProjectWorkspaceTabs({
  activeTab,
  onTabChange,
  actionRequiredCount = 0,
}: ProjectWorkspaceTabsProps) {
  return (
    <div className="border-b border-[#1F2937] bg-[#111827] px-3 sm:px-6 overflow-x-auto no-scrollbar sticky top-[53px] z-30 w-full max-w-full shadow-md">
      <div className="mx-auto flex max-w-7xl gap-1.5 sm:gap-2 whitespace-nowrap min-w-max py-1">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`min-h-[44px] py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer rounded-t-xl ${
                isActive
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10 font-extrabold shadow-sm'
                  : 'border-transparent text-slate-400 hover:text-slate-100 hover:bg-[#151D2E]'
              }`}
            >
              <span className="text-sm">{tab.icon}</span>
              <span>{tab.label}</span>

              {tab.key === 'overview' && actionRequiredCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
