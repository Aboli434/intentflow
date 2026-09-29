'use client';

import React from 'react';

interface WorkspaceSkeletonProps {
  type?: 'overview' | 'cards' | 'timeline' | 'conversations' | 'list';
  rows?: number;
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function WorkspaceSkeleton({ type = 'overview', rows = 3 }: WorkspaceSkeletonProps) {
  if (type === 'conversations') {
    return (
      <div className="flex h-[500px] w-full rounded-2xl border border-slate-800 bg-[#111827] p-4 gap-4">
        {/* Sidebar */}
        <div className="w-1/3 space-y-2 flex-shrink-0">
          <SkeletonBlock className="h-9 rounded-xl" />
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonBlock key={i} className="h-14 rounded-xl" />
          ))}
        </div>
        {/* Main */}
        <div className="flex-1 flex flex-col gap-3">
          <SkeletonBlock className="h-12 rounded-xl" />
          <div className="flex-1 space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonBlock key={i} className={`h-16 rounded-xl ${i % 2 === 0 ? 'ml-8' : 'mr-8'}`} />
            ))}
          </div>
          <SkeletonBlock className="h-12 rounded-xl" />
        </div>
      </div>
    );
  }

  if (type === 'timeline') {
    return (
      <div className="rounded-2xl border border-slate-800 bg-[#111827] p-6 space-y-4">
        <SkeletonBlock className="h-5 w-1/4 rounded" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <SkeletonBlock className="w-8 h-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <SkeletonBlock className="h-4 w-2/3 rounded" />
              <SkeletonBlock className="h-3 w-1/3 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-800 bg-[#111827] p-4 flex items-center gap-4">
            <SkeletonBlock className="w-10 h-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <SkeletonBlock className="h-4 w-1/2 rounded" />
              <SkeletonBlock className="h-3 w-1/3 rounded" />
            </div>
            <SkeletonBlock className="w-16 h-6 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'cards') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-800 bg-[#111827] p-5 space-y-3">
            <div className="flex justify-between">
              <SkeletonBlock className="h-4 w-1/3 rounded" />
              <SkeletonBlock className="h-4 w-16 rounded-full" />
            </div>
            <SkeletonBlock className="h-5 w-3/4 rounded" />
            <SkeletonBlock className="h-3 w-full rounded" />
            <SkeletonBlock className="h-3 w-2/3 rounded" />
            <div className="pt-2 border-t border-slate-800 flex justify-between">
              <SkeletonBlock className="h-3 w-1/3 rounded" />
              <SkeletonBlock className="h-3 w-1/4 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Default: overview
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-slate-800 bg-[#111827] p-4 sm:p-5 space-y-2">
            <SkeletonBlock className="h-3 w-2/3 rounded" />
            <SkeletonBlock className="h-8 w-1/2 rounded" />
            <SkeletonBlock className="h-2 w-3/4 rounded" />
          </div>
        ))}
      </div>
      {/* Content block */}
      <div className="rounded-2xl border border-slate-800 bg-[#111827] p-5 space-y-4">
        <SkeletonBlock className="h-5 w-1/4 rounded" />
        {[1, 2, 3].map((i) => (
          <SkeletonBlock key={i} className="h-12 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
