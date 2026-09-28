import { UserRole, ProjectRole, PolicyAction } from '@intentflow/types';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../config/database.js';
import { organizationMembers, projectMembers, projects } from '../db/schema/index.js';

export interface AuthContext {
  userId: string;
  organizationId: string;
  projectId?: string;
}

export interface PermissionEvaluationContext {
  userId: string;
  organizationId: string;
  orgRole: UserRole | null;
  projectId?: string;
  projectRole?: ProjectRole | null;
}

/**
 * Fetch combined authorization context for a user in an organization (and optional project)
 */
export async function getAuthContext(
  userId: string,
  organizationId?: string,
  projectId?: string
): Promise<PermissionEvaluationContext> {
  const db = getDb();
  let resolvedOrgId = organizationId || '';

  // Auto-resolve organizationId from projectId if not provided
  if (!resolvedOrgId && projectId) {
    const projRecord = await db
      .select({ organizationId: projects.organizationId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (projRecord.length > 0) {
      resolvedOrgId = projRecord[0].organizationId;
    }
  }

  // 1. Fetch Organization Role
  const orgMember = resolvedOrgId
    ? await db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, resolvedOrgId),
            eq(organizationMembers.userId, userId)
          )
        )
        .limit(1)
    : [];

  const orgRole = orgMember.length > 0 ? (orgMember[0].role as UserRole) : null;

  // 2. Fetch Project Role (if projectId provided)
  let projectRole: ProjectRole | null = null;
  if (projectId) {
    const projMember = await db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId)
        )
      )
      .limit(1);

    if (projMember.length > 0) {
      projectRole = projMember[0].role as ProjectRole;
    }
  }

  return {
    userId,
    organizationId: resolvedOrgId,
    orgRole,
    projectId,
    projectRole,
  };
}


/**
 * Centralized Policy Evaluation Engine
 * Evaluates both Organization Role and Project Membership
 */
