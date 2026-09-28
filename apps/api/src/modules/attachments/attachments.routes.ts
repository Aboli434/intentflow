import { FastifyInstance } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import path from 'node:path';
import { getDb } from '../../config/database.js';
import { attachments, messages, conversations, projects, users } from '../../db/schema/index.js';
import { authenticateRequest, AuthenticatedRequest } from '../../lib/auth.js';
import { enforcePolicy } from '../../lib/permissions.js';
import { StorageService, validateFile, sanitizeFileName } from '../../services/storage/storage.service.js';

const storageService = new StorageService();

export async function attachmentRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticateRequest);

  // POST /api/attachments/upload — Upload a file attachment with project authorization & storage abstraction
  app.post('/upload', async (request: AuthenticatedRequest, reply) => {
    const user = request.user!;

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({
        success: false,
        error: { code: 'NO_FILE', message: 'No file uploaded' },
      });
    }

    const projectId = (data.fields.projectId as any)?.value;
    if (!projectId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_PROJECT_ID', message: 'projectId is required in form fields' },
      });
    }

    const db = getDb();
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      });
    }

    // Policy check: attachment:upload
    const policy = await enforcePolicy(user.id, project.organizationId, 'attachment:upload', projectId);
    if (!policy.allowed) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: policy.reason },
      });
    }

    // Buffer file & validate
    const buffer = await data.toBuffer();
    const cleanFileName = sanitizeFileName(data.filename);
    const fileVal = validateFile(cleanFileName, data.mimetype, buffer.length);
    if (!fileVal.valid) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_FILE', message: fileVal.reason || 'File validation failed' },
      });
    }

    // Generate safe storage key
    const fileExt = path.extname(cleanFileName) || '';
    const fileKey = `${crypto.randomUUID()}${fileExt}`;

    try {
      await storageService.getProvider().saveFile(fileKey, buffer);
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: 'STORAGE_ERROR', message: 'Failed to write file to storage provider' },
      });
    }

    const rawMsgId = (data.fields.messageId as any)?.value;
    const messageId = rawMsgId && String(rawMsgId).trim() !== '' ? String(rawMsgId) : null;
    const relatedEntityType = (data.fields.relatedEntityType as any)?.value || (messageId ? 'conversation' : undefined);
    const relatedEntityId = (data.fields.relatedEntityId as any)?.value || messageId || undefined;

    // Create attachment record
    const [newAttachment] = await db
      .insert(attachments)
      .values({
        projectId,
        uploadedBy: user.id,
        messageId,
        relatedEntityType,
        relatedEntityId,
        fileName: cleanFileName,
        mimeType: data.mimetype,
        size: buffer.length,
        storageKey: fileKey,
      })
      .returning();

    return reply.status(201).send({
      success: true,
      data: newAttachment,
    });
  });

  // GET /api/attachments/:attachmentId/download — Secure download attachment with strict tenant isolation
  app.get('/:attachmentId/download', async (request: AuthenticatedRequest, reply) => {
    const { attachmentId } = request.params as { attachmentId: string };
    const user = request.user!;
    const db = getDb();

    const [att] = await db.select().from(attachments).where(eq(attachments.id, attachmentId)).limit(1);
    if (!att) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Attachment not found' },
      });
    }

    let targetProjectId = att.projectId;
    if (!targetProjectId && att.messageId) {
      const [msg] = await db.select().from(messages).where(eq(messages.id, att.messageId)).limit(1);
      if (msg) {
        const [conv] = await db.select().from(conversations).where(eq(conversations.id, msg.conversationId)).limit(1);
        if (conv) targetProjectId = conv.projectId;
      }
    }

    if (targetProjectId) {
      const [project] = await db.select().from(projects).where(eq(projects.id, targetProjectId)).limit(1);
      if (!project) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
      }

      const policy = await enforcePolicy(user.id, project.organizationId, 'attachment:view', project.id);
      if (!policy.allowed) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: policy.reason },
        });
      }
    }

    try {
      const stream = await storageService.getProvider().getFileStream(att.storageKey);
      reply.header('Content-Type', att.mimeType);
      reply.header('Content-Disposition', `inline; filename="${att.fileName}"`);
      return reply.send(stream);
    } catch (err) {
      return reply.status(404).send({
        success: false,
        error: { code: 'FILE_NOT_FOUND', message: 'Storage file not found' },
      });
    }
  });

  // DELETE /api/attachments/:attachmentId — Delete attachment
  app.delete('/:attachmentId', async (request: AuthenticatedRequest, reply) => {
    const { attachmentId } = request.params as { attachmentId: string };
    const user = request.user!;
    const db = getDb();

    const [att] = await db.select().from(attachments).where(eq(attachments.id, attachmentId)).limit(1);
    if (!att) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Attachment not found' },
      });
    }

    let targetProjectId = att.projectId;
    if (!targetProjectId && att.messageId) {
      const [msg] = await db.select().from(messages).where(eq(messages.id, att.messageId)).limit(1);
      if (msg) {
        const [conv] = await db.select().from(conversations).where(eq(conversations.id, msg.conversationId)).limit(1);
        if (conv) targetProjectId = conv.projectId;
      }
    }

    if (targetProjectId) {
      const [project] = await db.select().from(projects).where(eq(projects.id, targetProjectId)).limit(1);
      if (project) {
        const policy = await enforcePolicy(user.id, project.organizationId, 'attachment:upload', project.id);
        if (!policy.allowed) {
          return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: policy.reason },
          });
        }
      }
    }

    await storageService.getProvider().deleteFile(att.storageKey);
    await db.delete(attachments).where(eq(attachments.id, attachmentId));

    return reply.send({ success: true, message: 'Attachment deleted successfully' });
  });

  // GET /api/projects/:projectId/attachments — List project attachments
  app.get('/projects/:projectId/attachments', async (request: AuthenticatedRequest, reply) => {
    const { projectId } = request.params as { projectId: string };
    const user = request.user!;
    const db = getDb();

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
    }

    const policy = await enforcePolicy(user.id, project.organizationId, 'attachment:view', projectId);
    if (!policy.allowed) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
    }

    const projectFiles = await db
      .select({
        attachment: attachments,
        uploader: users,
      })
      .from(attachments)
      .leftJoin(users, eq(attachments.uploadedBy, users.id))
      .where(eq(attachments.projectId, projectId))
      .orderBy(desc(attachments.createdAt));

    const result = projectFiles.map((f) => ({
      id: f.attachment.id,
      fileName: f.attachment.fileName,
      mimeType: f.attachment.mimeType,
      size: f.attachment.size,
      relatedEntityType: f.attachment.relatedEntityType || undefined,
      relatedEntityId: f.attachment.relatedEntityId || undefined,
      createdAt: f.attachment.createdAt.toISOString(),
      uploaderName: f.uploader?.name,
    }));

    return reply.send({ success: true, data: result });
  });
}
