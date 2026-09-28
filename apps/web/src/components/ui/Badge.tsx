'use client';

import React from 'react';

export type BadgeVariant = 'indigo' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'slate' | 'violet';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

export function Badge({
  variant = 'indigo',
  size = 'md',
  className = '',
  children,
  ...props
}: BadgeProps) {
  const base = 'inline-flex items-center gap-1 font-mono font-bold rounded-md border uppercase tracking-wider shrink-0';

  const variants = {
    indigo: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    rose: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    cyan: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    slate: 'bg-slate-800/80 text-slate-300 border-slate-700',
    violet: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  };

  const sizes = {
    sm: 'px-1.5 py-0.5 text-[9px]',
    md: 'px-2.5 py-0.5 text-[10px]',
  };

  return (
    <span className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </span>
  );
}
