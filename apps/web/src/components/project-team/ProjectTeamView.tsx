'use client';

import React, { useState, useEffect } from 'react';
import { ProjectMemberDetail } from '@intentflow/types';
import { apiGetProjectMembers } from '../../lib/api-client';
import { ProjectMemberCard } from './ProjectMemberCard';
import { AssignMemberDialog } from './AssignMemberDialog';

interface ProjectTeamViewProps {
  projectId: string;
  userRole?: string; // Org role
  projectRole?: string; // Project role
}

export function ProjectTeamView({ projectId, userRole, projectRole }: ProjectTeamViewProps) {
  const [members, setMembers] = useState<ProjectMemberDetail[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAssignOpen, setIsAssignOpen] = useState<boolean>(false);

  // Can manage team if org admin OR project manager
  const canManageTeam = userRole === 'admin' || projectRole === 'manager';

  useEffect(() => {
    fetchMembers();
  }, [projectId]);

  const fetchMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGetProjectMembers(projectId);
      setMembers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load project team members');
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = members.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.projectRole.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 text-[#F8FAFC]">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111827] border border-[#1F2937] p-5 rounded-2xl shadow-md">
        <div>
          <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
            <span>👥</span> Project Team
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Manage who has access to this project and what they can do.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canManageTeam && (
            <button
              onClick={() => setIsAssignOpen(true)}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer min-h-[40px]"
            >
              <span>+</span> Assign Member
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs font-semibold flex items-center justify-between shadow-md">
          <span>{error}</span>
          <button
            onClick={fetchMembers}
            className="text-indigo-400 hover:underline text-xs font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      {members.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative max-w-sm w-full">
            <input
              type="text"
              placeholder="Search team members by name, email, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#0B0F19] border border-[#1F2937] rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 shadow-sm"
            />
          </div>

          <div className="text-xs text-slate-400 font-mono">
            Total Team Members: <span className="text-slate-100 font-bold">{members.length}</span>
          </div>
        </div>
      )}

      {/* Members Grid / States */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs font-medium">
          Loading project team...
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-[#1F2937] rounded-2xl space-y-3 bg-[#111827] p-8 shadow-md">
          <div className="text-3xl">👥</div>
          <h3 className="text-sm font-extrabold text-slate-100">No Team Members Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto font-medium">
            {searchQuery
              ? 'No team members match your search criteria.'
              : 'This project currently has no assigned team members. Click "Assign Member" to add organization members to this project workspace.'}
          </p>
          {canManageTeam && !searchQuery && (
            <button
              onClick={() => setIsAssignOpen(true)}
              className="mt-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md"
            >
              Assign Member Now
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMembers.map((member) => (
            <ProjectMemberCard
              key={member.id}
              member={member}
              projectId={projectId}
              canManageTeam={canManageTeam}
              onRefresh={fetchMembers}
            />
          ))}
        </div>
      )}

      {/* Assign Member Modal */}
      <AssignMemberDialog
        projectId={projectId}
        isOpen={isAssignOpen}
        onClose={() => setIsAssignOpen(false)}
        onSuccess={fetchMembers}
      />
    </div>
  );
}
