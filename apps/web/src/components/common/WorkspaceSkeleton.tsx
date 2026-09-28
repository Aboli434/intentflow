'use client';

import React from 'react';

interface WorkspaceSkeletonProps {
  type?: 'overview' | 'cards' | 'timeline' | 'conversations';
}

export function WorkspaceSkeleton({ type = 'overview' }: WorkspaceSkeletonProps) {
  if (type === 'conversations') {
    return (
      <div className="flex h-[500px] w-full rounded-2xl border border-[#1F2937] bg-[#111827] p-4 space-x-4 animate-pulse shadow-md">
        <div className="w-1/3 bg-[#151D2E] rounded-xl" />
        <div className="flex-1 bg-[#0B0F19] rounded-xl" />
      </div>
    );
  }

  if (type === 'timeline') {
    return (
      <div className="rounded-2xl border border-[#1F2937] bg-[#111827] p-6 space-y-4 animate-pulse shadow-md">
        <div className="h-5 bg-[#1F2937] rounded w-1/4" />
        <div className="h-12 bg-[#151D2E] rounded-xl" />
        <div className="h-12 bg-[#151D2E] rounded-xl" />
        <div className="h-12 bg-[#151D2E] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-24 bg-[#111827] rounded-2xl border border-[#1F2937] shadow-md" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-[#111827] rounded-2xl border border-[#1F2937] shadow-md" />
        ))}
      </div>
      <div className="h-40 bg-[#111827] rounded-2xl border border-[#1F2937] shadow-md" />
    </div>
  );
}
