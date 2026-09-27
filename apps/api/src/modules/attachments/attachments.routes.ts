import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import path from 'node:path';
import fs from 'node:fs';
import { getDb } from '../../config/database.js';
import { attachments, messages, conversations, projects } from '../../db/schema/index.js';
import { authenticateRequest, AuthenticatedRequest } from '../../lib/auth.js';
import { enforcePolicy } from '../../lib/permissions.js';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export async function attachmentRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticateRequest);

  // POST /api/attachments/upload — Upload a file attachment
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

    // Generate storage key
    const fileExt = path.extname(data.filename) || '';
    const fileKey = `${crypto.randomUUID()}${fileExt}`;
    const filePath = path.join(UPLOAD_DIR, fileKey);
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    // Write file stream to disk
    await new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(filePath);
      data.file.pipe(writeStream);
      writeStream.on('finish', () => resolve(true));
      writeStream.on('error', (err) => reject(err));
    });

    const stats = fs.statSync(filePath);

    const rawMsgId = (data.fields.messageId as any)?.value;
    const messageId = rawMsgId && String(rawMsgId).trim() !== '' ? String(rawMsgId) : null;

    // Create attachment record (messageId can be linked when message is sent, or placeholder)
    const [newAttachment] = await db
      .insert(attachments)
      .values({
        messageId,
        fileName: data.filename,
        mimeType: data.mimetype,
        size: stats.size,
        storageKey: fileKey,
      })
      .returning();

    return reply.status(201).send({
      success: true,
      data: newAttachment,
    });
  });

  // GET /api/attachments/:attachmentId/download — Secure download attachment file
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

    // Resolve project via message -> conversation -> project
    if (att.messageId) {
      const [msg] = await db.select().from(messages).where(eq(messages.id, att.messageId)).limit(1);
      if (msg) {
        const [conv] = await db.select().from(conversations).where(eq(conversations.id, msg.conversationId)).limit(1);
        if (conv) {
          const [project] = await db.select().from(projects).where(eq(projects.id, conv.projectId)).limit(1);
          if (project) {
            const policy = await enforcePolicy(user.id, project.organizationId, 'attachment:view', project.id);
            if (!policy.allowed) {
              return reply.status(403).send({
                success: false,
                error: { code: 'FORBIDDEN', message: policy.reason },
              });
            }
          }
        }
      }
    }

    const filePath = path.join(UPLOAD_DIR, att.storageKey);
    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({
        success: false,
        error: { code: 'FILE_NOT_FOUND', message: 'Storage file not found' },
      });
    }

    const stream = fs.createReadStream(filePath);
    reply.header('Content-Type', att.mimeType);
    reply.header('Content-Disposition', `inline; filename="${att.fileName}"`);
    return reply.send(stream);
  });
}
