'use client';

import React from 'react';
import Link from 'next/link';

export interface ActionItem {
  id: string;
  title: string;
  subtitle?: string;
  projectId?: string;
  projectName?: string;
  targetUrl: string;
  priority?: 'high' | 'medium' | 'normal';
  badgeLabel?: string;
}

interface ActionRequiredCardProps {
  userRole?: string;
  items: ActionItem[];
  loading?: boolean;
}

export function ActionRequiredCard({ userRole = 'developer', items, loading = false }: ActionRequiredCardProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-[#1F2937] bg-[#111827] p-5 space-y-3 animate-pulse shadow-md">
        <div className="h-4 bg-[#1F2937] rounded w-1/4" />
        <div className="h-10 bg-[#151D2E] rounded-xl" />
        <div className="h-10 bg-[#151D2E] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/40 via-[#111827] to-[#0B0F19] p-5 sm:p-6 space-y-4 shadow-xl">
      <div className="flex items-center justify-between border-b border-indigo-500/20 pb-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />
          <h3 className="text-xs sm:text-sm font-extrabold text-indigo-300 tracking-wide uppercase">
            Action Required
          </h3>
          {items.length > 0 && (
            <span className="bg-rose-500/15 text-rose-300 text-xs font-mono font-bold px-2 py-0.5 rounded-full border border-rose-500/30">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>

        <span className="text-[11px] font-mono font-semibold text-slate-400 capitalize">
          Role: {userRole}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-400 space-y-1">
          <p className="text-lg">✨</p>
          <p className="font-extrabold text-slate-200">No pending action items!</p>
          <p className="text-[11px] text-slate-400">You are all caught up across your workspace projects.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.targetUrl}
              className="group flex items-center justify-between gap-3 p-3.5 rounded-xl border border-[#1F2937] bg-[#0B0F19]/60 hover:border-indigo-500/60 hover:bg-[#151D2E] transition-all cursor-pointer shadow-sm"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {item.projectName && (
                    <span className="bg-indigo-500/15 text-indigo-300 text-[10px] font-mono font-semibold px-2 py-0.5 rounded border border-indigo-500/30">
                      {item.projectName}
                    </span>
                  )}
                  {item.badgeLabel && (
                    <span className="bg-rose-500/15 text-rose-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-rose-500/30 uppercase">
                      {item.badgeLabel}
                    </span>
                  )}
                  <h4 className="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-indigo-400 transition-colors truncate">
                    {item.title}
                  </h4>
                </div>

                {item.subtitle && (
                  <p className="text-xs text-slate-400 line-clamp-1">{item.subtitle}</p>
                )}
              </div>

              <span className="text-xs font-bold text-indigo-400 group-hover:translate-x-0.5 transition-transform shrink-0">
                Action →
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
