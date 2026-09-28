'use client';

import React from 'react';
import { Button } from '../ui/Button';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon = '✨',
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-[#1F2937] bg-[#111827] p-8 sm:p-12 text-center space-y-3 shadow-md">
      <span className="text-3xl block">{icon}</span>
      <h3 className="text-sm sm:text-base font-extrabold text-slate-100">{title}</h3>
      <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed font-medium">{description}</p>
      {actionLabel && onAction && (
        <div className="pt-2">
          <Button onClick={onAction} variant="primary" size="sm">
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
