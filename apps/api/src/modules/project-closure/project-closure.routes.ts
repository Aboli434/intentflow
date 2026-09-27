import { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { getDb } from '../../config/database.js';
import {
  projects,
  projectClosures,
  projectHandoffs,
  projectCompletionChecklist,
  closureRevisionRequests,
} from '../../db/schema/index.js';
import { authenticateRequest, AuthenticatedRequest } from '../../lib/auth.js';
import { enforcePolicy } from '../../lib/permissions.js';
import {
  checkProjectCompletionEligibility,
  ensureProjectChecklist,
} from '../../services/project/project-completion.service.js';
import {
  createProjectClosure,
  submitProjectClosure,
  approveProjectClosure,
  requestClosureChanges,
  generateProjectHandoff,
  acknowledgeProjectHandoff,
  fetchClosureById,
  fetchHandoffById,
  fetchClosureRevisionById,
} from '../../services/project/project-closure.service.js';
import {
  createClosureSchema,
  updateClosureSchema,
  requestClosureChangesSchema,
  updateChecklistSchema,
  updateClosureRevisionStatusSchema,
} from '@intentflow/validation';
import { broadcastToProject } from '../conversations/websocket.js';

export async function projectClosureRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticateRequest);

  // Helper to resolve orgId from projectId
  const getProjectIdOrg = async (projectId: string) => {
    const db = getDb();
    const [proj] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!proj) return null;
    return proj.organizationId;
  };

  // Helper to resolve projectId & orgId from closureId
  const getClosureProjectOrg = async (closureId: string) => {
    const db = getDb();
    const [closure] = await db
      .select({ c: projectClosures, p: projects })
      .from(projectClosures)
      .innerJoin(projects, eq(projectClosures.projectId, projects.id))
      .where(eq(projectClosures.id, closureId))
      .limit(1);
    if (!closure) return null;
    return { projectId: closure.c.projectId, organizationId: closure.p.organizationId };
  };

  // Helper to resolve projectId & orgId from handoffId
  const getHandoffProjectOrg = async (handoffId: string) => {
    const db = getDb();
    const [h] = await db
      .select({ handoff: projectHandoffs, p: projects })
      .from(projectHandoffs)
      .innerJoin(projects, eq(projectHandoffs.projectId, projects.id))
      .where(eq(projectHandoffs.id, handoffId))
      .limit(1);
    if (!h) return null;
    return { projectId: h.handoff.projectId, organizationId: h.p.organizationId };
  };

  // 1. GET /api/projects/:projectId/completion-status
  app.get('/projects/:projectId/completion-status', async (request: AuthenticatedRequest, reply) => {
    const user = request.user!;
    const { projectId } = request.params as { projectId: string };
    const orgId = await getProjectIdOrg(projectId);
    if (!orgId) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });

    const auth = await enforcePolicy(user.id, orgId, 'project:completion_view', projectId);
    if (!auth.allowed) return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: auth.reason } });

    const eligibility = await checkProjectCompletionEligibility(projectId);
    return reply.send({ success: true, data: eligibility });
  });

  // 2. GET /api/projects/:projectId/completion-checklist
  app.get('/projects/:projectId/completion-checklist', async (request: AuthenticatedRequest, reply) => {
    const user = request.user!;
    const { projectId } = request.params as { projectId: string };
    const orgId = await getProjectIdOrg(projectId);
    if (!orgId) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });

    const auth = await enforcePolicy(user.id, orgId, 'project:completion_view', projectId);
    if (!auth.allowed) return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: auth.reason } });

    const checklist = await ensureProjectChecklist(projectId, user.id);
    return reply.send({ success: true, data: checklist });
  });

  // 3. POST /api/projects/:projectId/completion-checklist
  app.post('/projects/:projectId/completion-checklist', async (request: AuthenticatedRequest, reply) => {
    const user = request.user!;
    const { projectId } = request.params as { projectId: string };
    const orgId = await getProjectIdOrg(projectId);
    if (!orgId) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });

    const auth = await enforcePolicy(user.id, orgId, 'project:completion_manage', projectId);
    if (!auth.allowed) return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: auth.reason } });

    const parsed = updateChecklistSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } });
    }

    const db = getDb();
    const now = new Date();
    await db
      .insert(projectCompletionChecklist)
      .values({
        projectId,
        key: parsed.data.key,
        label: parsed.data.label,
        status: parsed.data.status,
        required: parsed.data.required,
        completedBy: parsed.data.status === 'completed' ? user.id : null,
        completedAt: parsed.data.status === 'completed' ? now : null,
      });

    const checklist = await ensureProjectChecklist(projectId);
    return reply.status(201).send({ success: true, data: checklist });
  });

  // 4. PATCH /api/completion-checklist/:checklistId
  app.patch('/completion-checklist/:checklistId', async (request: AuthenticatedRequest, reply) => {
    const user = request.user!;
    const { checklistId } = request.params as { checklistId: string };
    const db = getDb();

    const [item] = await db.select().from(projectCompletionChecklist).where(eq(projectCompletionChecklist.id, checklistId)).limit(1);
    if (!item) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Checklist item not found' } });

    const orgId = await getProjectIdOrg(item.projectId);
    if (!orgId) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });

    const auth = await enforcePolicy(user.id, orgId, 'project:completion_manage', item.projectId);
    if (!auth.allowed) return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: auth.reason } });

    const { status } = request.body as { status: 'pending' | 'completed' | 'blocked' };
    const now = new Date();

    await db
      .update(projectCompletionChecklist)
      .set({
        status,
        completedBy: status === 'completed' ? user.id : null,
        completedAt: status === 'completed' ? now : null,
        updatedAt: now,
      })
      .where(eq(projectCompletionChecklist.id, checklistId));

    const checklist = await ensureProjectChecklist(item.projectId);
    return reply.send({ success: true, data: checklist });
  });

  // 5. POST /api/projects/:projectId/closure
  app.post('/projects/:projectId/closure', async (request: AuthenticatedRequest, reply) => {
    const user = request.user!;
    const { projectId } = request.params as { projectId: string };
    const orgId = await getProjectIdOrg(projectId);
    if (!orgId) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });

    const auth = await enforcePolicy(user.id, orgId, 'project:closure_create', projectId);
    if (!auth.allowed) return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: auth.reason } });

    const parsed = createClosureSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } });
    }

    const closure = await createProjectClosure(projectId, user.id, parsed.data);
    return reply.status(201).send({ success: true, data: closure });
  });

  // 6. GET /api/projects/:projectId/closures
  app.get('/projects/:projectId/closures', async (request: AuthenticatedRequest, reply) => {
    const user = request.user!;
    const { projectId } = request.params as { projectId: string };
    const orgId = await getProjectIdOrg(projectId);
    if (!orgId) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });

    const auth = await enforcePolicy(user.id, orgId, 'project:closure_view', projectId);
    if (!auth.allowed) return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: auth.reason } });

    const db = getDb();
    const list = await db
      .select()
      .from(projectClosures)
      .where(eq(projectClosures.projectId, projectId))
      .orderBy(desc(projectClosures.createdAt));

    const closures = await Promise.all(list.map((c) => fetchClosureById(c.id)));
    return reply.send({ success: true, data: closures });
  });

  // 7. GET /api/project-closures/:closureId
  app.get('/project-closures/:closureId', async (request: AuthenticatedRequest, reply) => {
    const user = request.user!;
    const { closureId } = request.params as { closureId: string };
    const target = await getClosureProjectOrg(closureId);
    if (!target) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Closure request not found' } });

    const auth = await enforcePolicy(user.id, target.organizationId, 'project:closure_view', target.projectId);
    if (!auth.allowed) return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: auth.reason } });

    const closure = await fetchClosureById(closureId);
    return reply.send({ success: true, data: closure });
  });

  // 8. PATCH /api/project-closures/:closureId
  app.patch('/project-closures/:closureId', async (request: AuthenticatedRequest, reply) => {
    const user = request.user!;
    const { closureId } = request.params as { closureId: string };
    const target = await getClosureProjectOrg(closureId);
    if (!target) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Closure request not found' } });

    const auth = await enforcePolicy(user.id, target.organizationId, 'project:closure_create', target.projectId);
    if (!auth.allowed) return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: auth.reason } });

    const parsed = updateClosureSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } });
    }

    const db = getDb();
    await db
      .update(projectClosures)
      .set({
        summary: parsed.data.summary,
        completionNotes: parsed.data.completionNotes,
        updatedAt: new Date(),
      })
      .where(eq(projectClosures.id, closureId));

    const closure = await fetchClosureById(closureId);
    return reply.send({ success: true, data: closure });
  });

  // 9. POST /api/project-closures/:closureId/submit
  app.post('/project-closures/:closureId/submit', async (request: AuthenticatedRequest, reply) => {
    const user = request.user!;
    const { closureId } = request.params as { closureId: string };
    const target = await getClosureProjectOrg(closureId);
    if (!target) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Closure request not found' } });

    const auth = await enforcePolicy(user.id, target.organizationId, 'project:closure_submit', target.projectId);
    if (!auth.allowed) return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: auth.reason } });

    const body = (request.body || {}) as { notes?: string };

    try {
      const closure = await submitProjectClosure(closureId, user.id, body.notes);
      return reply.send({ success: true, data: closure });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_STATE', message: err.message } });
    }
  });

  // 10. POST /api/project-closures/:closureId/approve (CLIENT ONLY)
  app.post('/project-closures/:closureId/approve', async (request: AuthenticatedRequest, reply) => {
    const user = request.user!;
    const { closureId } = request.params as { closureId: string };
    const target = await getClosureProjectOrg(closureId);
    if (!target) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Closure request not found' } });

    const auth = await enforcePolicy(user.id, target.organizationId, 'project:closure_approve', target.projectId);
    if (!auth.allowed) return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: auth.reason } });

    const body = (request.body || {}) as { comment?: string };

    try {
      const result = await approveProjectClosure(closureId, user.id, body.comment);
      return reply.send({ success: true, data: result });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_STATE', message: err.message } });
    }
  });

  // 11. POST /api/project-closures/:closureId/request-changes (CLIENT ONLY)
  app.post('/project-closures/:closureId/request-changes', async (request: AuthenticatedRequest, reply) => {
    const user = request.user!;
    const { closureId } = request.params as { closureId: string };
    const target = await getClosureProjectOrg(closureId);
    if (!target) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Closure request not found' } });

    const auth = await enforcePolicy(user.id, target.organizationId, 'project:closure_request_changes', target.projectId);
    if (!auth.allowed) return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: auth.reason } });

    const parsed = requestClosureChangesSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } });
    }

    try {
      const result = await requestClosureChanges(closureId, user.id, parsed.data);
      return reply.send({ success: true, data: result });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_STATE', message: err.message } });
    }
  });

  // 12. GET /api/project-closures/:closureId/revisions
  app.get('/project-closures/:closureId/revisions', async (request: AuthenticatedRequest, reply) => {
    const user = request.user!;
    const { closureId } = request.params as { closureId: string };
    const target = await getClosureProjectOrg(closureId);
    if (!target) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Closure request not found' } });

    const auth = await enforcePolicy(user.id, target.organizationId, 'project:closure_view', target.projectId);
    if (!auth.allowed) return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: auth.reason } });

    const closure = await fetchClosureById(closureId);
    return reply.send({ success: true, data: closure.revisions || [] });
  });

  // 13. PATCH /api/closure-revisions/:revisionId/status
  app.patch('/closure-revisions/:revisionId/status', async (request: AuthenticatedRequest, reply) => {
    const user = request.user!;
    const { revisionId } = request.params as { revisionId: string };
    const db = getDb();

    const [rev] = await db.select().from(closureRevisionRequests).where(eq(closureRevisionRequests.id, revisionId)).limit(1);
    if (!rev) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Revision request not found' } });

    const target = await getClosureProjectOrg(rev.closureId);
    if (!target) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Closure request not found' } });

    const auth = await enforcePolicy(user.id, target.organizationId, 'project:closure_revision_manage', target.projectId);
    if (!auth.allowed) return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: auth.reason } });

    const parsed = updateClosureRevisionStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } });
    }

    const now = new Date();
    await db
      .update(closureRevisionRequests)
      .set({
        status: parsed.data.status,
        resolvedBy: parsed.data.status === 'resolved' ? user.id : undefined,
        resolvedAt: parsed.data.status === 'resolved' ? now : undefined,
      })
      .where(eq(closureRevisionRequests.id, revisionId));

    const updated = await fetchClosureRevisionById(revisionId);

    broadcastToProject(target.projectId, {
      type: 'closure.revision_updated',
      projectId: target.projectId,
      revisionRequest: updated,
    });

    return reply.send({ success: true, data: updated });
  });

  // 14. GET /api/projects/:projectId/handoff
  app.get('/projects/:projectId/handoff', async (request: AuthenticatedRequest, reply) => {
    const user = request.user!;
    const { projectId } = request.params as { projectId: string };
    const orgId = await getProjectIdOrg(projectId);
    if (!orgId) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });

    const auth = await enforcePolicy(user.id, orgId, 'project:handoff_view', projectId);
    if (!auth.allowed) return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: auth.reason } });

    const db = getDb();
    const [h] = await db.select().from(projectHandoffs).where(eq(projectHandoffs.projectId, projectId)).orderBy(desc(projectHandoffs.createdAt)).limit(1);

    if (!h) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Handoff record not found' } });

    const handoff = await fetchHandoffById(h.id);

    // Sanitization: If user is client, sanitize sensitive fields
    if (auth.ctx.projectRole === 'client' && auth.ctx.orgRole !== 'admin') {
      handoff.items = handoff.items?.map((item) => ({
        ...item,
        referenceId: undefined, // remove internal UUIDs from client view
      }));
    }

    return reply.send({ success: true, data: handoff });
  });

  // 15. POST /api/project-closures/:closureId/handoff
  app.post('/project-closures/:closureId/handoff', async (request: AuthenticatedRequest, reply) => {
    const user = request.user!;
    const { closureId } = request.params as { closureId: string };
    const target = await getClosureProjectOrg(closureId);
    if (!target) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Closure request not found' } });

    const auth = await enforcePolicy(user.id, target.organizationId, 'project:handoff_manage', target.projectId);
    if (!auth.allowed) return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: auth.reason } });

    const handoff = await generateProjectHandoff(closureId, user.id);
    return reply.status(201).send({ success: true, data: handoff });
  });

  // 16. POST /api/handoffs/:handoffId/acknowledge (CLIENT ONLY)
  app.post('/handoffs/:handoffId/acknowledge', async (request: AuthenticatedRequest, reply) => {
    const user = request.user!;
    const { handoffId } = request.params as { handoffId: string };
    const target = await getHandoffProjectOrg(handoffId);
    if (!target) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Handoff record not found' } });

    const auth = await enforcePolicy(user.id, target.organizationId, 'project:handoff_acknowledge', target.projectId);
    if (!auth.allowed) return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: auth.reason } });

    try {
      const handoff = await acknowledgeProjectHandoff(handoffId, user.id);
      return reply.send({ success: true, data: handoff });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_STATE', message: err.message } });
    }
  });
}
