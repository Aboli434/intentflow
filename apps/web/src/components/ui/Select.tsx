'use client';

import React from 'react';

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: SelectOption[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, options, children, className = '', id, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-bold text-slate-300">
            {label}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          className={`w-full rounded-xl border bg-[#0B0F19] px-3.5 py-2.5 text-xs text-slate-100 cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${
            error
              ? 'border-rose-500 focus:border-rose-500'
              : 'border-[#1F2937] focus:border-indigo-500'
          } ${className}`}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        {error ? (
          <p className="text-[11px] font-semibold text-rose-400">{error}</p>
        ) : helperText ? (
          <p className="text-[11px] text-slate-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
) as any;

Select.displayName = 'Select';
