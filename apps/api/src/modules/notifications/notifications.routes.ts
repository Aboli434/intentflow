import { FastifyInstance } from 'fastify';
import { authenticateRequest, AuthenticatedRequest } from '../../lib/auth.js';
import { enforcePolicy } from '../../lib/permissions.js';
import { NotificationService } from '../../services/notifications/notification.service.js';
import { ActivityService } from '../../services/activity/activity.service.js';
import { getDb } from '../../config/database.js';
import { projects } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';

const notificationService = new NotificationService();
const activityService = new ActivityService();

export async function notificationRoutes(app: FastifyInstance) {
  // All HTTP API endpoints require authentication
  app.addHook('preHandler', authenticateRequest);

  /**
   * GET /api/notifications
   * Get authenticated user's notifications (supports pagination & unread filter)
   */
  app.get('/notifications', async (request: AuthenticatedRequest, reply) => {
    try {
      const user = request.user!;
      const { limit, unreadOnly } = request.query as { limit?: string; unreadOnly?: string };

      const parsedLimit = limit ? Math.min(Math.max(parseInt(limit, 10), 1), 100) : 30;
      const isUnreadOnly = unreadOnly === 'true' || unreadOnly === '1';

      const data = await notificationService.getUserNotifications(user.id, {
        limit: parsedLimit,
        unreadOnly: isUnreadOnly,
      });

      return reply.status(200).send({
        success: true,
        data,
      });
    } catch (err: any) {
      console.error('Error fetching notifications:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * GET /api/notifications/unread-count
   * Get unread notification count for authenticated user
   */
  app.get('/notifications/unread-count', async (request: AuthenticatedRequest, reply) => {
    try {
      const user = request.user!;
      const count = await notificationService.getUnreadCount(user.id);

      return reply.status(200).send({
        success: true,
        data: { count },
      });
    } catch (err: any) {
      console.error('Error fetching unread count:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * POST /api/notifications/:notificationId/read
   * PATCH /api/notifications/:notificationId/read
   * Mark a single notification as read (enforces ownership)
   */
  const markReadHandler = async (request: AuthenticatedRequest, reply: any) => {
    try {
      const { notificationId } = request.params as { notificationId: string };
      const user = request.user!;

      const updated = await notificationService.markAsRead(notificationId, user.id);
      return reply.status(200).send({
        success: true,
        data: updated,
      });
    } catch (err: any) {
      if (err.message?.includes('not found') || err.message?.includes('access denied')) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: err.message } });
      }
      console.error('Error marking notification read:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  };

  app.post('/notifications/:notificationId/read', markReadHandler);
  app.patch('/notifications/:notificationId/read', markReadHandler);

  /**
   * POST /api/notifications/read-all
   * Mark all notifications for authenticated user as read
   */
  app.post('/notifications/read-all', async (request: AuthenticatedRequest, reply) => {
    try {
      const user = request.user!;
      const result = await notificationService.markAllAsRead(user.id);

      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (err: any) {
      console.error('Error marking all notifications read:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * GET /api/projects/:projectId/activity
   * Get project activity timeline (respects client/developer role filtering)
   */
  app.get('/projects/:projectId/activity', async (request: AuthenticatedRequest, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const { limit } = request.query as { limit?: string };
      const user = request.user!;
      const db = getDb();

      const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
      if (!project) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
      }

      const policy = await enforcePolicy(user.id, project.organizationId, 'activity:view', projectId);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const parsedLimit = limit ? Math.min(Math.max(parseInt(limit, 10), 1), 100) : 50;
      const userRole = policy.ctx.projectRole || policy.ctx.orgRole || 'developer';

      const activity = await activityService.getProjectActivity(projectId, userRole, parsedLimit);
      return reply.status(200).send({
        success: true,
        data: activity,
      });
    } catch (err: any) {
      console.error('Error fetching project activity:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });
}
