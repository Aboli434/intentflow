'use client';

import React, { useState, useEffect } from 'react';
import { Project, User } from '@intentflow/types';
import { apiGetProjectDetail, apiGetMe, apiGetProjectMembers } from '../../lib/api-client';
import { ProjectWorkspaceHeader } from './ProjectWorkspaceHeader';
import { ProjectWorkspaceTabs, WorkspaceTabKey } from './ProjectWorkspaceTabs';
import { ProjectAccessState, AccessStateMode } from './ProjectAccessState';
import { ProjectWorkspaceOverview } from './ProjectWorkspaceOverview';
import { ConversationView } from '../conversations/ConversationView';
import { WorkView } from '../work/WorkView';
import { DeliverablesView } from '../deliverables/DeliverablesView';
import { ProjectCompletionView } from '../completion/ProjectCompletionView';
import { ProjectTeamView } from '../project-team/ProjectTeamView';
import { ProjectActivityTimeline } from '../activity/ProjectActivityTimeline';

interface ProjectWorkspaceShellProps {
  projectId: string;
}

export function ProjectWorkspaceShell({ projectId }: ProjectWorkspaceShellProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMode, setErrorMode] = useState<AccessStateMode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [activeTab, setActiveTab] = useState<WorkspaceTabKey>('overview');

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userOrgRole, setUserOrgRole] = useState<string | undefined>(undefined);
  const [userProjectRole, setUserProjectRole] = useState<string | undefined>(undefined);
  const [teamCount, setTeamCount] = useState<number>(0);

  useEffect(() => {
    loadWorkspace();
  }, [projectId]);

  const loadWorkspace = async () => {
    setLoading(true);
    setErrorMode(null);
    setErrorMessage('');

    try {
      // 1. Fetch Current Authenticated User & Org Memberships
      const meData = await apiGetMe().catch(() => null);
      if (meData) {
        setCurrentUser(meData.user);
      }

      // 2. Fetch Project Details
      const proj = await apiGetProjectDetail(projectId);
      setProject(proj);

      // 3. Resolve User's Org Role & Project Role
      if (meData) {
        const orgMem = meData.memberships.find((m) => m.organizationId === proj.organizationId);
        if (!orgMem) {
          setErrorMode('org_mismatch');
          setErrorMessage('You are not a member of the organization that owns this project.');
          return;
        }
        setUserOrgRole(orgMem.role);

        // Fetch explicit project members list to find projectRole
        const pMembers = await apiGetProjectMembers(projectId).catch(() => []);
        setTeamCount(pMembers.length);

        const myPMember = pMembers.find((m) => m.userId === meData.user.id);

        if (myPMember) {
          setUserProjectRole(myPMember.projectRole);
        } else if (orgMem.role === 'admin') {
          // Org admins without explicit project member record still have admin visibility
          setUserProjectRole(undefined);
        } else {
          // Non-admin org member not assigned to project team
          setErrorMode('not_assigned');
          setErrorMessage('You are a member of this organization but have not been assigned to this project team.');
          return;
        }
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to load project workspace';
      if (msg.toLowerCase().includes('access') || msg.toLowerCase().includes('forbidden')) {
        setErrorMode('unauthorized');
      } else {
        setErrorMode('server_error');
      }
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <ProjectAccessState mode="loading" />;
  }

  if (errorMode || !project) {
    return (
      <ProjectAccessState
        mode={errorMode || 'server_error'}
        message={errorMessage}
        onRetry={loadWorkspace}
      />
    );
  }

  const isClientRole = userProjectRole === 'client';
  const isManagerRole = userOrgRole === 'admin' || userProjectRole === 'manager';
  const isDeveloperRole = userProjectRole === 'developer' || (!isClientRole && userProjectRole !== 'viewer');

  const membersList = project.members ? (project.members.map((m) => m.user).filter(Boolean) as User[]) : [];

  return (
    <div className="flex min-h-screen flex-col bg-[#0B0F19] text-[#F8FAFC] selection:bg-indigo-600 selection:text-white pb-16">
      {/* Workspace Header */}
      <ProjectWorkspaceHeader
        project={project}
        userRole={userOrgRole}
        projectRole={userProjectRole}
        teamCount={teamCount}
      />

      {/* Workspace Tabs Navigation */}
      <ProjectWorkspaceTabs
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
      />

      {/* Main Workspace View Content */}
      <main className="mx-auto flex-1 w-full max-w-7xl p-4 sm:p-6">
        {activeTab === 'overview' ? (
          <ProjectWorkspaceOverview
            project={project}
            userRole={userOrgRole}
            projectRole={userProjectRole}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        ) : activeTab === 'conversations' ? (
          <ConversationView
            projectId={project.id}
            onNavigateToWorkTab={() => setActiveTab('work')}
          />
        ) : activeTab === 'work' ? (
          <WorkView
            projectId={project.id}
            projectMembers={membersList}
          />
        ) : activeTab === 'deliverables' ? (
          <DeliverablesView
            projectId={project.id}
            isClient={isClientRole}
            isDeveloper={isDeveloperRole}
          />
        ) : activeTab === 'completion' ? (
          <ProjectCompletionView
            projectId={project.id}
            isClient={isClientRole}
            isDeveloper={isDeveloperRole}
          />
        ) : activeTab === 'team' ? (
          <ProjectTeamView
            projectId={project.id}
            userRole={userOrgRole}
            projectRole={userProjectRole}
          />
        ) : (
          <ProjectActivityTimeline
            projectId={project.id}
            orgId={project.organizationId}
          />
        )}
      </main>
    </div>
  );
}
