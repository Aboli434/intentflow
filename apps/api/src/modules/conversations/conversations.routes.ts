import { FastifyInstance } from 'fastify';
import { eq, and, desc, asc, lt, inArray } from 'drizzle-orm';
import {
  createConversationSchema,
  sendMessageSchema,
  addParticipantSchema,
} from '@intentflow/validation';
import { getDb } from '../../config/database.js';
import {
  conversations,
  conversationParticipants,
  messages,
  attachments,
  projects,
  users,
} from '../../db/schema/index.js';
import { authenticateRequest, AuthenticatedRequest } from '../../lib/auth.js';
import { enforcePolicy } from '../../lib/permissions.js';
import {
  addConnection,
  removeConnection,
  broadcastToConversation,
  authenticateWsConnection,
} from './websocket.js';

export async function conversationRoutes(app: FastifyInstance) {
  // WebSocket endpoint for real-time conversation updates
  app.get('/conversations/:conversationId/ws', { websocket: true }, async (socket, req) => {
    const params = req.params as { conversationId: string };
    const query = req.query as { token?: string };
    const token = query.token;

    if (!token) {
      socket.close(4001, 'Unauthorized: Missing session token');
      return;
    }

    const auth = await authenticateWsConnection(token, params.conversationId);
    if (!auth) {
      socket.close(4003, 'Forbidden: Invalid session or insufficient project access');
      return;
    }

    addConnection(params.conversationId, socket);

    socket.on('close', () => {
      removeConnection(params.conversationId, socket);
    });

    socket.on('error', () => {
      removeConnection(params.conversationId, socket);
    });
  });

  // All HTTP API endpoints require authentication
  app.addHook('preHandler', authenticateRequest);

  // POST /api/projects/:projectId/conversations — Create conversation
  app.post('/projects/:projectId/conversations', async (request: AuthenticatedRequest, reply) => {
    const { projectId } = request.params as { projectId: string };
    const user = request.user!;

    const parseResult = createConversationSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(422).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid conversation payload',
          details: parseResult.error.format(),
        },
      });
    }

    const { title, participantUserIds } = parseResult.data;
    const db = getDb();

    // Verify project exists
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      });
    }

    // Policy check: conversation:create
    const policy = await enforcePolicy(user.id, project.organizationId, 'conversation:create', projectId);
    if (!policy.allowed) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: policy.reason },
      });
    }

    // Create conversation
    const now = new Date();
    const [newConv] = await db
      .insert(conversations)
      .values({
        projectId,
        title,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Add creator as participant
    const participantsToAdd = new Set<string>([user.id]);
    if (participantUserIds && participantUserIds.length > 0) {
      participantUserIds.forEach((id) => participantsToAdd.add(id));
    }

    for (const userId of participantsToAdd) {
      await db.insert(conversationParticipants).values({
        conversationId: newConv.id,
        userId,
        lastReadAt: userId === user.id ? new Date() : null,
      });
    }

    // Return created conversation with participants
    const allParticipants = await db
      .select({
        id: conversationParticipants.id,
        userId: conversationParticipants.userId,
        joinedAt: conversationParticipants.joinedAt,
        lastReadAt: conversationParticipants.lastReadAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(conversationParticipants)
      .innerJoin(users, eq(conversationParticipants.userId, users.id))
      .where(eq(conversationParticipants.conversationId, newConv.id));

    return reply.status(201).send({
      success: true,
      data: {
        ...newConv,
        participants: allParticipants,
      },
    });
  });

  // GET /api/projects/:projectId/conversations — List project conversations
  app.get('/projects/:projectId/conversations', async (request: AuthenticatedRequest, reply) => {
    const { projectId } = request.params as { projectId: string };
    const user = request.user!;
    const db = getDb();

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      });
    }

    const policy = await enforcePolicy(user.id, project.organizationId, 'conversation:view', projectId);
    if (!policy.allowed) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: policy.reason },
      });
    }

    const convList = await db
      .select()
      .from(conversations)
      .where(eq(conversations.projectId, projectId))
      .orderBy(desc(conversations.updatedAt));

    const result = [];
    for (const conv of convList) {
      // Get participant count
      const partList = await db
        .select()
        .from(conversationParticipants)
        .where(eq(conversationParticipants.conversationId, conv.id));

      const userPart = partList.find((p) => p.userId === user.id);

      // Get last message
      const [lastMsg] = await db
        .select({
          id: messages.id,
          body: messages.body,
          senderId: messages.senderId,
          createdAt: messages.createdAt,
          senderName: users.name,
        })
        .from(messages)
        .leftJoin(users, eq(messages.senderId, users.id))
        .where(eq(messages.conversationId, conv.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);


      const isUnread = lastMsg
        ? userPart?.lastReadAt
          ? new Date(lastMsg.createdAt).getTime() > new Date(userPart.lastReadAt).getTime()
          : true
        : false;



      result.push({
        ...conv,
        participantCount: partList.length,
        lastMessage: lastMsg || null,
        unread: isUnread,
      });
    }

    return reply.status(200).send({
      success: true,
      data: result,
    });
  });

  // GET /api/conversations/:conversationId — Get conversation details
  app.get('/conversations/:conversationId', async (request: AuthenticatedRequest, reply) => {
    const { conversationId } = request.params as { conversationId: string };
    const user = request.user!;
    const db = getDb();

    const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    if (!conv) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
    }

    const [project] = await db.select().from(projects).where(eq(projects.id, conv.projectId)).limit(1);
    if (!project) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Associated project not found' },
      });
    }

    const policy = await enforcePolicy(user.id, project.organizationId, 'conversation:view', project.id);
    if (!policy.allowed) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: policy.reason },
      });
    }

    const allParticipants = await db
      .select({
        id: conversationParticipants.id,
        userId: conversationParticipants.userId,
        joinedAt: conversationParticipants.joinedAt,
        lastReadAt: conversationParticipants.lastReadAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(conversationParticipants)
      .innerJoin(users, eq(conversationParticipants.userId, users.id))
      .where(eq(conversationParticipants.conversationId, conv.id));

    return reply.status(200).send({
      success: true,
      data: {
        ...conv,
        participants: allParticipants,
      },
    });
  });

  // POST /api/conversations/:conversationId/participants — Add participant
  app.post('/conversations/:conversationId/participants', async (request: AuthenticatedRequest, reply) => {
    const { conversationId } = request.params as { conversationId: string };
    const user = request.user!;

    const parseResult = addParticipantSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(422).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid participant payload',
          details: parseResult.error.format(),
        },
      });
    }

    const { userId: targetUserId } = parseResult.data;
    const db = getDb();

    const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    if (!conv) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
    }

    const [project] = await db.select().from(projects).where(eq(projects.id, conv.projectId)).limit(1);
    const policy = await enforcePolicy(user.id, project.organizationId, 'conversation:manage_participants', project.id);
    if (!policy.allowed) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: policy.reason },
      });
    }

    // Verify target user is project member or org admin
    const targetPolicy = await enforcePolicy(targetUserId, project.organizationId, 'conversation:view', project.id);
    if (!targetPolicy.allowed) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_PARTICIPANT', message: 'Target user does not have access to this project' },
      });
    }

    // Check duplicate
    const [existing] = await db
      .select()
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, targetUserId)
        )
      )
      .limit(1);

    if (existing) {
      return reply.status(409).send({
        success: false,
        error: { code: 'CONFLICT', message: 'User is already a participant in this conversation' },
      });
    }

    const [newPart] = await db
      .insert(conversationParticipants)
      .values({
        conversationId,
        userId: targetUserId,
      })
      .returning();

    const [addedUser] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);

    broadcastToConversation(conversationId, {
      type: 'conversation.participant.joined',
      conversationId,
      participant: {
        id: newPart.id,
        conversationId,
        userId: targetUserId,
        joinedAt: newPart.joinedAt.toISOString(),
      },
    });

    return reply.status(201).send({
      success: true,
      data: {
        ...newPart,
        userName: addedUser?.name,
        userEmail: addedUser?.email,
      },
    });
  });

  // DELETE /api/conversations/:conversationId/participants/:userId — Remove participant
  app.delete('/conversations/:conversationId/participants/:userId', async (request: AuthenticatedRequest, reply) => {
    const { conversationId, userId: targetUserId } = request.params as { conversationId: string; userId: string };
    const user = request.user!;
    const db = getDb();

    const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    if (!conv) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
    }

    const [project] = await db.select().from(projects).where(eq(projects.id, conv.projectId)).limit(1);
    const policy = await enforcePolicy(user.id, project.organizationId, 'conversation:manage_participants', project.id);
    if (!policy.allowed) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: policy.reason },
      });
    }

    await db
      .delete(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, targetUserId)
        )
      );

    broadcastToConversation(conversationId, {
      type: 'conversation.participant.left',
      conversationId,
      userId: targetUserId,
    });

    return reply.status(200).send({
      success: true,
      message: 'Participant removed successfully',
    });
  });

  // GET /api/conversations/:conversationId/messages — List messages (paginated)
  app.get('/conversations/:conversationId/messages', async (request: AuthenticatedRequest, reply) => {
    const { conversationId } = request.params as { conversationId: string };
    const query = request.query as { limit?: string; cursor?: string };
    const user = request.user!;
    const db = getDb();

    const limit = Math.min(Math.max(parseInt(query.limit || '30', 10), 1), 100);

    const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    if (!conv) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
    }

    const [project] = await db.select().from(projects).where(eq(projects.id, conv.projectId)).limit(1);
    const policy = await enforcePolicy(user.id, project.organizationId, 'message:view', project.id);
    if (!policy.allowed) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: policy.reason },
      });
    }

    let queryConditions = [eq(messages.conversationId, conversationId)];
    if (query.cursor) {
      queryConditions.push(lt(messages.createdAt, new Date(query.cursor)));
    }

    const fetchedMessages = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        senderId: messages.senderId,
        body: messages.body,
        type: messages.type,
        createdAt: messages.createdAt,
        updatedAt: messages.updatedAt,
        senderName: users.name,
        senderEmail: users.email,
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(and(...queryConditions))
      .orderBy(desc(messages.createdAt))
      .limit(limit + 1);

    const hasMore = fetchedMessages.length > limit;
    const items = hasMore ? fetchedMessages.slice(0, limit) : fetchedMessages;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].createdAt.toISOString() : undefined;

    // Attachments for fetched messages
    const messageIds = items.map((m) => m.id);
    let messageAttachmentsMap = new Map<string, any[]>();
    if (messageIds.length > 0) {
      const attList = await db.select().from(attachments).where(inArray(attachments.messageId, messageIds));
      attList.forEach((att) => {
        if (att.messageId) {
          if (!messageAttachmentsMap.has(att.messageId)) {
            messageAttachmentsMap.set(att.messageId, []);
          }
          messageAttachmentsMap.get(att.messageId)!.push(att);
        }
      });
    }

    const data = items.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      attachments: messageAttachmentsMap.get(m.id) || [],
    })).reverse(); // Return in chronological ascending order for linear conversation timeline

    return reply.status(200).send({
      success: true,
      data,
      nextCursor,
    });
  });

  // POST /api/conversations/:conversationId/messages — Send message
  app.post('/conversations/:conversationId/messages', async (request: AuthenticatedRequest, reply) => {
    const { conversationId } = request.params as { conversationId: string };
    const user = request.user!;

    const parseResult = sendMessageSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(422).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid message payload',
          details: parseResult.error.format(),
        },
      });
    }

    const { body, attachmentIds } = parseResult.data;
    const db = getDb();

    const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    if (!conv) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
    }

    const [project] = await db.select().from(projects).where(eq(projects.id, conv.projectId)).limit(1);
    const policy = await enforcePolicy(user.id, project.organizationId, 'message:send', project.id);
    if (!policy.allowed) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: policy.reason },
      });
    }

    // Persist message
    const now = new Date();
    const [newMsg] = await db
      .insert(messages)
      .values({
        conversationId,
        senderId: user.id,
        body,
        type: 'text',
        createdAt: now,
      })
      .returning();

    // Link attachments if provided
    if (attachmentIds && attachmentIds.length > 0) {
      await db
        .update(attachments)
        .set({ messageId: newMsg.id })
        .where(inArray(attachments.id, attachmentIds));
    }

    // Update conversation updatedAt
    await db.update(conversations).set({ updatedAt: now }).where(eq(conversations.id, conversationId));

    // Update or create sender participant record with latest read timestamp
    const [existingPart] = await db
      .select()
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, user.id)
        )
      )
      .limit(1);

    if (existingPart) {
      await db
        .update(conversationParticipants)
        .set({ lastReadAt: now })
        .where(eq(conversationParticipants.id, existingPart.id));
    } else {
      await db.insert(conversationParticipants).values({
        conversationId,
        userId: user.id,
        lastReadAt: now,
      });
    }

    // Fetch full message with sender name and attachments
    const [sender] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    const msgAttachments = await db
      .select()
      .from(attachments)
      .where(eq(attachments.messageId, newMsg.id));

    const formattedMessage = {
      ...newMsg,
      createdAt: newMsg.createdAt.toISOString(),
      updatedAt: newMsg.updatedAt.toISOString(),
      senderName: sender?.name || 'User',
      senderEmail: sender?.email || '',
      attachments: msgAttachments,
    };

    // Emit real-time event
    broadcastToConversation(conversationId, {
      type: 'conversation.message.created',
      conversationId,
      message: formattedMessage as any,
    });

    // Phase 6 Project Activity & Notification integration
    try {
      const { ActivityService } = await import('../../services/activity/activity.service.js');
      const { NotificationService } = await import('../../services/notifications/notification.service.js');
      const activityService = new ActivityService();
      const notificationService = new NotificationService();

      await activityService.recordActivity({
        projectId: conv.projectId,
        actorId: user.id,
        type: 'message_sent',
        entityType: 'message',
        entityId: newMsg.id,
        metadata: { conversationId, body: body.substring(0, 80) },
      });

      await notificationService.notifyOnMessageSent({
        projectId: conv.projectId,
        conversationId,
        senderId: user.id,
        body,
      });
    } catch (err) {
      console.warn('[ConversationRoutes] Failed to dispatch message activity/notification:', err);
    }

    return reply.status(201).send({
      success: true,
      data: formattedMessage,
    });
  });

  // POST /api/conversations/:conversationId/read — Mark conversation as read
  app.post('/conversations/:conversationId/read', async (request: AuthenticatedRequest, reply) => {
    const { conversationId } = request.params as { conversationId: string };
    const user = request.user!;
    const db = getDb();

    const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    if (!conv) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
    }

    const [project] = await db.select().from(projects).where(eq(projects.id, conv.projectId)).limit(1);
    const policy = await enforcePolicy(user.id, project.organizationId, 'conversation:view', project.id);
    if (!policy.allowed) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: policy.reason },
      });
    }

    const now = new Date(Date.now() + 5000); // Ensure future offset to cover DB clock jitter
    const [existingPart] = await db
      .select()
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, user.id)
        )
      )
      .limit(1);

    if (existingPart) {
      await db
        .update(conversationParticipants)
        .set({ lastReadAt: now })
        .where(eq(conversationParticipants.id, existingPart.id));
    } else {
      await db.insert(conversationParticipants).values({
        conversationId,
        userId: user.id,
        lastReadAt: now,
      });
    }

    return reply.status(200).send({
      success: true,
      message: 'Conversation marked as read',
    });
  });
}