export function evaluatePolicy(
  ctx: PermissionEvaluationContext,
  action: PolicyAction
): { allowed: boolean; reason?: string } {
  // If user is not even a member of the organization, deny all
  if (!ctx.orgRole) {
    return { allowed: false, reason: 'User does not belong to the target organization' };
  }

  switch (action) {
    case 'org:view':
      // Any active member of the organization can view basic org details
      return { allowed: true };

    case 'org:update':
    case 'org:invite':
    case 'org:remove_member':
    case 'org:invitation_view':
    case 'org:invitation_create':
    case 'org:invitation_cancel':
    case 'org:invitation_resend':
    case 'org:member_remove':
    case 'org:member_edit':
      // Admin only administrative actions
      if (ctx.orgRole === 'admin') {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Requires organization admin role' };

    case 'project:create':
      // Admin or Developer in organization can create projects
      if (ctx.orgRole === 'admin' || ctx.orgRole === 'developer') {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Clients cannot create projects' };

    case 'project:view':
    case 'project_member:view':
    case 'project_workspace:view':
      // Admin has organization-wide access; assigned project members have access
      if (ctx.orgRole === 'admin' || ctx.projectRole) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Requires explicit project membership' };

    case 'project:update':
      // Org Admin can update project; project developers/managers can update project
      if (ctx.orgRole === 'admin' || ctx.projectRole === 'developer' || ctx.projectRole === 'manager') {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Requires org admin or assigned developer/manager role on project' };

    case 'project:delete':
      // Only org admin can delete/archive projects
      if (ctx.orgRole === 'admin') {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Only org admin can delete projects' };

    case 'project:manage_members':
    case 'project_member:assign':
    case 'project_member:edit':
    case 'project_member:remove':
    case 'project_workspace:manage':
      // Org Admin or assigned Project Manager can manage project members
      if (ctx.orgRole === 'admin' || ctx.projectRole === 'manager') {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Requires organization admin or project manager role' };

    case 'project:client_approve':
      // ROLE-SPECIFIC BUSINESS ACTION:
      // Even Org Admins cannot perform client approval unless explicitly assigned as the Client on the project!
      if (ctx.projectRole === 'client') {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Client approval is role-specific to project clients only (admins without client project role are excluded)',
      };

    case 'conversation:create':
    case 'conversation:view':
    case 'message:view':
    case 'message:send':
    case 'attachment:upload':
    case 'attachment:view':
      // Org Admin has administrative visibility; project members (developers, managers & clients) have access
      if (ctx.orgRole === 'admin' || ctx.projectRole) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Requires organization admin role or assigned project membership' };

    case 'conversation:manage_participants':
      // Org Admin or assigned project developer/manager can manage conversation participants
      if (ctx.orgRole === 'admin' || ctx.projectRole === 'developer' || ctx.projectRole === 'manager') {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Requires org admin or project developer/manager role' };

    case 'intent:view':
      // Org Admin or assigned project member can view intents
      if (ctx.orgRole === 'admin' || ctx.projectRole) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Requires org admin or project membership to view intent' };

    case 'intent:analyze':
    case 'intent:edit':
    case 'intent:confirm':
    case 'intent:reject':
    case 'intent:request_clarification':
      // Developers/Managers assigned to project or Org Admins can review/manage intents
      if (ctx.orgRole === 'admin' || ctx.projectRole === 'developer' || ctx.projectRole === 'manager') {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Internal intent review actions require org admin or assigned developer/manager role',
      };

    case 'work:view':
    case 'work:view_activity':
      // Org Admin or any assigned project member can view work items & progress
      if (ctx.orgRole === 'admin' || ctx.projectRole) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Requires organization admin role or assigned project membership' };

    case 'work:create':
    case 'work:edit':
    case 'work:assign':
    case 'work:change_status':
    case 'work:generate_proposal':
    case 'work:approve_proposal':
    case 'work:complete':
      // Org Admin or assigned project developer/manager can execute work lifecycle
      if (ctx.orgRole === 'admin' || ctx.projectRole === 'developer' || ctx.projectRole === 'manager') {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Execution and proposal actions require organization admin or assigned developer/manager role',
      };

    case 'notification:view':
    case 'notification:mark_read':
      // Any authenticated organization member can view/manage their own personal notifications
      return { allowed: true };

    case 'activity:view':
      // Org Admin has org-wide activity access; assigned project members (dev & client) have project activity access
      if (ctx.orgRole === 'admin' || ctx.projectRole) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Requires organization admin role or assigned project membership' };

    case 'deliverable:view':
    case 'review:view':
    case 'revision:view':
    case 'milestone:view':
      // Org Admin or assigned project member (developer or client)
      if (ctx.orgRole === 'admin' || ctx.projectRole) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Requires organization admin role or assigned project membership' };

    case 'deliverable:create':
    case 'deliverable:edit':
    case 'deliverable:submit_review':
    case 'milestone:create':
    case 'milestone:edit':
    case 'milestone:complete':
    case 'revision:manage':
      // Org Admin or assigned project developer/manager
      if (ctx.orgRole === 'admin' || ctx.projectRole === 'developer' || ctx.projectRole === 'manager') {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Requires organization admin role or assigned developer/manager role on project' };

    case 'deliverable:approve':
    case 'deliverable:request_changes':
    case 'review:create':
    case 'revision:create':
      // Strictly assigned project CLIENT role only (orgRole !== client approval authority!)
      if (ctx.projectRole === 'client') {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Client approval authority requires explicit project assignment with client role',
      };

    case 'project:completion_view':
    case 'project:closure_view':
    case 'project:handoff_view':
      // Org Admin or assigned project member (developer or client)
      if (ctx.orgRole === 'admin' || ctx.projectRole) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Requires organization admin role or assigned project membership' };

    case 'project:completion_manage':
    case 'project:closure_create':
    case 'project:closure_submit':
    case 'project:closure_revision_manage':
    case 'project:handoff_manage':
      // Org Admin or assigned project developer/manager
      if (ctx.orgRole === 'admin' || ctx.projectRole === 'developer' || ctx.projectRole === 'manager') {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Requires organization admin role or assigned developer/manager role on project' };

    case 'project:closure_approve':
    case 'project:closure_request_changes':
    case 'project:handoff_acknowledge':
      // Strictly assigned project CLIENT role only (orgRole !== client approval authority!)
      if (ctx.projectRole === 'client') {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Final client closure approval requires explicit project assignment with client role',
      };

    default:
      return { allowed: false, reason: 'Unknown policy action' };
  }
}

/**
 * Enforce policy helper for route handlers
 */
export async function enforcePolicy(
  userId: string,
  organizationId: string | undefined,
  action: PolicyAction,
  projectId?: string
): Promise<{ allowed: boolean; reason?: string; ctx: PermissionEvaluationContext }> {
  const ctx = await getAuthContext(userId, organizationId, projectId);
  const result = evaluatePolicy(ctx, action);
  return { ...result, ctx };
}

