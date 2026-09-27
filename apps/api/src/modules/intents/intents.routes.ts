import { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { getDb } from '../../config/database.js';
import {
  intents,
  intentRequirements,
  intentQuestions,
  intentVersions,
  conversations,
} from '../../db/schema/index.js';
import { authenticateRequest, AuthenticatedRequest } from '../../lib/auth.js';
import { enforcePolicy } from '../../lib/permissions.js';
import { IntentAnalysisService } from '../../services/ai/intent-analysis.service.js';
import {
  updateIntentSchema,
  confirmIntentSchema,
  rejectIntentSchema,
  createClarificationSchema,
} from '@intentflow/validation';
import { broadcastToConversation } from '../conversations/websocket.js';

const analysisService = new IntentAnalysisService();

/**
 * Helper to fetch conversation and project context for permission checks
 */
async function getConversationProject(conversationId: string) {
  const db = getDb();
  const list = await db
    .select({
      conversationId: conversations.id,
      projectId: conversations.projectId,
    })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  return list[0] || null;
}

/**
 * Helper to fetch intent and project context for permission checks
 */
async function getIntentProject(intentId: string) {
  const db = getDb();
  const list = await db
    .select({
      intentId: intents.id,
      projectId: intents.projectId,
      conversationId: intents.conversationId,
      status: intents.status,
      title: intents.title,
      summary: intents.summary,
    })
    .from(intents)
    .where(eq(intents.id, intentId))
    .limit(1);

  return list[0] || null;
}

export async function intentRoutes(app: FastifyInstance) {
  // All HTTP API endpoints require authentication
  app.addHook('preHandler', authenticateRequest);

  /**
   * POST /api/conversations/:conversationId/intents/analyze
   * Trigger AI intent analysis for a conversation
   */
  app.post('/conversations/:conversationId/intents/analyze', async (request: AuthenticatedRequest, reply) => {
    try {
      const { conversationId } = request.params as { conversationId: string };
      const user = request.user!;

      const conv = await getConversationProject(conversationId);
      if (!conv) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } });
      }

      const orgId = (request.headers['x-organization-id'] as string) || '';
      const policy = await enforcePolicy(user.id, orgId, 'intent:analyze', conv.projectId);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const result = await analysisService.analyzeConversation(conversationId, user.id);
      const fullIntent = await analysisService.getIntentWithDetails(result.intentId);

      return reply.status(200).send({
        success: true,
        data: fullIntent,
      });
    } catch (err: any) {
      console.error('Error analyzing intent:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * GET /api/conversations/:conversationId/intents
   * Get intents for a conversation
   */
  app.get('/conversations/:conversationId/intents', async (request: AuthenticatedRequest, reply) => {
    try {
      const { conversationId } = request.params as { conversationId: string };
      const user = request.user!;

      const conv = await getConversationProject(conversationId);
      if (!conv) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } });
      }

      const orgId = (request.headers['x-organization-id'] as string) || '';
      const policy = await enforcePolicy(user.id, orgId, 'intent:view', conv.projectId);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const db = getDb();
      const intentList = await db
        .select({ id: intents.id })
        .from(intents)
        .where(eq(intents.conversationId, conversationId))
        .orderBy(desc(intents.createdAt));

      const detailedIntents = await Promise.all(
        intentList.map((i) => analysisService.getIntentWithDetails(i.id))
      );

      return reply.status(200).send({
        success: true,
        data: detailedIntents,
      });
    } catch (err: any) {
      console.error('Error fetching intents:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * GET /api/intents/:intentId
   * Get details for a single intent
   */
  app.get('/intents/:intentId', async (request: AuthenticatedRequest, reply) => {
    try {
      const { intentId } = request.params as { intentId: string };
      const user = request.user!;

      const intentProj = await getIntentProject(intentId);
      if (!intentProj) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Intent not found' } });
      }

      const orgId = (request.headers['x-organization-id'] as string) || '';
      const policy = await enforcePolicy(user.id, orgId, 'intent:view', intentProj.projectId);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const details = await analysisService.getIntentWithDetails(intentId);
      return reply.status(200).send({ success: true, data: details });
    } catch (err: any) {
      console.error('Error fetching intent details:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * PATCH /api/intents/:intentId
   * Edit title, summary, requirements, or questions for an intent
   */
  app.patch('/intents/:intentId', async (request: AuthenticatedRequest, reply) => {
    try {
      const { intentId } = request.params as { intentId: string };
      const user = request.user!;

      const intentProj = await getIntentProject(intentId);
      if (!intentProj) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Intent not found' } });
      }

      const orgId = (request.headers['x-organization-id'] as string) || '';
      const policy = await enforcePolicy(user.id, orgId, 'intent:edit', intentProj.projectId);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const parseResult = updateIntentSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(422).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parseResult.error.format() },
        });
      }

      const { title, summary, requirements, questions } = parseResult.data;
      const db = getDb();

      // Update main intent title/summary & set modifiedByHuman = true
      await db
        .update(intents)
        .set({
          title: title !== undefined ? title : intentProj.title,
          summary: summary !== undefined ? summary : intentProj.summary,
          modifiedByHuman: true,
          updatedAt: new Date(),
        })
        .where(eq(intents.id, intentId));

      // Update requirements if provided
      if (requirements) {
        await db.delete(intentRequirements).where(eq(intentRequirements.intentId, intentId));
        if (requirements.length > 0) {
          await db.insert(intentRequirements).values(
            requirements.map((r, idx) => ({
              intentId,
              text: r.text,
              confidence: r.confidence ?? 1.0,
              position: r.position ?? idx + 1,
            }))
          );
        }
      }

      // Update questions if provided
      if (questions) {
        await db.delete(intentQuestions).where(eq(intentQuestions.intentId, intentId));
        if (questions.length > 0) {
          await db.insert(intentQuestions).values(
            questions.map((q) => ({
              intentId,
              question: q.question,
              status: q.status || 'open',
            }))
          );
        }
      }

      // Fetch updated details & save new version snapshot
      const updatedDetails = await analysisService.getIntentWithDetails(intentId);

      const existingVersions = await db
        .select()
        .from(intentVersions)
        .where(eq(intentVersions.intentId, intentId));

      await db.insert(intentVersions).values({
        intentId,
        version: existingVersions.length + 1,
        source: 'human',
        snapshot: updatedDetails,
        createdBy: user.id,
      });

      // Real-time broadcast to conversation WS clients
      broadcastToConversation(intentProj.conversationId, {
        type: 'intent.updated',
        conversationId: intentProj.conversationId,
        intent: updatedDetails,
      });

      return reply.status(200).send({ success: true, data: updatedDetails });
    } catch (err: any) {
      console.error('Error updating intent:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * POST /api/intents/:intentId/confirm
   * Human developer confirms intent
   */
  app.post('/intents/:intentId/confirm', async (request: AuthenticatedRequest, reply) => {
    try {
      const { intentId } = request.params as { intentId: string };
      const user = request.user!;

      const intentProj = await getIntentProject(intentId);
      if (!intentProj) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Intent not found' } });
      }

      const orgId = (request.headers['x-organization-id'] as string) || '';
      const policy = await enforcePolicy(user.id, orgId, 'intent:confirm', intentProj.projectId);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      confirmIntentSchema.parse(request.body || {});

      const db = getDb();
      await db
        .update(intents)
        .set({
          status: 'confirmed',
          reviewedBy: user.id,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(intents.id, intentId));

      const confirmedDetails = await analysisService.getIntentWithDetails(intentId);

      // Save final confirmed version snapshot
      const existingVersions = await db
        .select()
        .from(intentVersions)
        .where(eq(intentVersions.intentId, intentId));

      await db.insert(intentVersions).values({
        intentId,
        version: existingVersions.length + 1,
        source: 'human',
        snapshot: confirmedDetails,
        createdBy: user.id,
      });

      broadcastToConversation(intentProj.conversationId, {
        type: 'intent.confirmed',
        conversationId: intentProj.conversationId,
        intent: confirmedDetails,
      });

      // Phase 6 Activity & Notification integration
      try {
        const { ActivityService } = await import('../../services/activity/activity.service.js');
        const { NotificationService } = await import('../../services/notifications/notification.service.js');
        const activityService = new ActivityService();
        const notificationService = new NotificationService();

        await activityService.recordActivity({
          projectId: intentProj.projectId,
          actorId: user.id,
          type: 'intent_confirmed',
          entityType: 'intent',
          entityId: intentId,
          metadata: { title: confirmedDetails.title },
        });

        await notificationService.notifyOnIntentConfirmed({
          projectId: intentProj.projectId,
          intentId,
          intentTitle: confirmedDetails.title,
        });
      } catch (err) {
        console.warn('[IntentRoutes] Failed to dispatch intent confirm activity/notification:', err);
      }

      return reply.status(200).send({ success: true, data: confirmedDetails });
    } catch (err: any) {
      console.error('Error confirming intent:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * POST /api/intents/:intentId/reject
   * Human developer rejects intent
   */
  app.post('/intents/:intentId/reject', async (request: AuthenticatedRequest, reply) => {
    try {
      const { intentId } = request.params as { intentId: string };
      const user = request.user!;

      const intentProj = await getIntentProject(intentId);
      if (!intentProj) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Intent not found' } });
      }

      const orgId = (request.headers['x-organization-id'] as string) || '';
      const policy = await enforcePolicy(user.id, orgId, 'intent:reject', intentProj.projectId);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const parseResult = rejectIntentSchema.safeParse(request.body || {});
      const reason = parseResult.success ? parseResult.data.reason : undefined;

      const db = getDb();
      await db
        .update(intents)
        .set({
          status: 'rejected',
          rejectionReason: reason || 'Rejected by developer review',
          reviewedBy: user.id,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(intents.id, intentId));

      const rejectedDetails = await analysisService.getIntentWithDetails(intentId);

      broadcastToConversation(intentProj.conversationId, {
        type: 'intent.rejected',
        conversationId: intentProj.conversationId,
        intentId,
        reason: reason || 'Rejected by developer review',
      });

      return reply.status(200).send({ success: true, data: rejectedDetails });
    } catch (err: any) {
      console.error('Error rejecting intent:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * POST /api/intents/:intentId/questions/:questionId/dismiss
   * Dismiss missing information question
   */
  app.post('/intents/:intentId/questions/:questionId/dismiss', async (request: AuthenticatedRequest, reply) => {
    try {
      const { intentId, questionId } = request.params as { intentId: string; questionId: string };
      const user = request.user!;

      const intentProj = await getIntentProject(intentId);
      if (!intentProj) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Intent not found' } });
      }

      const orgId = (request.headers['x-organization-id'] as string) || '';
      const policy = await enforcePolicy(user.id, orgId, 'intent:edit', intentProj.projectId);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const db = getDb();
      await db
        .update(intentQuestions)
        .set({ status: 'dismissed', resolvedAt: new Date() })
        .where(eq(intentQuestions.id, questionId));

      const updatedDetails = await analysisService.getIntentWithDetails(intentId);

      return reply.status(200).send({ success: true, data: updatedDetails });
    } catch (err: any) {
      console.error('Error dismissing question:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * POST /api/intents/:intentId/clarification
   * Helper flow for drafting a clarification question to send to client
   */
  app.post('/intents/:intentId/clarification', async (request: AuthenticatedRequest, reply) => {
    try {
      const { intentId } = request.params as { intentId: string };
      const user = request.user!;

      const intentProj = await getIntentProject(intentId);
      if (!intentProj) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Intent not found' } });
      }

      const orgId = (request.headers['x-organization-id'] as string) || '';
      const policy = await enforcePolicy(user.id, orgId, 'intent:request_clarification', intentProj.projectId);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const parseResult = createClarificationSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(422).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parseResult.error.format() },
        });
      }

      const { questionId, questionText, customMessage } = parseResult.data;
      const db = getDb();

      // Draft message for developer review (does NOT send automatically to client without user click)
      const draftText = customMessage || `Hi! Could you please clarify: ${questionText}?`;

      if (questionId) {
        await db
          .update(intentQuestions)
          .set({ status: 'resolved', resolvedAt: new Date() })
          .where(eq(intentQuestions.id, questionId));
      }

      // Set intent status to needs_clarification
      await db
        .update(intents)
        .set({ status: 'needs_clarification', updatedAt: new Date() })
        .where(eq(intents.id, intentId));

      const updatedDetails = await analysisService.getIntentWithDetails(intentId);

      // Phase 6 Activity & Notification integration
      try {
        const { ActivityService } = await import('../../services/activity/activity.service.js');
        const { NotificationService } = await import('../../services/notifications/notification.service.js');
        const activityService = new ActivityService();
        const notificationService = new NotificationService();

        await activityService.recordActivity({
          projectId: intentProj.projectId,
          actorId: user.id,
          type: 'clarification_requested',
          entityType: 'intent',
          entityId: intentId,
          metadata: { questionText },
        });

        await notificationService.notifyOnClarificationRequested({
          projectId: intentProj.projectId,
          intentId,
          questionText,
        });
      } catch (err) {
        console.warn('[IntentRoutes] Failed to dispatch clarification activity/notification:', err);
      }

      return reply.status(200).send({
        success: true,
        data: {
          draftMessage: draftText,
          intent: updatedDetails,
        },
      });
    } catch (err: any) {
      console.error('Error creating clarification draft:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });
}
