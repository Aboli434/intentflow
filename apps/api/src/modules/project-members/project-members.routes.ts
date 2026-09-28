import { FastifyInstance } from 'fastify';
import { eq, and, notInArray, inArray } from 'drizzle-orm';
import { getDb } from '../../config/database.js';
import {
  projects,
  projectMembers,
  organizationMembers,
  users,
  projectMemberActivity,
} from '../../db/schema/index.js';
import { authenticateRequest, AuthenticatedRequest } from '../../lib/auth.js';
import { enforcePolicy } from '../../lib/permissions.js';
import {
  assignProjectMemberSchema,
  updateProjectMemberRoleSchema,
} from '@intentflow/validation';
import { NotificationService } from '../../services/notifications/notification.service.js';
import { ActivityService } from '../../services/activity/activity.service.js';
import { broadcastToUser, broadcastToProject } from '../conversations/websocket.js';
import { ProjectRole } from '@intentflow/types';

const notificationService = new NotificationService();
const activityService = new ActivityService();

export async function projectMemberRoutes(app: FastifyInstance) {
  // GET /api/projects/:projectId/members — List project members
  app.get(
    '/:projectId/members',
    { preHandler: [authenticateRequest] },
    async (request: AuthenticatedRequest, reply) => {
      const { projectId } = request.params as { projectId: string };
      const user = request.user!;
      const db = getDb();

      const [proj] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!proj) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Project not found' },
        });
      }

      const policy = await enforcePolicy(user.id, proj.organizationId, 'project_member:view', projectId);
      if (!policy.allowed) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: policy.reason },
        });
      }

      const memberRecords = await db
        .select({
          pm: projectMembers,
          u: users,
          om: organizationMembers,
        })
        .from(projectMembers)
        .innerJoin(users, eq(projectMembers.userId, users.id))
        .innerJoin(
          organizationMembers,
          and(
            eq(organizationMembers.userId, users.id),
            eq(organizationMembers.organizationId, proj.organizationId)
          )
        )
        .where(eq(projectMembers.projectId, projectId));

      const members = memberRecords.map((r) => ({
        id: r.pm.id,
        projectId: r.pm.projectId,
        userId: r.u.id,
        name: r.u.name,
        email: r.u.email,
        avatarUrl: r.u.avatarUrl,
        organizationRole: r.om.role,
        projectRole: r.pm.role as ProjectRole,
        assignedAt: r.pm.createdAt.toISOString(),
        assignedBy: r.pm.assignedBy,
      }));

      return reply.send({
        success: true,
        data: members,
        members,
      });
    }
  );

  // GET /api/projects/:projectId/available-members — List unassigned organization members
  app.get(
    '/:projectId/available-members',
    { preHandler: [authenticateRequest] },
    async (request: AuthenticatedRequest, reply) => {
      const { projectId } = request.params as { projectId: string };
      const user = request.user!;
      const db = getDb();

      const [proj] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!proj) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Project not found' },
        });
      }

      const policy = await enforcePolicy(user.id, proj.organizationId, 'project_member:view', projectId);
      if (!policy.allowed) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: policy.reason },
        });
      }

      // Find already assigned userIds for this project
      const assigned = await db
        .select({ userId: projectMembers.userId })
        .from(projectMembers)
        .where(eq(projectMembers.projectId, projectId));

      const assignedUserIds = assigned.map((a) => a.userId);

      // Fetch organization members not in assignedUserIds
      const queryConditions = [eq(organizationMembers.organizationId, proj.organizationId)];
      if (assignedUserIds.length > 0) {
        queryConditions.push(notInArray(organizationMembers.userId, assignedUserIds));
      }

      const availableRecords = await db
        .select({
          u: users,
          om: organizationMembers,
        })
        .from(organizationMembers)
        .innerJoin(users, eq(organizationMembers.userId, users.id))
        .where(and(...queryConditions));

      const availableMembers = availableRecords.map((r) => ({
        userId: r.u.id,
        name: r.u.name,
        email: r.u.email,
        avatarUrl: r.u.avatarUrl,
        organizationRole: r.om.role,
      }));

      return reply.send({
        success: true,
        data: availableMembers,
      });
    }
  );

  // POST /api/projects/:projectId/members — Assign member to project
  app.post(
    '/:projectId/members',
    { preHandler: [authenticateRequest] },
    async (request: AuthenticatedRequest, reply) => {
      const { projectId } = request.params as { projectId: string };
      const user = request.user!;
      const db = getDb();

      const [proj] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!proj) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Project not found' },
        });
      }

      const policy = await enforcePolicy(user.id, proj.organizationId, 'project_member:assign', projectId);
      if (!policy.allowed) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: policy.reason },
        });
      }

      const parseResult = assignProjectMemberSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(422).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parseResult.error.format() },
        });
      }

      const { userId: targetUserId, projectRole } = parseResult.data;

      // Check target user belongs to same organization
      const [targetOrgMember] = await db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, proj.organizationId),
            eq(organizationMembers.userId, targetUserId)
          )
        )
        .limit(1);

      if (!targetOrgMember) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Target user does not belong to the organization' },
        });
      }

      // Check if already assigned
      const [existing] = await db
        .select()
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, projectId),
            eq(projectMembers.userId, targetUserId)
          )
        )
        .limit(1);

      if (existing) {
        return reply.status(409).send({
          success: false,
          error: { code: 'ALREADY_ASSIGNED', message: 'User is already assigned to this project' },
        });
      }

      // Create project member
      const [newMember] = await db
        .insert(projectMembers)
        .values({
          projectId,
          userId: targetUserId,
          role: projectRole,
          assignedBy: user.id,
        })
        .returning();

      const [targetUser] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);

      const formattedMember = {
        id: newMember.id,
        projectId: newMember.projectId,
        userId: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        avatarUrl: targetUser.avatarUrl,
        organizationRole: targetOrgMember.role,
        projectRole: newMember.role as ProjectRole,
        assignedAt: newMember.createdAt.toISOString(),
        assignedBy: newMember.assignedBy,
      };

      // Record immutable project member activity
      await db.insert(projectMemberActivity).values({
        projectId,
        userId: targetUserId,
        actorId: user.id,
        action: 'member_assigned',
        metadata: { projectRole },
      });

      // Record activity trail
      await activityService.recordActivity({
        projectId,
        actorId: user.id,
        type: 'project_member_assigned',
        entityType: 'project_member',
        entityId: newMember.id,
        metadata: {
          targetUserName: targetUser.name,
          projectRole,
        },
      });

      // Send notification if target user is not actor
      if (targetUserId !== user.id) {
        await notificationService.createNotification({
          userId: targetUserId,
          organizationId: proj.organizationId,
          projectId,
          type: 'project_member_assigned',
          title: 'Assigned to Project',
          body: `You were assigned to the "${proj.name}" project as ${projectRole}.`,
          entityType: 'project',
          entityId: projectId,
        });
      }

      // Realtime WebSocket broadcast
      broadcastToProject(projectId, {
        type: 'project.member_assigned',
        projectId,
        member: formattedMember,
      });

      return reply.status(201).send({
        success: true,
        data: formattedMember,
      });
    }
  );

  // PATCH /api/projects/:projectId/members/:memberId — Update project member role
  app.patch(
    '/:projectId/members/:memberId',
    { preHandler: [authenticateRequest] },
    async (request: AuthenticatedRequest, reply) => {
      const { projectId, memberId } = request.params as { projectId: string; memberId: string };
      const user = request.user!;
      const db = getDb();

      const [proj] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!proj) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Project not found' },
        });
      }

      const policy = await enforcePolicy(user.id, proj.organizationId, 'project_member:edit', projectId);
      if (!policy.allowed) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: policy.reason },
        });
      }

      const parseResult = updateProjectMemberRoleSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(422).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parseResult.error.format() },
        });
      }

      const { projectRole: newRole } = parseResult.data;

      const [targetMember] = await db
        .select()
        .from(projectMembers)
        .where(and(eq(projectMembers.id, memberId), eq(projectMembers.projectId, projectId)))
        .limit(1);

      if (!targetMember) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Project member record not found' },
        });
      }

      const oldRole = targetMember.role;

      // Protect last client on project
      if (oldRole === 'client' && newRole !== 'client') {
        const clientMembers = await db
          .select()
          .from(projectMembers)
          .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.role, 'client')));

        if (clientMembers.length <= 1) {
          return reply.status(400).send({
            success: false,
            error: { code: 'LAST_CLIENT', message: 'Cannot remove or downgrade the last client of the project' },
          });
        }
      }

      const [updated] = await db
        .update(projectMembers)
        .set({ role: newRole, updatedAt: new Date() })
        .where(eq(projectMembers.id, memberId))
        .returning();

      const [targetUser] = await db.select().from(users).where(eq(users.id, updated.userId)).limit(1);
      const [targetOrgMember] = await db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, proj.organizationId),
            eq(organizationMembers.userId, updated.userId)
          )
        )
        .limit(1);

      const formattedMember = {
        id: updated.id,
        projectId: updated.projectId,
        userId: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        avatarUrl: targetUser.avatarUrl,
        organizationRole: targetOrgMember?.role || 'developer',
        projectRole: updated.role as ProjectRole,
        assignedAt: updated.createdAt.toISOString(),
        assignedBy: updated.assignedBy,
      };

      // Record immutable project member activity
      await db.insert(projectMemberActivity).values({
        projectId,
        userId: updated.userId,
        actorId: user.id,
        action: 'member_role_changed',
        metadata: { oldRole, newRole },
      });

      // Record activity trail
      await activityService.recordActivity({
        projectId,
        actorId: user.id,
        type: 'project_member_role_changed',
        entityType: 'project_member',
        entityId: updated.id,
        metadata: {
          targetUserName: targetUser.name,
          oldRole,
          newRole,
        },
      });

      // Notify target member
      if (updated.userId !== user.id) {
        await notificationService.createNotification({
          userId: updated.userId,
          organizationId: proj.organizationId,
          projectId,
          type: 'project_member_role_changed',
          title: 'Project Role Updated',
          body: `Your role on "${proj.name}" was changed to ${newRole}.`,
          entityType: 'project',
          entityId: projectId,
        });
      }

      // Realtime WebSocket broadcast
      broadcastToProject(projectId, {
        type: 'project.member_role_changed',
        projectId,
        memberId: updated.id,
        projectRole: newRole as ProjectRole,
      });

      return reply.send({
        success: true,
        data: formattedMember,
      });
    }
  );

  // DELETE /api/projects/:projectId/members/:memberId — Remove member from project
  app.delete(
    '/:projectId/members/:memberId',
    { preHandler: [authenticateRequest] },
    async (request: AuthenticatedRequest, reply) => {
      const { projectId, memberId } = request.params as { projectId: string; memberId: string };
      const user = request.user!;
      const db = getDb();

      const [proj] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!proj) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Project not found' },
        });
      }

      const policy = await enforcePolicy(user.id, proj.organizationId, 'project_member:remove', projectId);
      if (!policy.allowed) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: policy.reason },
        });
      }

      const [targetMember] = await db
        .select()
        .from(projectMembers)
        .where(and(eq(projectMembers.id, memberId), eq(projectMembers.projectId, projectId)))
        .limit(1);

      if (!targetMember) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Project member record not found' },
        });
      }

      // Protect last client on project
      if (targetMember.role === 'client') {
        const clientMembers = await db
          .select()
          .from(projectMembers)
          .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.role, 'client')));

        if (clientMembers.length <= 1) {
          return reply.status(400).send({
            success: false,
            error: { code: 'LAST_CLIENT', message: 'Cannot remove the last client from the project' },
          });
        }
      }

      const [targetUser] = await db.select().from(users).where(eq(users.id, targetMember.userId)).limit(1);

      // Record immutable project member activity before delete
      await db.insert(projectMemberActivity).values({
        projectId,
        userId: targetMember.userId,
        actorId: user.id,
        action: 'member_removed',
        metadata: { previousRole: targetMember.role },
      });

      await db.delete(projectMembers).where(eq(projectMembers.id, memberId));

      // Record activity trail
      await activityService.recordActivity({
        projectId,
        actorId: user.id,
        type: 'project_member_removed',
        entityType: 'project_member',
        entityId: memberId,
        metadata: {
          targetUserName: targetUser?.name || 'Member',
          previousRole: targetMember.role,
        },
      });

      // Notify target member
      if (targetMember.userId !== user.id) {
        await notificationService.createNotification({
          userId: targetMember.userId,
          organizationId: proj.organizationId,
          projectId,
          type: 'project_member_removed',
          title: 'Removed from Project',
          body: `You were removed from the "${proj.name}" project.`,
          entityType: 'project',
          entityId: projectId,
        });
      }

      // Realtime WebSocket broadcast
      broadcastToProject(projectId, {
        type: 'project.member_removed',
        projectId,
        memberId,
      });

      return reply.send({
        success: true,
        message: 'Project member removed successfully',
      });
    }
  );
}
