'use client';

import React from 'react';
import Link from 'next/link';
import { Project } from '@intentflow/types';
import { NotificationBell } from '../notifications/NotificationBell';

interface ProjectWorkspaceHeaderProps {
  project: Project;
  userRole?: string; // Org role
  projectRole?: string; // Project role
  teamCount?: number;
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
  completed: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300',
  paused: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
  archived: 'bg-slate-800 border-slate-700 text-slate-400',
};

export function ProjectWorkspaceHeader({
  project,
  userRole,
  projectRole,
  teamCount = 0,
}: ProjectWorkspaceHeaderProps) {
  const statusStyle =
    STATUS_STYLES[project.status.toLowerCase()] || STATUS_STYLES.active;

  return (
    <header className="border-b border-[#1F2937] bg-[#111827]/90 px-4 sm:px-6 py-3.5 backdrop-blur-md sticky top-0 z-40 shadow-md">
      <div className="mx-auto max-w-7xl space-y-2">
        {/* Desktop & Mobile Header Layout */}
        <div className="flex items-center justify-between gap-3">
          {/* Left: Breadcrumbs & Project Context */}
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <Link
              href="/dashboard"
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors shrink-0 flex items-center gap-1 min-h-[36px]"
            >
              <span>←</span>
              <span>Projects</span>
            </Link>
            <span className="text-slate-700 shrink-0">/</span>

            <span className="text-xs font-mono font-semibold text-slate-400 truncate max-w-[120px] sm:max-w-[180px]">
              {project.organizationName}
            </span>

            <span className="text-slate-700 shrink-0">/</span>

            <h1 className="text-xs sm:text-sm md:text-base font-extrabold text-slate-100 truncate max-w-[160px] sm:max-w-[320px]">
              {project.name}
            </h1>

            <span
              className={`px-2.5 py-0.5 text-[10px] sm:text-xs font-mono font-bold rounded-full border uppercase tracking-wide shrink-0 ${statusStyle}`}
            >
              ● {project.status}
            </span>
          </div>

          {/* Right: Notification Bell & Team Badge */}
          <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
            <NotificationBell />

            {projectRole && (
              <span className="hidden md:inline-flex px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 uppercase">
                Role: {projectRole}
              </span>
            )}

            {teamCount > 0 && (
              <span className="hidden sm:inline-flex text-xs font-mono text-slate-400 gap-1.5 items-center px-2.5 py-1 rounded-xl bg-[#0B0F19] border border-[#1F2937]">
                <span>👥</span>
                <span className="text-slate-100 font-bold">{teamCount}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
