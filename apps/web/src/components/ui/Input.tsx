'use client';

import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-bold text-slate-300">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && <div className="absolute left-3.5 text-slate-500 pointer-events-none">{leftIcon}</div>}
          <input
            id={inputId}
            ref={ref}
            className={`w-full rounded-xl border bg-[#0B0F19] text-xs text-slate-100 placeholder-slate-500 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${
              leftIcon ? 'pl-10' : 'px-3.5'
            } py-2.5 ${
              error
                ? 'border-rose-500 focus:border-rose-500'
                : 'border-[#1F2937] focus:border-indigo-500'
            } ${className}`}
            {...props}
          />
        </div>
        {error ? (
          <p className="text-[11px] font-semibold text-rose-400">{error}</p>
        ) : helperText ? (
          <p className="text-[11px] text-slate-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
