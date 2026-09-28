'use client';

import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-bold tracking-tight rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed select-none min-h-[40px]';

    const variants = {
      primary:
        'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-900/30 border border-indigo-500/50 active:scale-[0.98]',
      secondary:
        'bg-[#1F2937] hover:bg-[#374151] text-slate-200 border border-slate-700/80 active:scale-[0.98]',
      outline:
        'bg-transparent hover:bg-slate-800/60 text-slate-300 border border-slate-700 hover:text-white active:scale-[0.98]',
      ghost:
        'bg-transparent hover:bg-slate-800/60 text-slate-400 hover:text-white border border-transparent',
      danger:
        'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-900/30 border border-rose-500/50 active:scale-[0.98]',
      success:
        'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/30 border border-emerald-500/50 active:scale-[0.98]',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs min-h-[34px]',
      md: 'px-4 py-2 text-xs font-bold min-h-[40px]',
      lg: 'px-6 py-2.5 text-sm min-h-[44px]',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span>{children}</span>
          </span>
        ) : (
          <span className="flex items-center gap-2">
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            <span>{children}</span>
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </span>
        )}
      </button>
    );
  }
) as any;

Button.displayName = 'Button';
