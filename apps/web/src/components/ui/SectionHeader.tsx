'use client';

import React from 'react';

export function SectionHeader({
  title,
  subtitle,
  action,
  tag,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  tag?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1F2937] pb-4 mb-6">
      <div>
        {tag && (
          <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest block mb-0.5">
            {tag}
          </span>
        )}
        <h2 className="text-base sm:text-lg font-extrabold text-slate-100 tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Avatar({
  name,
  size = 'md',
  className = '',
}: {
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'U';

  const sizes = {
    sm: 'w-7 h-7 text-[10px]',
    md: 'w-9 h-9 text-xs',
    lg: 'w-12 h-12 text-sm',
  };

  return (
    <div
      className={`rounded-full bg-indigo-950 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-extrabold font-mono shrink-0 shadow-sm ${sizes[size]} ${className}`}
    >
      {initials}
    </div>
  );
}

export function ProgressBar({
  value,
  max = 100,
  color = 'indigo',
}: {
  value: number;
  max?: number;
  color?: 'indigo' | 'emerald' | 'amber' | 'rose';
}) {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  const colors = {
    indigo: 'bg-indigo-600',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
  };

  return (
    <div className="w-full bg-[#1F2937] h-2 rounded-full overflow-hidden">
      <div
        className={`h-full ${colors[color]} transition-all duration-300 rounded-full`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
