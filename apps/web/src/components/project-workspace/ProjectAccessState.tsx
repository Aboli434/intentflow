'use client';

import React from 'react';
import Link from 'next/link';

export type AccessStateMode =
  | 'loading'
  | 'unauthorized'
  | 'org_mismatch'
  | 'not_assigned'
  | 'server_error';

interface ProjectAccessStateProps {
  mode: AccessStateMode;
  message?: string;
  onRetry?: () => void;
}

export function ProjectAccessState({ mode, message, onRetry }: ProjectAccessStateProps) {
  if (mode === 'loading') {
    return (
      <div className="min-h-screen bg-[#0B0F19] text-[#F8FAFC] flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-xs font-semibold text-indigo-400 animate-pulse">
          Loading Project Workspace...
        </p>
      </div>
    );
  }

  const CONFIGS: Record<
    Exclude<AccessStateMode, 'loading'>,
    { icon: string; title: string; defaultMsg: string; bg: string; border: string; text: string }
  > = {
    unauthorized: {
      icon: '🔒',
      title: 'Access Restricted',
      defaultMsg: 'You do not have permission to access this project workspace.',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/30',
      text: 'text-rose-300',
    },
    org_mismatch: {
      icon: '🏢',
      title: 'Organization Mismatch',
      defaultMsg: 'This project belongs to a different organization.',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      text: 'text-amber-300',
    },
    not_assigned: {
      icon: '👥',
      title: 'Not Assigned to Project',
      defaultMsg:
        'You are a member of the organization, but you have not been assigned to this project team yet.',
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/30',
      text: 'text-indigo-300',
    },
    server_error: {
      icon: '⚠️',
      title: 'Workspace Error',
      defaultMsg: 'Something went wrong while loading this project.',
      bg: 'bg-[#111827]',
      border: 'border-[#1F2937]',
      text: 'text-slate-300',
    },
  };

  const config = CONFIGS[mode as Exclude<AccessStateMode, 'loading'>] || CONFIGS.server_error;

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#F8FAFC] flex items-center justify-center p-4">
      <div
        className={`max-w-md w-full rounded-2xl border ${config.border} ${config.bg} p-6 text-center space-y-4 shadow-2xl`}
      >
        <div className="text-4xl">{config.icon}</div>
        <div>
          <h2 className="text-base font-extrabold text-slate-100">{config.title}</h2>
          <p className={`text-xs ${config.text} mt-1.5 leading-relaxed font-medium`}>
            {message || config.defaultMsg}
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 text-xs font-semibold text-slate-300 bg-[#151D2E] hover:bg-[#1F2937] rounded-xl border border-slate-700 transition-colors"
            >
              Retry Loading
            </button>
          )}
          <Link
            href="/dashboard"
            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md transition-all"
          >
            ← Back to Projects
          </Link>
        </div>
      </div>
    </div>
  );
}
