import { getDb } from '../../config/database.js';
import {
  notifications,
  projects,
  projectMembers,
  organizationMembers,
  users,
  conversations,
  conversationParticipants,
} from '../../db/schema/index.js';
import { eq, and, desc, isNull, sql } from 'drizzle-orm';
import { broadcastToUser } from '../../modules/conversations/websocket.js';
import { NotificationType } from '@intentflow/types';

export class NotificationService {
  /**
   * Persist a notification and broadcast it in real time via WebSocket
   */
  async createNotification(data: {
    userId: string;
    organizationId: string;
    projectId?: string | null;
    type: NotificationType;
    title: string;
    body: string;
    entityType?: string | null;
    entityId?: string | null;
  }): Promise<any> {
    const db = getDb();
    const [notif] = await db
      .insert(notifications)
      .values({
        userId: data.userId,
        organizationId: data.organizationId,
        projectId: data.projectId || null,
        type: data.type,
        title: data.title,
        body: data.body,
        entityType: data.entityType || null,
        entityId: data.entityId || null,
      })
      .returning();

    // Fetch project name if projectId exists for rich client display
    let projectName: string | null = null;
    if (data.projectId) {
      const projRes = await db.select({ name: projects.name }).from(projects).where(eq(projects.id, data.projectId)).limit(1);
      projectName = projRes[0]?.name || null;
    }

    const payload = {
      ...notif,
      createdAt: notif.createdAt.toISOString(),
      readAt: notif.readAt ? notif.readAt.toISOString() : null,
      projectName,
    };

    // Real-time WebSocket delivery
    broadcastToUser(data.userId, {
      type: 'notification.created',
      notification: payload as any,
    });

    return payload;
  }

