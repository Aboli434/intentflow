'use client';

import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'surface' | 'elevated' | 'bordered' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({
  variant = 'surface',
  padding = 'md',
  className = '',
  children,
  ...props
}: CardProps) {
  const baseStyles = 'rounded-2xl transition-all overflow-hidden';

  const variants = {
    surface: 'bg-[#111827] border border-[#1F2937] text-slate-100 shadow-md',
    elevated: 'bg-[#151D2E] border border-slate-800 text-slate-100 shadow-xl',
    bordered: 'bg-transparent border border-slate-800 text-slate-200',
    interactive:
      'bg-[#111827] border border-[#1F2937] hover:border-indigo-500/60 hover:shadow-indigo-950/20 hover:shadow-lg text-slate-100 cursor-pointer',
  };

  const paddings = {
    none: 'p-0',
    sm: 'p-3.5 sm:p-4',
    md: 'p-5 sm:p-6',
    lg: 'p-6 sm:p-8',
  };

  return (
    <div className={`${baseStyles} ${variants[variant]} ${paddings[padding]} ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-between border-b border-[#1F2937] pb-3.5 mb-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`space-y-3 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`pt-4 mt-4 border-t border-[#1F2937] flex items-center justify-between ${className}`}>
      {children}
    </div>
  );
}
