'use client';

import React from 'react';
import { ProjectRole } from '@intentflow/types';

interface ProjectRoleSelectorProps {
  value: ProjectRole;
  onChange: (role: ProjectRole) => void;
  disabled?: boolean;
}

const ROLE_OPTIONS: { role: ProjectRole; label: string; description: string }[] = [
  {
    role: 'client',
    label: 'Client',
    description: 'Can review and approve project deliverables.',
  },
  {
    role: 'developer',
    label: 'Developer',
    description: 'Can execute project work.',
  },
  {
    role: 'manager',
    label: 'Manager',
    description: 'Can manage project team and execution.',
  },
  {
    role: 'viewer',
    label: 'Viewer',
    description: 'Can view project information.',
  },
];

export function ProjectRoleSelector({ value, onChange, disabled }: ProjectRoleSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-[#94A3B8]">Select Project Role</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ROLE_OPTIONS.map((opt) => {
          const isSelected = value === opt.role;
          return (
            <button
              key={opt.role}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.role)}
              className={`p-3 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'bg-indigo-500/10 border-indigo-500 text-[#F8FAFC] ring-1 ring-indigo-500'
                  : 'bg-[#0B0F19]/60 border-[#1F2937] text-[#94A3B8] hover:border-[#374151] hover:text-[#F8FAFC]'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center justify-between font-bold text-sm text-[#F8FAFC]">
                <span>{opt.label}</span>
                {isSelected && (
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                )}
              </div>
              <p className="text-[11px] text-[#94A3B8] mt-1 leading-snug font-medium">
                {opt.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

