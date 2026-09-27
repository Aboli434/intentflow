import { getDb } from '../../config/database.js';
import {
  workItems,
  workItemRequirements,
  workItemActivity,
  users,
  intents,
  intentRequirements,
} from '../../db/schema/index.js';
import { eq, desc, asc, and } from 'drizzle-orm';
import { broadcastToConversation } from '../../modules/conversations/websocket.js';

export class WorkItemService {
  /**
   * Helper to fetch work item and project context for permission checks
   */
  async getWorkItemProject(workItemId: string) {
    const db = getDb();
    const list = await db
      .select({
        workItemId: workItems.id,
        projectId: workItems.projectId,
        intentId: workItems.intentId,
        status: workItems.status,
      })
      .from(workItems)
      .where(eq(workItems.id, workItemId))
      .limit(1);

    return list[0] || null;
  }

  async getWorkItemDetails(workItemId: string): Promise<any> {
    return this.getWorkItemWithDetails(workItemId);
  }

  async getWorkItemWithDetails(workItemId: string): Promise<any> {
    const db = getDb();
    const items = await db.select().from(workItems).where(eq(workItems.id, workItemId)).limit(1);
    if (items.length === 0) return null;

    const base = items[0];

    // Creator info
    const creator = await db.select().from(users).where(eq(users.id, base.createdBy)).limit(1);

    // Assignee info
    let assignee = null;
    if (base.assignedTo) {
      const assigneeRes = await db.select().from(users).where(eq(users.id, base.assignedTo)).limit(1);
      assignee = assigneeRes[0] || null;
    }

    // Requirements link & Traceability chain
    const reqLinks = await db
      .select({
        id: workItemRequirements.id,
        requirementId: workItemRequirements.requirementId,
        requirementText: intentRequirements.text,
        createdAt: workItemRequirements.createdAt,
      })
      .from(workItemRequirements)
      .leftJoin(intentRequirements, eq(workItemRequirements.requirementId, intentRequirements.id))
      .where(eq(workItemRequirements.workItemId, workItemId));

    // Intent & Conversation reference
    let intentInfo = null;
    if (base.intentId) {
      const intentRes = await db
        .select({
          id: intents.id,
          title: intents.title,
          summary: intents.summary,
          conversationId: intents.conversationId,
          sourceMessageId: intents.sourceMessageId,
        })
        .from(intents)
        .where(eq(intents.id, base.intentId))
        .limit(1);
      intentInfo = intentRes[0] || null;
    }

    // Activity log
    const activities = await db
      .select({
        id: workItemActivity.id,
        workItemId: workItemActivity.workItemId,
        actorId: workItemActivity.actorId,
        type: workItemActivity.type,
        metadata: workItemActivity.metadata,
        createdAt: workItemActivity.createdAt,
        actorName: users.name,
      })
      .from(workItemActivity)
      .innerJoin(users, eq(workItemActivity.actorId, users.id))
      .where(eq(workItemActivity.workItemId, workItemId))
      .orderBy(desc(workItemActivity.createdAt));

    return {
      ...base,
      createdAt: base.createdAt.toISOString(),
      updatedAt: base.updatedAt.toISOString(),
      dueDate: base.dueDate ? base.dueDate.toISOString() : null,
      completedAt: base.completedAt ? base.completedAt.toISOString() : null,
      creatorName: creator[0]?.name || 'Unknown',
      assigneeName: assignee?.name || null,
      assigneeEmail: assignee?.email || null,
      requirements: reqLinks.map((r: any) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
      activities: activities.map((a: any) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      })),
      intentTitle: intentInfo?.title || null,
      intentSummary: intentInfo?.summary || null,
      conversationId: intentInfo?.conversationId || null,
      sourceMessageId: intentInfo?.sourceMessageId || null,
    };
  }

  async getProjectWorkItems(
    projectId: string,
    filters?: { status?: string; assignedTo?: string }
  ): Promise<any[]> {
    const db = getDb();
    const conditions = [eq(workItems.projectId, projectId)];

    if (filters?.status) {
      conditions.push(eq(workItems.status, filters.status as any));
    }
    if (filters?.assignedTo) {
      conditions.push(eq(workItems.assignedTo, filters.assignedTo));
    }

    const items = await db
      .select()
      .from(workItems)
      .where(and(...conditions))
      .orderBy(asc(workItems.position), desc(workItems.createdAt));

    return Promise.all(items.map((i: any) => this.getWorkItemWithDetails(i.id)));
  }

  async getProjectWorkMetrics(projectId: string): Promise<any> {
    const db = getDb();
    const items = await db.select().from(workItems).where(eq(workItems.projectId, projectId));

    const metrics = {
      total: items.length,
      backlog: 0,
      ready: 0,
      in_progress: 0,
      blocked: 0,
      in_review: 0,
      completed: 0,
      cancelled: 0,
      completionRatePercentage: 0,
    };

    for (const item of items) {
      if (metrics.hasOwnProperty(item.status)) {
        (metrics as any)[item.status]++;
      }
    }

    if (metrics.total > 0) {
      metrics.completionRatePercentage = Math.round((metrics.completed / metrics.total) * 100);
    }

    return metrics;
  }

  async createWorkItem(projectId: string, userId: string, data: any): Promise<any> {
    const db = getDb();
    const [newItem] = await db
      .insert(workItems)
      .values({
        projectId,
        intentId: data.intentId || null,
        title: data.title,
        description: data.description || null,
        priority: data.priority || 'medium',
        status: data.status || 'ready',
        createdBy: userId,
        assignedTo: data.assignedTo || null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      })
      .returning();

    if (data.requirementIds && data.requirementIds.length > 0) {
      for (const reqId of data.requirementIds) {
        await db.insert(workItemRequirements).values({
          workItemId: newItem.id,
          requirementId: reqId,
        });
      }
    }

    // Activity log: created
    await db.insert(workItemActivity).values({
      workItemId: newItem.id,
      actorId: userId,
      type: 'created',
      metadata: { title: newItem.title },
    });

    if (data.assignedTo) {
      await db.insert(workItemActivity).values({
        workItemId: newItem.id,
        actorId: userId,
        type: 'assigned',
        metadata: { assignedTo: data.assignedTo },
      });
    }

    const details = await this.getWorkItemWithDetails(newItem.id);

    if (details.conversationId) {
      broadcastToConversation(details.conversationId, {
        type: 'work.created',
        projectId,
        workItem: details,
      });
    }

    return details;
  }

  async updateWorkItem(workItemId: string, actorId: string, data: any): Promise<any> {
    const db = getDb();
    const current = await this.getWorkItemWithDetails(workItemId);
    if (!current) throw new Error(`Work item not found: ${workItemId}`);

    const updatePayload: any = {
      updatedAt: new Date(),
    };

    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.priority !== undefined) updatePayload.priority = data.priority;
    if (data.dueDate !== undefined) updatePayload.dueDate = data.dueDate ? new Date(data.dueDate) : null;

    await db.update(workItems).set(updatePayload).where(eq(workItems.id, workItemId));

    if (data.priority !== undefined && data.priority !== current.priority) {
      await db.insert(workItemActivity).values({
        workItemId,
        actorId,
        type: 'priority_changed',
        metadata: { from: current.priority, to: data.priority },
      });
    }

    const updated = await this.getWorkItemWithDetails(workItemId);

    if (updated.conversationId) {
      broadcastToConversation(updated.conversationId, {
        type: 'work.updated',
        projectId: updated.projectId,
        workItem: updated,
      });
    }

    return updated;
  }

  async updateWorkItemStatus(
    workItemId: string,
    actorId: string,
    newStatus: string
  ): Promise<any> {
    const db = getDb();
    const current = await this.getWorkItemWithDetails(workItemId);
    if (!current) throw new Error(`Work item not found: ${workItemId}`);

    const oldStatus = current.status;
    const completedAt = newStatus === 'completed' ? new Date() : (newStatus !== 'completed' && oldStatus === 'completed' ? null : current.completedAt);

    await db
      .update(workItems)
      .set({
        status: newStatus as any,
        updatedAt: new Date(),
        completedAt: completedAt ? new Date(completedAt) : null,
      })
      .where(eq(workItems.id, workItemId));

    // Record activity
    let activityType: 'completed' | 'blocked' | 'unblocked' | 'status_changed' = 'status_changed';
    if (newStatus === 'completed') activityType = 'completed';
    else if (newStatus === 'blocked') activityType = 'blocked';
    else if (oldStatus === 'blocked' && newStatus !== 'blocked') activityType = 'unblocked';

    await db.insert(workItemActivity).values({
      workItemId,
      actorId,
      type: activityType,
      metadata: { from: oldStatus, to: newStatus },
    });

    const updated = await this.getWorkItemWithDetails(workItemId);

    // Phase 6 Project Activity & Notification integration
    try {
      const { ActivityService } = await import('../activity/activity.service.js');
      const { NotificationService } = await import('../notifications/notification.service.js');
      const activityService = new ActivityService();
      const notificationService = new NotificationService();

      await activityService.recordActivity({
        projectId: updated.projectId,
        actorId,
        type: `work_${newStatus}`,
        entityType: 'work_item',
        entityId: workItemId,
        metadata: { title: updated.title, from: oldStatus, to: newStatus },
      });

      await notificationService.notifyOnWorkStatusChanged({
        projectId: updated.projectId,
        workItemId,
        title: updated.title,
        oldStatus,
        newStatus,
        actorId,
      });
    } catch (err) {
      console.warn('[WorkItemService] Failed to dispatch project activity/notification:', err);
    }

    if (updated.conversationId) {
      const eventType = newStatus === 'completed' ? 'work.completed' : 'work.status_changed';
      broadcastToConversation(updated.conversationId, {
        type: eventType,
        projectId: updated.projectId,
        workItemId,
        status: newStatus as any,
      });
    }

    return updated;
  }

  async assignWorkItem(workItemId: string, actorId: string, assignedTo?: string | null): Promise<any> {
    const db = getDb();
    const current = await this.getWorkItemWithDetails(workItemId);
    if (!current) throw new Error(`Work item not found: ${workItemId}`);

    const targetUser = assignedTo || null;

    await db
      .update(workItems)
      .set({
        assignedTo: targetUser,
        updatedAt: new Date(),
      })
      .where(eq(workItems.id, workItemId));

    await db.insert(workItemActivity).values({
      workItemId,
      actorId,
      type: 'assigned',
      metadata: { assignedTo: targetUser },
    });

    const updated = await this.getWorkItemWithDetails(workItemId);

    // Phase 6 Activity & Notification integration
    try {
      const { ActivityService } = await import('../activity/activity.service.js');
      const { NotificationService } = await import('../notifications/notification.service.js');
      const activityService = new ActivityService();
      const notificationService = new NotificationService();

      await activityService.recordActivity({
        projectId: updated.projectId,
        actorId,
        type: 'work_assigned',
        entityType: 'work_item',
        entityId: workItemId,
        metadata: { title: updated.title, assignedTo: targetUser },
      });

      if (targetUser) {
        await notificationService.notifyOnWorkAssigned({
          projectId: updated.projectId,
          workItemId,
          title: updated.title,
          assignedTo: targetUser,
          actorId,
        });
      }
    } catch (err) {
      console.warn('[WorkItemService] Failed to dispatch assignment notification:', err);
    }

    if (updated.conversationId) {
      broadcastToConversation(updated.conversationId, {
        type: 'work.assigned',
        projectId: updated.projectId,
        workItemId,
        assignedTo: targetUser,
      });
    }

    return updated;
  }

  async getWorkItemActivity(workItemId: string): Promise<any[]> {
    const db = getDb();
    const activities = await db
      .select({
        id: workItemActivity.id,
        workItemId: workItemActivity.workItemId,
        actorId: workItemActivity.actorId,
        type: workItemActivity.type,
        metadata: workItemActivity.metadata,
        createdAt: workItemActivity.createdAt,
        actorName: users.name,
      })
      .from(workItemActivity)
      .innerJoin(users, eq(workItemActivity.actorId, users.id))
      .where(eq(workItemActivity.workItemId, workItemId))
      .orderBy(desc(workItemActivity.createdAt));

    return activities.map((a: any) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    }));
  }
}
