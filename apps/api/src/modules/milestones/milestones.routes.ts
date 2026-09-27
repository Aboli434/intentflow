import { FastifyInstance } from 'fastify';
import { eq, and, asc, inArray } from 'drizzle-orm';
import {
  createMilestoneSchema,
  updateMilestoneSchema,
} from '@intentflow/validation';
import { getDb } from '../../config/database.js';
import {
  projectMilestones,
  milestoneDeliverables,
  deliverables,
  projects,
  users,
} from '../../db/schema/index.js';
import { authenticateRequest, AuthenticatedRequest } from '../../lib/auth.js';
import { enforcePolicy } from '../../lib/permissions.js';
import { NotificationService } from '../../services/notifications/notification.service.js';
import { ActivityService } from '../../services/activity/activity.service.js';

const notificationService = new NotificationService();
const activityService = new ActivityService();

export async function milestoneRoutes(app: FastifyInstance) {
  // All HTTP API endpoints require authentication
  app.addHook('preHandler', authenticateRequest);

  /**
   * POST /api/projects/:projectId/milestones
   * Create a milestone
   */
  app.post('/projects/:projectId/milestones', async (request: AuthenticatedRequest, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const user = request.user!;
      const db = getDb();

      const parseResult = createMilestoneSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(422).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid milestone payload', details: parseResult.error.format() },
        });
      }

      const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
      if (!project) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
      }

      const policy = await enforcePolicy(user.id, project.organizationId, 'milestone:create', projectId);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const { title, description, position, dueDate } = parseResult.data;

      const [newMilestone] = await db
        .insert(projectMilestones)
        .values({
          projectId,
          title,
          description: description || null,
          position: position ?? 0,
          dueDate: dueDate ? new Date(dueDate) : null,
          createdBy: user.id,
        })
        .returning();

      // Record Activity
      await activityService.recordActivity({
        projectId,
        actorId: user.id,
        type: 'milestone_created',
        entityType: 'milestone',
        entityId: newMilestone.id,
        metadata: { title: newMilestone.title },
      });

      return reply.status(201).send({
        success: true,
        data: newMilestone,
      });
    } catch (err: any) {
      console.error('Error creating milestone:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * GET /api/projects/:projectId/milestones
   * List milestones for a project
   */
  app.get('/projects/:projectId/milestones', async (request: AuthenticatedRequest, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const user = request.user!;
      const db = getDb();

      const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
      if (!project) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
      }

      const policy = await enforcePolicy(user.id, project.organizationId, 'milestone:view', projectId);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const milestonesList = await db
        .select()
        .from(projectMilestones)
        .where(eq(projectMilestones.projectId, projectId))
        .orderBy(asc(projectMilestones.position), asc(projectMilestones.createdAt));

      const result = [];
      for (const m of milestonesList) {
        // Linked deliverables
        const linkedDelivs = await db
          .select({
            id: deliverables.id,
            title: deliverables.title,
            status: deliverables.status,
            deliveredAt: deliverables.deliveredAt,
            approvedAt: deliverables.approvedAt,
          })
          .from(milestoneDeliverables)
          .innerJoin(deliverables, eq(milestoneDeliverables.deliverableId, deliverables.id))
          .where(eq(milestoneDeliverables.milestoneId, m.id));

        result.push({
          ...m,
          createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt.toISOString(),
          dueDate: m.dueDate ? m.dueDate.toISOString() : null,
          completedAt: m.completedAt ? m.completedAt.toISOString() : null,
          deliverables: linkedDelivs,
        });
      }

      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (err: any) {
      console.error('Error listing milestones:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * GET /api/milestones/:milestoneId
   * Fetch milestone details
   */
  app.get('/milestones/:milestoneId', async (request: AuthenticatedRequest, reply) => {
    try {
      const { milestoneId } = request.params as { milestoneId: string };
      const user = request.user!;
      const db = getDb();

      const [m] = await db.select().from(projectMilestones).where(eq(projectMilestones.id, milestoneId)).limit(1);
      if (!m) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Milestone not found' } });
      }

      const [project] = await db.select().from(projects).where(eq(projects.id, m.projectId)).limit(1);
      const policy = await enforcePolicy(user.id, project.organizationId, 'milestone:view', project.id);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const linkedDelivs = await db
        .select({
          id: deliverables.id,
          title: deliverables.title,
          status: deliverables.status,
          deliveredAt: deliverables.deliveredAt,
          approvedAt: deliverables.approvedAt,
        })
        .from(milestoneDeliverables)
        .innerJoin(deliverables, eq(milestoneDeliverables.deliverableId, deliverables.id))
        .where(eq(milestoneDeliverables.milestoneId, m.id));

      return reply.status(200).send({
        success: true,
        data: {
          ...m,
          createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt.toISOString(),
          dueDate: m.dueDate ? m.dueDate.toISOString() : null,
          completedAt: m.completedAt ? m.completedAt.toISOString() : null,
          deliverables: linkedDelivs,
        },
      });
    } catch (err: any) {
      console.error('Error fetching milestone:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * PATCH /api/milestones/:milestoneId
   * Update milestone details
   */
  app.patch('/milestones/:milestoneId', async (request: AuthenticatedRequest, reply) => {
    try {
      const { milestoneId } = request.params as { milestoneId: string };
      const user = request.user!;
      const db = getDb();

      const parseResult = updateMilestoneSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(422).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid update payload', details: parseResult.error.format() },
        });
      }

      const [m] = await db.select().from(projectMilestones).where(eq(projectMilestones.id, milestoneId)).limit(1);
      if (!m) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Milestone not found' } });
      }

      const [project] = await db.select().from(projects).where(eq(projects.id, m.projectId)).limit(1);
      const policy = await enforcePolicy(user.id, project.organizationId, 'milestone:edit', project.id);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const { title, description, position, dueDate, status } = parseResult.data;
      const isCompleting = status === 'completed' && m.status !== 'completed';

      const [updated] = await db
        .update(projectMilestones)
        .set({
          title: title ?? m.title,
          description: description !== undefined ? description : m.description,
          position: position !== undefined ? position : m.position,
          dueDate: dueDate ? new Date(dueDate) : m.dueDate,
          status: status ?? m.status,
          completedAt: isCompleting ? new Date() : (status && status !== 'completed' ? null : m.completedAt),
          updatedAt: new Date(),
        })
        .where(eq(projectMilestones.id, milestoneId))
        .returning();

      if (isCompleting) {
        await activityService.recordActivity({
          projectId: project.id,
          actorId: user.id,
          type: 'milestone_completed',
          entityType: 'milestone',
          entityId: milestoneId,
          metadata: { title: updated.title },
        });

        await notificationService.notifyOnMilestoneCompleted({
          projectId: project.id,
          milestoneId,
          title: updated.title,
          completedById: user.id,
        });
      }

      return reply.status(200).send({
        success: true,
        data: updated,
      });
    } catch (err: any) {
      console.error('Error updating milestone:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * POST /api/milestones/:milestoneId/status
   * Update milestone execution status
   */
  app.post('/milestones/:milestoneId/status', async (request: AuthenticatedRequest, reply) => {
    try {
      const { milestoneId } = request.params as { milestoneId: string };
      const { status } = request.body as { status: string };
      const user = request.user!;
      const db = getDb();

      const [m] = await db.select().from(projectMilestones).where(eq(projectMilestones.id, milestoneId)).limit(1);
      if (!m) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Milestone not found' } });
      }

      const [project] = await db.select().from(projects).where(eq(projects.id, m.projectId)).limit(1);
      const policy = await enforcePolicy(user.id, project.organizationId, 'milestone:edit', project.id);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const isCompleting = status === 'completed' && m.status !== 'completed';
      const [updated] = await db
        .update(projectMilestones)
        .set({
          status,
          completedAt: isCompleting ? new Date() : (status !== 'completed' ? null : m.completedAt),
          updatedAt: new Date(),
        })
        .where(eq(projectMilestones.id, milestoneId))
        .returning();

      if (isCompleting) {
        await activityService.recordActivity({
          projectId: project.id,
          actorId: user.id,
          type: 'milestone_completed',
          entityType: 'milestone',
          entityId: milestoneId,
          metadata: { title: updated.title },
        });

        await notificationService.notifyOnMilestoneCompleted({
          projectId: project.id,
          milestoneId,
          title: updated.title,
          completedById: user.id,
        });
      }

      return reply.status(200).send({
        success: true,
        data: updated,
      });
    } catch (err: any) {
      console.error('Error updating milestone status:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * POST /api/milestones/:milestoneId/deliverables
   * Link deliverable to milestone
   */
  app.post('/milestones/:milestoneId/deliverables', async (request: AuthenticatedRequest, reply) => {
    try {
      const { milestoneId } = request.params as { milestoneId: string };
      const { deliverableId } = request.body as { deliverableId: string };
      const user = request.user!;
      const db = getDb();

      const [m] = await db.select().from(projectMilestones).where(eq(projectMilestones.id, milestoneId)).limit(1);
      if (!m) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Milestone not found' } });
      }

      const [project] = await db.select().from(projects).where(eq(projects.id, m.projectId)).limit(1);
      const policy = await enforcePolicy(user.id, project.organizationId, 'milestone:edit', project.id);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      await db.insert(milestoneDeliverables).values({
        milestoneId,
        deliverableId,
      });

      return reply.status(201).send({
        success: true,
        message: 'Deliverable linked to milestone successfully',
      });
    } catch (err: any) {
      console.error('Error linking deliverable to milestone:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * DELETE /api/milestones/:milestoneId/deliverables/:deliverableId
   * Unlink deliverable from milestone
   */
  app.delete('/milestones/:milestoneId/deliverables/:deliverableId', async (request: AuthenticatedRequest, reply) => {
    try {
      const { milestoneId, deliverableId } = request.params as { milestoneId: string; deliverableId: string };
      const user = request.user!;
      const db = getDb();

      const [m] = await db.select().from(projectMilestones).where(eq(projectMilestones.id, milestoneId)).limit(1);
      if (!m) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Milestone not found' } });
      }

      const [project] = await db.select().from(projects).where(eq(projects.id, m.projectId)).limit(1);
      const policy = await enforcePolicy(user.id, project.organizationId, 'milestone:edit', project.id);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      await db
        .delete(milestoneDeliverables)
        .where(
          and(
            eq(milestoneDeliverables.milestoneId, milestoneId),
            eq(milestoneDeliverables.deliverableId, deliverableId)
          )
        );

      return reply.status(200).send({
        success: true,
        message: 'Deliverable unlinked from milestone successfully',
      });
    } catch (err: any) {
      console.error('Error unlinking deliverable from milestone:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });
}
