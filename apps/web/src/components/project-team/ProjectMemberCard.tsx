'use client';

import React, { useState } from 'react';
import { ProjectMemberDetail, ProjectRole } from '@intentflow/types';
import { apiUpdateProjectMemberRole, apiRemoveProjectMember } from '../../lib/api-client';

interface ProjectMemberCardProps {
  member: ProjectMemberDetail;
  projectId: string;
  canManageTeam: boolean;
  onRefresh: () => void;
}

const ROLE_BADGE_STYLES: Record<string, string> = {
  client: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold',
  developer: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 font-bold',
  manager: 'bg-purple-500/10 border-purple-500/30 text-purple-400 font-bold',
  viewer: 'bg-slate-500/10 border-slate-500/30 text-slate-300 font-bold',
};

export function ProjectMemberCard({
  member,
  projectId,
  canManageTeam,
  onRefresh,
}: ProjectMemberCardProps) {
  const [isChangingRole, setIsChangingRole] = useState(false);
  const [selectedRole, setSelectedRole] = useState<ProjectRole>(member.projectRole);
  const [loading, setLoading] = useState(false);
  const [showConfirmRemove, setShowConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initials = member.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleRoleChange = async () => {
    if (selectedRole === member.projectRole) {
      setIsChangingRole(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await apiUpdateProjectMemberRole(projectId, member.id, {
        projectRole: selectedRole,
      });
      setIsChangingRole(false);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to update member role');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    setLoading(true);
    setError(null);
    try {
      await apiRemoveProjectMember(projectId, member.id);
      setShowConfirmRemove(false);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to remove member');
      setShowConfirmRemove(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-5 shadow-md hover:border-indigo-500/50 transition-all flex flex-col justify-between space-y-4">
      {/* Header Info */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center font-bold text-sm text-indigo-400 shadow-sm">
            {initials}
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#F8FAFC] leading-tight">{member.name}</h4>
            <p className="text-xs text-[#94A3B8] mt-0.5">{member.email}</p>
          </div>
        </div>

        {canManageTeam && !isChangingRole && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsChangingRole(true)}
              className="px-2.5 py-1 text-xs font-semibold text-[#94A3B8] hover:text-[#F8FAFC] bg-[#151D2E] hover:bg-[#1F2937] rounded-lg transition-colors border border-[#1F2937]"
            >
              Change Role
            </button>
            <button
              onClick={() => setShowConfirmRemove(true)}
              className="p-1.5 text-[#64748B] hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors border border-transparent hover:border-rose-500/20"
              title="Remove Member"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Role Changing Controls */}
      {isChangingRole ? (
        <div className="p-3 bg-[#0B0F19]/60 border border-[#1F2937] rounded-xl space-y-3">
          <label className="block text-xs font-semibold text-[#94A3B8]">
            Select New Project Role
          </label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as ProjectRole)}
            disabled={loading}
            className="w-full px-3 py-1.5 bg-[#111827] border border-[#1F2937] rounded-lg text-xs text-[#F8FAFC] focus:outline-none focus:border-indigo-500"
          >
            <option value="client">Client (Review & Approve)</option>
            <option value="developer">Developer (Execute Work)</option>
            <option value="manager">Manager (Manage Team & Work)</option>
            <option value="viewer">Viewer (Read-only)</option>
          </select>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setIsChangingRole(false);
                setSelectedRole(member.projectRole);
              }}
              disabled={loading}
              className="px-3 py-1 text-xs font-medium text-[#94A3B8] hover:text-[#F8FAFC]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRoleChange}
              disabled={loading}
              className="px-3 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Role'}
            </button>
          </div>
        </div>
      ) : (
        /* Badges & Date */
        <div className="space-y-2 pt-2 border-t border-[#1F2937]">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[#64748B] font-mono text-[10px] uppercase font-semibold">Org:</span>
              <span className="px-2 py-0.5 text-[10px] uppercase font-mono font-bold rounded bg-[#151D2E] text-[#94A3B8] border border-[#1F2937]">
                {member.organizationRole}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[#64748B] font-mono text-[10px] uppercase font-semibold">Project:</span>
              <span
                className={`px-2.5 py-0.5 text-[10px] uppercase font-mono font-bold rounded border ${
                  ROLE_BADGE_STYLES[member.projectRole] || ROLE_BADGE_STYLES.viewer
                }`}
              >
                {member.projectRole}
              </span>
            </div>
          </div>

          <div className="text-[11px] text-[#94A3B8] flex items-center justify-between pt-1 font-medium">
            <span>Assigned:</span>
            <span className="font-mono text-[#F8FAFC] font-bold">
              {new Date(member.assignedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Removal */}
      {showConfirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <h4 className="text-sm font-extrabold text-[#F8FAFC]">Remove Project Member?</h4>
            <p className="text-xs text-[#94A3B8] leading-relaxed font-medium">
              Are you sure you want to remove <span className="font-bold text-[#F8FAFC]">{member.name}</span> from this project? They will lose access to project workspace data.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowConfirmRemove(false)}
                disabled={loading}
                className="px-3 py-1.5 text-xs font-semibold text-[#94A3B8] hover:bg-[#151D2E] rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRemove}
                disabled={loading}
                className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-sm disabled:opacity-50"
              >
                {loading ? 'Removing...' : 'Remove Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

