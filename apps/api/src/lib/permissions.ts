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
  organizationId: string,
  projectId?: string
): Promise<PermissionEvaluationContext> {
  const db = getDb();

  // 1. Fetch Organization Role
  const orgMember = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1);

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
    organizationId,
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
      // Admin has organization-wide access; developers and clients require project membership
      if (ctx.orgRole === 'admin') {
        return { allowed: true };
      }
      if (ctx.projectRole) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Requires explicit project membership' };

    case 'project:update':
      // Org Admin can update project; project developers can update project
      if (ctx.orgRole === 'admin') {
        return { allowed: true };
      }
      if (ctx.projectRole === 'developer') {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Requires org admin or assigned developer role on project' };

    case 'project:delete':
      // Only org admin can delete/archive projects
      if (ctx.orgRole === 'admin') {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Only org admin can delete projects' };

    case 'project:manage_members':
      // Org Admin can manage project members; assigned project developers can add project members
      if (ctx.orgRole === 'admin') {
        return { allowed: true };
      }
      if (ctx.projectRole === 'developer') {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Requires org admin or project developer role' };

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

    default:
      return { allowed: false, reason: 'Unknown policy action' };
  }
}

/**
 * Enforce policy helper for route handlers
 */
export async function enforcePolicy(
  userId: string,
  organizationId: string,
  action: PolicyAction,
  projectId?: string
): Promise<{ allowed: boolean; reason?: string; ctx: PermissionEvaluationContext }> {
  const ctx = await getAuthContext(userId, organizationId, projectId);
  const result = evaluatePolicy(ctx, action);
  return { ...result, ctx };
}
