'use client';

import React, { useState, useEffect } from 'react';
import { AvailableOrgMember, ProjectRole } from '@intentflow/types';
import { apiGetAvailableProjectMembers, apiAssignProjectMember } from '../../lib/api-client';
import { ProjectRoleSelector } from './ProjectRoleSelector';

interface AssignMemberDialogProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AssignMemberDialog({
  projectId,
  isOpen,
  onClose,
  onSuccess,
}: AssignMemberDialogProps) {
  const [availableMembers, setAvailableMembers] = useState<AvailableOrgMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [projectRole, setProjectRole] = useState<ProjectRole>('developer');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [fetching, setFetching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchAvailableMembers();
    }
  }, [isOpen, projectId]);

  const fetchAvailableMembers = async () => {
    setFetching(true);
    setError(null);
    try {
      const members = await apiGetAvailableProjectMembers(projectId);
      setAvailableMembers(members);
      if (members.length > 0) {
        setSelectedUserId(members[0].userId);
      } else {
        setSelectedUserId('');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch available organization members');
    } finally {
      setFetching(false);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setError('Please select a member to assign');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await apiAssignProjectMember(projectId, {
        userId: selectedUserId,
        projectRole,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to assign project member');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredMembers = availableMembers.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#111827] border border-[#1F2937] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-[#1F2937] pb-3">
          <h3 className="text-lg font-extrabold text-[#F8FAFC] flex items-center gap-2">
            <span>👥</span> Assign Team Member
          </h3>
          <button
            onClick={onClose}
            className="text-[#64748B] hover:text-[#F8FAFC] text-sm px-2 py-1 rounded-lg hover:bg-[#151D2E] transition-colors"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-semibold">
            {error}
          </div>
        )}

        {fetching ? (
          <div className="py-8 text-center text-[#94A3B8] text-sm font-medium">
            Loading organization members...
          </div>
        ) : availableMembers.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <p className="text-[#F8FAFC] font-bold text-sm">No Available Members</p>
            <p className="text-xs text-[#94A3B8] font-medium">
              All organization members are already assigned to this project or there are no other members in your organization.
            </p>
          </div>
        ) : (
          <form onSubmit={handleAssign} className="space-y-4">
            {/* Search/Select Member */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#94A3B8]">
                Select Organization Member
              </label>

              {availableMembers.length > 5 && (
                <input
                  type="text"
                  placeholder="Search members by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#0B0F19] border border-[#1F2937] rounded-xl text-xs text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 mb-2"
                />
              )}

              <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {filteredMembers.map((member) => {
                  const isSelected = selectedUserId === member.userId;
                  const initials = member.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <div
                      key={member.userId}
                      onClick={() => setSelectedUserId(member.userId)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-500/10 border-indigo-500 text-[#F8FAFC] font-medium'
                          : 'bg-[#0B0F19]/60 border-[#1F2937] text-[#94A3B8] hover:bg-[#151D2E] hover:text-[#F8FAFC]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-400">
                          {initials}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#F8FAFC]">{member.name}</div>
                          <div className="text-[11px] text-[#94A3B8]">{member.email}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] uppercase font-mono font-bold rounded bg-[#151D2E] text-[#94A3B8] border border-[#1F2937]">
                          Org: {member.organizationRole}
                        </span>
                        {isSelected && (
                          <span className="text-indigo-400 text-xs font-extrabold">✓</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Project Role Selector */}
            <ProjectRoleSelector
              value={projectRole}
              onChange={(role) => setProjectRole(role)}
              disabled={loading}
            />

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1F2937]">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#151D2E] rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !selectedUserId}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl shadow-sm transition-all flex items-center gap-2"
              >
                {loading ? 'Assigning...' : 'Assign Member'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

