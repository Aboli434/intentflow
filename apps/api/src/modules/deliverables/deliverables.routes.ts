import { FastifyInstance } from 'fastify';
import { eq, and, desc, inArray } from 'drizzle-orm';
import {
  createDeliverableSchema,
  updateDeliverableSchema,
  requestChangesSchema,
  updateRevisionStatusSchema,
} from '@intentflow/validation';
import { getDb } from '../../config/database.js';
import {
  deliverables,
  deliverableWorkItems,
  deliverableAttachments,
  clientReviews,
  revisionRequests,
  projectMilestones,
  milestoneDeliverables,
  projects,
  workItems,
  attachments,
  users,
} from '../../db/schema/index.js';
import { authenticateRequest, AuthenticatedRequest } from '../../lib/auth.js';
import { enforcePolicy } from '../../lib/permissions.js';
import { NotificationService } from '../../services/notifications/notification.service.js';
import { ActivityService } from '../../services/activity/activity.service.js';
import { broadcastToConversation } from '../conversations/websocket.js';

const notificationService = new NotificationService();
const activityService = new ActivityService();

export async function deliverableRoutes(app: FastifyInstance) {
  // All HTTP API endpoints require authentication
  app.addHook('preHandler', authenticateRequest);

  /**
   * POST /api/projects/:projectId/deliverables
   * Create a new deliverable (Draft status)
   */
  app.post('/projects/:projectId/deliverables', async (request: AuthenticatedRequest, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const user = request.user!;
      const db = getDb();

      const parseResult = createDeliverableSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(422).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid deliverable payload', details: parseResult.error.format() },
        });
      }

      const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
      if (!project) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
      }

      const policy = await enforcePolicy(user.id, project.organizationId, 'deliverable:create', projectId);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const { title, description, workItemIds, attachmentIds, milestoneId } = parseResult.data;

      const [newDeliv] = await db
        .insert(deliverables)
        .values({
          projectId,
          title,
          description: description || null,
          status: 'draft',
          createdBy: user.id,
        })
        .returning();

      // Link work items
      if (workItemIds && workItemIds.length > 0) {
        for (const wiId of workItemIds) {
          await db.insert(deliverableWorkItems).values({
            deliverableId: newDeliv.id,
            workItemId: wiId,
          });
        }
      }

      // Link attachments
      if (attachmentIds && attachmentIds.length > 0) {
        for (const attId of attachmentIds) {
          await db.insert(deliverableAttachments).values({
            deliverableId: newDeliv.id,
            attachmentId: attId,
          });
        }
      }

      // Link to milestone
      if (milestoneId) {
        await db.insert(milestoneDeliverables).values({
          milestoneId,
          deliverableId: newDeliv.id,
        });
      }

      // Record Activity
      await activityService.recordActivity({
        projectId,
        actorId: user.id,
        type: 'deliverable_created',
        entityType: 'deliverable',
        entityId: newDeliv.id,
        metadata: { title: newDeliv.title },
      });

      return reply.status(201).send({
        success: true,
        data: newDeliv,
      });
    } catch (err: any) {
      console.error('Error creating deliverable:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * GET /api/projects/:projectId/deliverables
   * List deliverables for a project
   */
  app.get('/projects/:projectId/deliverables', async (request: AuthenticatedRequest, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const user = request.user!;
      const db = getDb();

      const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
      if (!project) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
      }

      const policy = await enforcePolicy(user.id, project.organizationId, 'deliverable:view', projectId);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const list = await db
        .select({
          id: deliverables.id,
          projectId: deliverables.projectId,
          title: deliverables.title,
          description: deliverables.description,
          status: deliverables.status,
          createdBy: deliverables.createdBy,
          createdAt: deliverables.createdAt,
          updatedAt: deliverables.updatedAt,
          deliveredAt: deliverables.deliveredAt,
          approvedAt: deliverables.approvedAt,
          approvedBy: deliverables.approvedBy,
          creatorName: users.name,
        })
        .from(deliverables)
        .leftJoin(users, eq(deliverables.createdBy, users.id))
        .where(eq(deliverables.projectId, projectId))
        .orderBy(desc(deliverables.createdAt));

      // Fetch linked details for list items
      const result = [];
      for (const item of list) {
        // Linked work items
        const linkedWis = await db
          .select({
            id: workItems.id,
            title: workItems.title,
            status: workItems.status,
            priority: workItems.priority,
          })
          .from(deliverableWorkItems)
          .innerJoin(workItems, eq(deliverableWorkItems.workItemId, workItems.id))
          .where(eq(deliverableWorkItems.deliverableId, item.id));

        // Linked attachments
        const linkedAtts = await db
          .select({
            id: attachments.id,
            fileName: attachments.fileName,
            mimeType: attachments.mimeType,
            size: attachments.size,
          })
          .from(deliverableAttachments)
          .innerJoin(attachments, eq(deliverableAttachments.attachmentId, attachments.id))
          .where(eq(deliverableAttachments.deliverableId, item.id));

        // Milestone
        const [mStone] = await db
          .select({
            id: projectMilestones.id,
            title: projectMilestones.title,
            status: projectMilestones.status,
          })
          .from(milestoneDeliverables)
          .innerJoin(projectMilestones, eq(milestoneDeliverables.milestoneId, projectMilestones.id))
          .where(eq(milestoneDeliverables.deliverableId, item.id))
          .limit(1);

        result.push({
          ...item,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
          deliveredAt: item.deliveredAt ? item.deliveredAt.toISOString() : null,
          approvedAt: item.approvedAt ? item.approvedAt.toISOString() : null,
          linkedWorkItems: linkedWis,
          attachments: linkedAtts,
          milestone: mStone || null,
        });
      }

      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (err: any) {
      console.error('Error listing deliverables:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * GET /api/deliverables/:deliverableId
   * Fetch single deliverable detail
   */
  app.get('/deliverables/:deliverableId', async (request: AuthenticatedRequest, reply) => {
    try {
      const { deliverableId } = request.params as { deliverableId: string };
      const user = request.user!;
      const db = getDb();

      const [deliv] = await db.select().from(deliverables).where(eq(deliverables.id, deliverableId)).limit(1);
      if (!deliv) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Deliverable not found' } });
      }

      const [project] = await db.select().from(projects).where(eq(projects.id, deliv.projectId)).limit(1);
      if (!project) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
      }

      const policy = await enforcePolicy(user.id, project.organizationId, 'deliverable:view', project.id);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      // Creator & Approver names
      const [creator] = await db.select({ name: users.name }).from(users).where(eq(users.id, deliv.createdBy)).limit(1);
      const [approver] = deliv.approvedBy ? await db.select({ name: users.name }).from(users).where(eq(users.id, deliv.approvedBy)).limit(1) : [null];

      // Linked work items
      const linkedWis = await db
        .select({
          id: workItems.id,
          title: workItems.title,
          status: workItems.status,
          priority: workItems.priority,
        })
        .from(deliverableWorkItems)
        .innerJoin(workItems, eq(deliverableWorkItems.workItemId, workItems.id))
        .where(eq(deliverableWorkItems.deliverableId, deliv.id));

      // Linked attachments
      const linkedAtts = await db
        .select({
          id: attachments.id,
          fileName: attachments.fileName,
          mimeType: attachments.mimeType,
          size: attachments.size,
          storageKey: attachments.storageKey,
        })
        .from(deliverableAttachments)
        .innerJoin(attachments, eq(deliverableAttachments.attachmentId, attachments.id))
        .where(eq(deliverableAttachments.deliverableId, deliv.id));

      // Reviews
      const reviewsList = await db
        .select({
          id: clientReviews.id,
          deliverableId: clientReviews.deliverableId,
          clientId: clientReviews.clientId,
          status: clientReviews.status,
          comment: clientReviews.comment,
          createdAt: clientReviews.createdAt,
          updatedAt: clientReviews.updatedAt,
          resolvedAt: clientReviews.resolvedAt,
          clientName: users.name,
        })
        .from(clientReviews)
        .leftJoin(users, eq(clientReviews.clientId, users.id))
        .where(eq(clientReviews.deliverableId, deliv.id))
        .orderBy(desc(clientReviews.createdAt));

      // Revisions
      const revisionsList = await db
        .select({
          id: revisionRequests.id,
          deliverableId: revisionRequests.deliverableId,
          clientId: revisionRequests.clientId,
          description: revisionRequests.description,
          status: revisionRequests.status,
          createdAt: revisionRequests.createdAt,
          resolvedAt: revisionRequests.resolvedAt,
          resolvedBy: revisionRequests.resolvedBy,
          clientName: users.name,
        })
        .from(revisionRequests)
        .leftJoin(users, eq(revisionRequests.clientId, users.id))
        .where(eq(revisionRequests.deliverableId, deliv.id))
        .orderBy(desc(revisionRequests.createdAt));

      // Milestone
      const [mStone] = await db
        .select({
          id: projectMilestones.id,
          title: projectMilestones.title,
          status: projectMilestones.status,
        })
        .from(milestoneDeliverables)
        .innerJoin(projectMilestones, eq(milestoneDeliverables.milestoneId, projectMilestones.id))
        .where(eq(milestoneDeliverables.deliverableId, deliv.id))
        .limit(1);

      return reply.status(200).send({
        success: true,
        data: {
          ...deliv,
          createdAt: deliv.createdAt.toISOString(),
          updatedAt: deliv.updatedAt.toISOString(),
          deliveredAt: deliv.deliveredAt ? deliv.deliveredAt.toISOString() : null,
          approvedAt: deliv.approvedAt ? deliv.approvedAt.toISOString() : null,
          creatorName: creator?.name || 'Unknown',
          approverName: approver?.name || null,
          linkedWorkItems: linkedWis,
          attachments: linkedAtts,
          reviews: reviewsList.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })),
          revisions: revisionsList.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
          milestone: mStone || null,
        },
      });
    } catch (err: any) {
      console.error('Error fetching deliverable details:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * PATCH /api/deliverables/:deliverableId
   * Edit deliverable title/description/links
   */
  app.patch('/deliverables/:deliverableId', async (request: AuthenticatedRequest, reply) => {
    try {
      const { deliverableId } = request.params as { deliverableId: string };
      const user = request.user!;
      const db = getDb();

      const parseResult = updateDeliverableSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(422).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid update payload', details: parseResult.error.format() },
        });
      }

      const [deliv] = await db.select().from(deliverables).where(eq(deliverables.id, deliverableId)).limit(1);
      if (!deliv) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Deliverable not found' } });
      }

      const [project] = await db.select().from(projects).where(eq(projects.id, deliv.projectId)).limit(1);
      const policy = await enforcePolicy(user.id, project.organizationId, 'deliverable:edit', project.id);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const { title, description, workItemIds, attachmentIds, milestoneId } = parseResult.data;

      const [updated] = await db
        .update(deliverables)
        .set({
          title: title ?? deliv.title,
          description: description !== undefined ? description : deliv.description,
          updatedAt: new Date(),
        })
        .where(eq(deliverables.id, deliverableId))
        .returning();

      if (workItemIds) {
        await db.delete(deliverableWorkItems).where(eq(deliverableWorkItems.deliverableId, deliverableId));
        for (const wiId of workItemIds) {
          await db.insert(deliverableWorkItems).values({ deliverableId, workItemId: wiId });
        }
      }

      if (attachmentIds) {
        await db.delete(deliverableAttachments).where(eq(deliverableAttachments.deliverableId, deliverableId));
        for (const attId of attachmentIds) {
          await db.insert(deliverableAttachments).values({ deliverableId, attachmentId: attId });
        }
      }

      if (milestoneId !== undefined) {
        await db.delete(milestoneDeliverables).where(eq(milestoneDeliverables.deliverableId, deliverableId));
        if (milestoneId) {
          await db.insert(milestoneDeliverables).values({ milestoneId, deliverableId });
        }
      }

      return reply.status(200).send({
        success: true,
        data: updated,
      });
    } catch (err: any) {
      console.error('Error updating deliverable:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * POST /api/deliverables/:deliverableId/submit-review
   * Submit deliverable for client review
   */
  app.post('/deliverables/:deliverableId/submit-review', async (request: AuthenticatedRequest, reply) => {
    try {
      const { deliverableId } = request.params as { deliverableId: string };
      const user = request.user!;
      const db = getDb();

      const [deliv] = await db.select().from(deliverables).where(eq(deliverables.id, deliverableId)).limit(1);
      if (!deliv) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Deliverable not found' } });
      }

      const [project] = await db.select().from(projects).where(eq(projects.id, deliv.projectId)).limit(1);
      const policy = await enforcePolicy(user.id, project.organizationId, 'deliverable:submit_review', project.id);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const now = new Date();
      const [updated] = await db
        .update(deliverables)
        .set({
          status: 'ready_for_review',
          deliveredAt: now,
          updatedAt: now,
        })
        .where(eq(deliverables.id, deliverableId))
        .returning();

      // Record Activity
      await activityService.recordActivity({
        projectId: project.id,
        actorId: user.id,
        type: 'deliverable_submitted',
        entityType: 'deliverable',
        entityId: deliverableId,
        metadata: { title: updated.title },
      });

      // Notification to client
      await notificationService.notifyOnDeliverableSubmitted({
        projectId: project.id,
        deliverableId,
        title: updated.title,
        submittedById: user.id,
      });

      return reply.status(200).send({
        success: true,
        data: updated,
      });
    } catch (err: any) {
      console.error('Error submitting deliverable for review:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * POST /api/deliverables/:deliverableId/approve
   * Client approves deliverable
   */
  app.post('/deliverables/:deliverableId/approve', async (request: AuthenticatedRequest, reply) => {
    try {
      const { deliverableId } = request.params as { deliverableId: string };
      const user = request.user!;
      const db = getDb();

      const [deliv] = await db.select().from(deliverables).where(eq(deliverables.id, deliverableId)).limit(1);
      if (!deliv) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Deliverable not found' } });
      }

      const [project] = await db.select().from(projects).where(eq(projects.id, deliv.projectId)).limit(1);

      // ENFORCE EXACT CLIENT APPROVAL POLICY RULE
      const policy = await enforcePolicy(user.id, project.organizationId, 'deliverable:approve', project.id);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const now = new Date();
      const [updated] = await db
        .update(deliverables)
        .set({
          status: 'approved',
          approvedAt: now,
          approvedBy: user.id,
          updatedAt: now,
        })
        .where(eq(deliverables.id, deliverableId))
        .returning();

      // Create client_reviews entry
      await db.insert(clientReviews).values({
        deliverableId,
        clientId: user.id,
        status: 'approved',
        comment: (request.body as any)?.comment || 'Approved deliverable',
      });

      // Record Activity
      await activityService.recordActivity({
        projectId: project.id,
        actorId: user.id,
        type: 'deliverable_approved',
        entityType: 'deliverable',
        entityId: deliverableId,
        metadata: { title: updated.title },
      });

      // Notify developers
      await notificationService.notifyOnDeliverableApproved({
        projectId: project.id,
        deliverableId,
        title: updated.title,
        approvedById: user.id,
      });

      return reply.status(200).send({
        success: true,
        data: updated,
      });
    } catch (err: any) {
      console.error('Error approving deliverable:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * POST /api/deliverables/:deliverableId/request-changes
   * Client requests changes on deliverable
   */
  app.post('/deliverables/:deliverableId/request-changes', async (request: AuthenticatedRequest, reply) => {
    try {
      const { deliverableId } = request.params as { deliverableId: string };
      const user = request.user!;
      const db = getDb();

      const parseResult = requestChangesSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(422).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Comment is required when requesting changes', details: parseResult.error.format() },
        });
      }

      const [deliv] = await db.select().from(deliverables).where(eq(deliverables.id, deliverableId)).limit(1);
      if (!deliv) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Deliverable not found' } });
      }

      const [project] = await db.select().from(projects).where(eq(projects.id, deliv.projectId)).limit(1);

      // ENFORCE EXACT CLIENT REQUEST CHANGES POLICY RULE
      const policy = await enforcePolicy(user.id, project.organizationId, 'deliverable:request_changes', project.id);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const { comment, description } = parseResult.data;
      const changeDesc = comment || description || '';

      const now = new Date();
      const [updated] = await db
        .update(deliverables)
        .set({
          status: 'changes_requested',
          updatedAt: now,
        })
        .where(eq(deliverables.id, deliverableId))
        .returning();

      // Create client_reviews entry
      await db.insert(clientReviews).values({
        deliverableId,
        clientId: user.id,
        status: 'changes_requested',
        comment: changeDesc,
      });

      // Create revision_requests entry
      const [revisionReq] = await db
        .insert(revisionRequests)
        .values({
          deliverableId,
          clientId: user.id,
          description: changeDesc,
          status: 'open',
        })
        .returning();

      // Record Activity
      await activityService.recordActivity({
        projectId: project.id,
        actorId: user.id,
        type: 'deliverable_changes_requested',
        entityType: 'deliverable',
        entityId: deliverableId,
        metadata: { title: updated.title, comment: changeDesc },
      });

      // Notify developers
      await notificationService.notifyOnDeliverableChangesRequested({
        projectId: project.id,
        deliverableId,
        title: updated.title,
        requestedById: user.id,
        comment: changeDesc,
      });

      return reply.status(200).send({
        success: true,
        data: {
          deliverable: updated,
          revisionRequest: revisionReq,
        },
      });
    } catch (err: any) {
      console.error('Error requesting changes on deliverable:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * GET /api/deliverables/:deliverableId/reviews
   * Get review history
   */
  app.get('/deliverables/:deliverableId/reviews', async (request: AuthenticatedRequest, reply) => {
    try {
      const { deliverableId } = request.params as { deliverableId: string };
      const user = request.user!;
      const db = getDb();

      const [deliv] = await db.select().from(deliverables).where(eq(deliverables.id, deliverableId)).limit(1);
      if (!deliv) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Deliverable not found' } });
      }

      const [project] = await db.select().from(projects).where(eq(projects.id, deliv.projectId)).limit(1);
      const policy = await enforcePolicy(user.id, project.organizationId, 'review:view', project.id);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const reviewsList = await db
        .select({
          id: clientReviews.id,
          deliverableId: clientReviews.deliverableId,
          clientId: clientReviews.clientId,
          status: clientReviews.status,
          comment: clientReviews.comment,
          createdAt: clientReviews.createdAt,
          clientName: users.name,
        })
        .from(clientReviews)
        .leftJoin(users, eq(clientReviews.clientId, users.id))
        .where(eq(clientReviews.deliverableId, deliverableId))
        .orderBy(desc(clientReviews.createdAt));

      return reply.status(200).send({
        success: true,
        data: reviewsList,
      });
    } catch (err: any) {
      console.error('Error fetching reviews:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * GET /api/deliverables/:deliverableId/revisions
   * Get revision requests for a deliverable
   */
  app.get('/deliverables/:deliverableId/revisions', async (request: AuthenticatedRequest, reply) => {
    try {
      const { deliverableId } = request.params as { deliverableId: string };
      const user = request.user!;
      const db = getDb();

      const [deliv] = await db.select().from(deliverables).where(eq(deliverables.id, deliverableId)).limit(1);
      if (!deliv) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Deliverable not found' } });
      }

      const [project] = await db.select().from(projects).where(eq(projects.id, deliv.projectId)).limit(1);
      const policy = await enforcePolicy(user.id, project.organizationId, 'revision:view', project.id);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const revisionsList = await db
        .select({
          id: revisionRequests.id,
          deliverableId: revisionRequests.deliverableId,
          clientId: revisionRequests.clientId,
          description: revisionRequests.description,
          status: revisionRequests.status,
          createdAt: revisionRequests.createdAt,
          resolvedAt: revisionRequests.resolvedAt,
          resolvedBy: revisionRequests.resolvedBy,
          clientName: users.name,
        })
        .from(revisionRequests)
        .leftJoin(users, eq(revisionRequests.clientId, users.id))
        .where(eq(revisionRequests.deliverableId, deliverableId))
        .orderBy(desc(revisionRequests.createdAt));

      return reply.status(200).send({
        success: true,
        data: revisionsList,
      });
    } catch (err: any) {
      console.error('Error fetching revisions:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * PATCH /api/revisions/:revisionId/status
   * Developer updates revision request status (in_progress, resolved)
   */
  app.patch('/revisions/:revisionId/status', async (request: AuthenticatedRequest, reply) => {
    try {
      const { revisionId } = request.params as { revisionId: string };
      const user = request.user!;
      const db = getDb();

      const parseResult = updateRevisionStatusSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(422).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid revision status payload', details: parseResult.error.format() },
        });
      }

      const [rev] = await db.select().from(revisionRequests).where(eq(revisionRequests.id, revisionId)).limit(1);
      if (!rev) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Revision request not found' } });
      }

      const [deliv] = await db.select().from(deliverables).where(eq(deliverables.id, rev.deliverableId)).limit(1);
      const [project] = await db.select().from(projects).where(eq(projects.id, deliv.projectId)).limit(1);

      const policy = await enforcePolicy(user.id, project.organizationId, 'revision:manage', project.id);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const { status } = parseResult.data;
      const isResolved = status === 'resolved';

      const [updatedRev] = await db
        .update(revisionRequests)
        .set({
          status,
          resolvedAt: isResolved ? new Date() : null,
          resolvedBy: isResolved ? user.id : null,
        })
        .where(eq(revisionRequests.id, revisionId))
        .returning();

      // Record Activity
      await activityService.recordActivity({
        projectId: project.id,
        actorId: user.id,
        type: isResolved ? 'revision_resolved' : 'revision_started',
        entityType: 'revision_request',
        entityId: revisionId,
        metadata: { deliverableTitle: deliv.title, status },
      });

      // Notification
      await notificationService.notifyOnRevisionStatusChanged({
        projectId: project.id,
        deliverableId: deliv.id,
        revisionId,
        newStatus: status,
        updatedById: user.id,
      });

      return reply.status(200).send({
        success: true,
        data: updatedRev,
      });
    } catch (err: any) {
      console.error('Error updating revision status:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });
}
