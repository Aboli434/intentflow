'use client';

import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const areaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label htmlFor={areaId} className="block text-xs font-bold text-slate-300">
            {label}
          </label>
        )}
        <textarea
          id={areaId}
          ref={ref}
          className={`w-full rounded-xl border bg-[#0B0F19] p-3 text-xs text-slate-100 placeholder-slate-500 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${
            error
              ? 'border-rose-500 focus:border-rose-500'
              : 'border-[#1F2937] focus:border-indigo-500'
          } ${className}`}
          {...props}
        />
        {error ? (
          <p className="text-[11px] font-semibold text-rose-400">{error}</p>
        ) : helperText ? (
          <p className="text-[11px] text-slate-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