  /**
   * Get user notifications with pagination & unread filter
   */
  async getUserNotifications(
    userId: string,
    options?: { limit?: number; unreadOnly?: boolean }
  ): Promise<any[]> {
    const db = getDb();
    const limit = options?.limit || 30;
    const conditions = [eq(notifications.userId, userId)];

    if (options?.unreadOnly) {
      conditions.push(isNull(notifications.readAt));
    }

    const list = await db
      .select({
        id: notifications.id,
        userId: notifications.userId,
        organizationId: notifications.organizationId,
        projectId: notifications.projectId,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        entityType: notifications.entityType,
        entityId: notifications.entityId,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
        projectName: projects.name,
      })
      .from(notifications)
      .leftJoin(projects, eq(notifications.projectId, projects.id))
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    return list.map((n: any) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
      readAt: n.readAt ? n.readAt.toISOString() : null,
    }));
  }

  /**
   * Get unread notification count for user
   */
  async getUnreadCount(userId: string): Promise<number> {
    const db = getDb();
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));

    return Number(result[0]?.count || 0);
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<any> {
    const db = getDb();
    const existing = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
      .limit(1);

    if (existing.length === 0) {
      throw new Error(`Notification not found or access denied: ${notificationId}`);
    }

    const [updated] = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(eq(notifications.id, notificationId))
      .returning();

    broadcastToUser(userId, {
      type: 'notification.read',
      notificationId,
    });

    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      readAt: updated.readAt ? updated.readAt.toISOString() : null,
    };
  }

  /**
   * Mark all notifications for a user as read
   */
  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const db = getDb();
    const result = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
      .returning();

    return { count: result.length };
  }

  // ==========================================
  // DETERMINISTIC NOTIFICATION DISPATCHERS
  // ==========================================

  /**
   * Client sends message -> Notify assigned developers.
   * Developer sends message -> Notify relevant clients.
   */
  async notifyOnMessageSent(params: {
    projectId: string;
    conversationId: string;
    senderId: string;
    body: string;
  }) {
    const db = getDb();
    const [proj] = await db.select().from(projects).where(eq(projects.id, params.projectId)).limit(1);
    if (!proj) return;

    // Fetch sender role in project
    const [senderMember] = await db
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, params.projectId), eq(projectMembers.userId, params.senderId)))
      .limit(1);

    const senderRole = senderMember ? senderMember.role : 'developer';
    const targetRole = senderRole === 'client' ? 'developer' : 'client';

    // Fetch project members matching targetRole
    const recipients = await db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, params.projectId),
          eq(projectMembers.role, targetRole as any)
        )
      );

    const [senderUser] = await db.select({ name: users.name }).from(users).where(eq(users.id, params.senderId)).limit(1);
    const senderName = senderUser?.name || 'User';

    for (const r of recipients) {
      if (r.userId !== params.senderId) {
        await this.createNotification({
          userId: r.userId,
          organizationId: proj.organizationId,
          projectId: proj.id,
          type: 'message_received',
          title: `New message from ${senderName}`,
          body: params.body.length > 100 ? `${params.body.substring(0, 97)}...` : params.body,
          entityType: 'conversation',
          entityId: params.conversationId,
        });
      }
    }
  }

  /**
   * Intent confirmed -> Notify client participants (client-safe message)
   */
  async notifyOnIntentConfirmed(params: { projectId: string; intentId: string; intentTitle: string }) {
    const db = getDb();
    const [proj] = await db.select().from(projects).where(eq(projects.id, params.projectId)).limit(1);
    if (!proj) return;

    const clients = await db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, params.projectId), eq(projectMembers.role, 'client')));

    for (const c of clients) {
      await this.createNotification({
        userId: c.userId,
        organizationId: proj.organizationId,
        projectId: proj.id,
        type: 'intent_confirmed',
        title: 'Requirement Confirmed',
        body: `Intent confirmed: "${params.intentTitle}". Work proposal is being prepared.`,
        entityType: 'intent',
        entityId: params.intentId,
      });
    }
  }

  /**
   * Clarification requested -> Notify client
   */
  async notifyOnClarificationRequested(params: { projectId: string; intentId: string; questionText: string }) {
    const db = getDb();
    const [proj] = await db.select().from(projects).where(eq(projects.id, params.projectId)).limit(1);
    if (!proj) return;

    const clients = await db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, params.projectId), eq(projectMembers.role, 'client')));

    for (const c of clients) {
      await this.createNotification({
        userId: c.userId,
        organizationId: proj.organizationId,
        projectId: proj.id,
        type: 'clarification_requested',
        title: 'Clarification Requested',
        body: params.questionText,
        entityType: 'intent',
        entityId: params.intentId,
      });
    }
  }

  /**
   * Work proposal ready -> Notify assigned project developers
   */
  async notifyOnWorkProposalReady(params: { projectId: string; proposalId: string; intentTitle: string }) {
    const db = getDb();
    const [proj] = await db.select().from(projects).where(eq(projects.id, params.projectId)).limit(1);
    if (!proj) return;

    const devs = await db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, params.projectId), eq(projectMembers.role, 'developer')));

    for (const d of devs) {
      await this.createNotification({
        userId: d.userId,
        organizationId: proj.organizationId,
        projectId: proj.id,
        type: 'work_review',
        title: 'Work Proposal Ready for Review',
        body: `AI generated work proposal ready for "${params.intentTitle}".`,
        entityType: 'work_proposal',
        entityId: params.proposalId,
      });
    }
  }

  /**
   * Work assigned -> Notify assigned developer
   */
  async notifyOnWorkAssigned(params: {
    projectId: string;
    workItemId: string;
    title: string;
    assignedTo: string;
    actorId: string;
  }) {
    if (params.assignedTo === params.actorId) return; // Don't self-notify
    const db = getDb();
    const [proj] = await db.select().from(projects).where(eq(projects.id, params.projectId)).limit(1);
    if (!proj) return;

    await this.createNotification({
      userId: params.assignedTo,
      organizationId: proj.organizationId,
      projectId: proj.id,
      type: 'work_assigned',
      title: 'Work Item Assigned',
      body: `You were assigned: "${params.title}"`,
      entityType: 'work_item',
      entityId: params.workItemId,
    });
  }

  /**
   * Work status transition -> Notify relevant stakeholders
   */
  async notifyOnWorkStatusChanged(params: {
    projectId: string;
    workItemId: string;
    title: string;
    oldStatus: string;
    newStatus: string;
    actorId: string;
  }) {
    const db = getDb();
    const [proj] = await db.select().from(projects).where(eq(projects.id, params.projectId)).limit(1);
    if (!proj) return;

    const members = await db
      .select({ userId: projectMembers.userId, role: projectMembers.role })
      .from(projectMembers)
      .where(eq(projectMembers.projectId, params.projectId));

    let type: NotificationType = 'project_update';
    let title = 'Work Updated';
    let body = `Work item "${params.title}" moved to ${params.newStatus}`;

    if (params.newStatus === 'in_progress') {
      type = 'work_started';
      title = 'Work Started';
      body = `Development started on "${params.title}".`;
    } else if (params.newStatus === 'blocked') {
      type = 'work_blocked';
      title = 'Work Blocked';
      body = `Work item "${params.title}" was marked as blocked.`;
    } else if (params.newStatus === 'in_review') {
      type = 'work_review';
      title = 'Work Ready for Review';
      body = `Work item "${params.title}" is ready for review.`;
    } else if (params.newStatus === 'completed') {
      type = 'work_completed';
      title = 'Work Completed';
      body = `Work item "${params.title}" has been completed!`;
    }

    for (const m of members) {
      if (m.userId !== params.actorId) {
        await this.createNotification({
          userId: m.userId,
          organizationId: proj.organizationId,
          projectId: proj.id,
          type,
          title,
          body,
          entityType: 'work_item',
          entityId: params.workItemId,
        });
      }
    }
  }

  /**
   * Deliverable submitted for review -> Notify project clients
   */
  async notifyOnDeliverableSubmitted(params: { projectId: string; deliverableId: string; title: string; submittedById: string }) {
    const db = getDb();
    const [proj] = await db.select().from(projects).where(eq(projects.id, params.projectId)).limit(1);
    if (!proj) return;

    const clients = await db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, params.projectId), eq(projectMembers.role, 'client')));

    for (const c of clients) {
      if (c.userId !== params.submittedById) {
        await this.createNotification({
          userId: c.userId,
          organizationId: proj.organizationId,
          projectId: proj.id,
          type: 'deliverable_ready',
          title: 'Deliverable Ready for Review',
          body: `"${params.title}" is ready for your review and approval.`,
          entityType: 'deliverable',
          entityId: params.deliverableId,
        });
      }
    }
  }

  /**
   * Deliverable approved by client -> Notify project developers
   */
  async notifyOnDeliverableApproved(params: { projectId: string; deliverableId: string; title: string; approvedById: string }) {
    const db = getDb();
    const [proj] = await db.select().from(projects).where(eq(projects.id, params.projectId)).limit(1);
    if (!proj) return;

    const devs = await db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, params.projectId), eq(projectMembers.role, 'developer')));

    for (const d of devs) {
      if (d.userId !== params.approvedById) {
        await this.createNotification({
          userId: d.userId,
          organizationId: proj.organizationId,
          projectId: proj.id,
          type: 'deliverable_approved',
          title: 'Deliverable Approved!',
          body: `Client approved deliverable "${params.title}".`,
          entityType: 'deliverable',
          entityId: params.deliverableId,
        });
      }
    }
  }

  /**
   * Deliverable changes requested -> Notify project developers
   */
  async notifyOnDeliverableChangesRequested(params: { projectId: string; deliverableId: string; title: string; requestedById: string; comment: string }) {
    const db = getDb();
    const [proj] = await db.select().from(projects).where(eq(projects.id, params.projectId)).limit(1);
    if (!proj) return;

    const devs = await db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, params.projectId), eq(projectMembers.role, 'developer')));

    for (const d of devs) {
      if (d.userId !== params.requestedById) {
        await this.createNotification({
          userId: d.userId,
          organizationId: proj.organizationId,
          projectId: proj.id,
          type: 'deliverable_changes_requested',
          title: 'Changes Requested on Deliverable',
          body: `Client requested changes on "${params.title}": ${params.comment.substring(0, 100)}`,
          entityType: 'deliverable',
          entityId: params.deliverableId,
        });
      }
    }
  }

  /**
   * Revision status changed -> Notify client
   */
  async notifyOnRevisionStatusChanged(params: { projectId: string; deliverableId: string; revisionId: string; newStatus: string; updatedById: string }) {
    const db = getDb();
    const [proj] = await db.select().from(projects).where(eq(projects.id, params.projectId)).limit(1);
    if (!proj) return;

    const clients = await db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, params.projectId), eq(projectMembers.role, 'client')));

    const type: NotificationType = params.newStatus === 'resolved' ? 'revision_resolved' : 'revision_started';
    const title = params.newStatus === 'resolved' ? 'Revision Resolved' : 'Revision In Progress';
    const body = params.newStatus === 'resolved' 
      ? 'Developer has resolved your requested revisions.'
      : 'Developer has started working on your requested revision.';

    for (const c of clients) {
      if (c.userId !== params.updatedById) {
        await this.createNotification({
          userId: c.userId,
          organizationId: proj.organizationId,
          projectId: proj.id,
          type,
          title,
          body,
          entityType: 'deliverable',
          entityId: params.deliverableId,
        });
      }
    }
  }

  /**
   * Milestone completed -> Notify all project members
   */
  async notifyOnMilestoneCompleted(params: { projectId: string; milestoneId: string; title: string; completedById: string }) {
    const db = getDb();
    const [proj] = await db.select().from(projects).where(eq(projects.id, params.projectId)).limit(1);
    if (!proj) return;

    const members = await db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(eq(projectMembers.projectId, params.projectId));

    for (const m of members) {
      if (m.userId !== params.completedById) {
        await this.createNotification({
          userId: m.userId,
          organizationId: proj.organizationId,
          projectId: proj.id,
          type: 'milestone_completed',
          title: 'Milestone Completed 🎉',
          body: `Project milestone "${params.title}" has been completed!`,
          entityType: 'milestone',
          entityId: params.milestoneId,
        });
      }
    }
  }
}
