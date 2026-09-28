import { FastifyInstance } from 'fastify';
import { eq, inArray, desc } from 'drizzle-orm';
import {
  createProjectSchema,
  updateProjectSchema,
  addProjectMemberSchema,
} from '@intentflow/validation';
import { getDb } from '../../config/database.js';
import {
  projects,
  projectMembers,
  organizations,
  organizationMembers,
  users,
  attachments,
} from '../../db/schema/index.js';
import { authenticateRequest, AuthenticatedRequest } from '../../lib/auth.js';
import { enforcePolicy, getAuthContext } from '../../lib/permissions.js';

export async function projectRoutes(app: FastifyInstance) {
  // All project endpoints require authentication
  app.addHook('preHandler', authenticateRequest);

  // POST /api/projects — Create project (Policy: project:create)
  app.post('/', async (request: AuthenticatedRequest, reply) => {
    const parseResult = createProjectSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(422).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid project creation payload',
          details: parseResult.error.format(),
        },
      });
    }

    const { organizationId, name, description, members } = parseResult.data;
    const user = request.user!;

    // Policy check: project:create on organization
    const policy = await enforcePolicy(user.id, organizationId, 'project:create');
    if (!policy.allowed) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: policy.reason },
      });
    }

    const db = getDb();
    const [newProject] = await db
      .insert(projects)
      .values({
        organizationId,
        name,
        description,
        status: 'active',
      })
      .returning();

    // Add creator as project member
    await db.insert(projectMembers).values({
      projectId: newProject.id,
      userId: user.id,
      role: policy.ctx.orgRole === 'admin' ? 'developer' : (policy.ctx.orgRole as 'developer' | 'client'),
    }).onConflictDoNothing();

    // Add explicit initial members if passed
    if (members && members.length > 0) {
      for (const m of members) {
        const mCtx = await getAuthContext(m.userId, organizationId);
        if (mCtx.orgRole) {
          await db
            .insert(projectMembers)
            .values({
              projectId: newProject.id,
              userId: m.userId,
              role: m.role,
            })
            .onConflictDoNothing();
        }
      }
    }

    return reply.status(201).send({
      success: true,
      data: {
        id: newProject.id,
        organizationId: newProject.organizationId,
        name: newProject.name,
        description: newProject.description,
        status: newProject.status,
        createdAt: newProject.createdAt.toISOString(),
        updatedAt: newProject.updatedAt.toISOString(),
      },
    });
  });

  // GET /api/projects — List accessible projects
  app.get('/', async (request: AuthenticatedRequest, reply) => {
    const db = getDb();
    const user = request.user!;

    const userOrgs = await db
      .select({
        organizationId: organizationMembers.organizationId,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, user.id));

    if (userOrgs.length === 0) {
      return reply.send({ success: true, data: [] });
    }

    const adminOrgIds = userOrgs.filter((o) => o.role === 'admin').map((o) => o.organizationId);
    const nonAdminOrgIds = userOrgs.filter((o) => o.role !== 'admin').map((o) => o.organizationId);

    const projectResults: any[] = [];

    // For Org Admins, get all projects in admin organizations (project:view granted via org admin role)
    if (adminOrgIds.length > 0) {
      const adminProjects = await db
        .select({
          project: projects,
          org: organizations,
        })
        .from(projects)
        .innerJoin(organizations, eq(projects.organizationId, organizations.id))
        .where(inArray(projects.organizationId, adminOrgIds));

      projectResults.push(...adminProjects);
    }

    // For non-admins, get projects where they hold explicit project membership (project:view granted via project membership)
    if (nonAdminOrgIds.length > 0) {
      const memberProjects = await db
        .select({
          project: projects,
          org: organizations,
        })
        .from(projectMembers)
        .innerJoin(projects, eq(projectMembers.projectId, projects.id))
        .innerJoin(organizations, eq(projects.organizationId, organizations.id))
        .where(eq(projectMembers.userId, user.id));

      for (const mp of memberProjects) {
        if (!projectResults.some((p) => p.project.id === mp.project.id)) {
          projectResults.push(mp);
        }
      }
    }

    const data = projectResults.map((r) => ({
      id: r.project.id,
      organizationId: r.project.organizationId,
      organizationName: r.org.name,
      name: r.project.name,
      description: r.project.description,
      status: r.project.status,
      createdAt: r.project.createdAt.toISOString(),
      updatedAt: r.project.updatedAt.toISOString(),
    }));

    return reply.send({ success: true, data });
  });

  // GET /api/projects/:projectId — Project detail (Policy: project:view)
  app.get('/:projectId', async (request: AuthenticatedRequest, reply) => {
    const { projectId } = request.params as { projectId: string };
    const db = getDb();
    const user = request.user!;

    const projectRecords = await db
      .select({
        project: projects,
        org: organizations,
      })
      .from(projects)
      .innerJoin(organizations, eq(projects.organizationId, organizations.id))
      .where(eq(projects.id, projectId))
      .limit(1);

    if (projectRecords.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      });
    }

    const { project, org } = projectRecords[0];

    // Policy check: project:view evaluated using Org Role + Project Role
    const policy = await enforcePolicy(user.id, project.organizationId, 'project:view', projectId);
    if (!policy.allowed) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: policy.reason },
      });
    }

    // Fetch project members
    const pMemberRecords = await db
      .select({
        pm: projectMembers,
        user: users,
      })
      .from(projectMembers)
      .innerJoin(users, eq(projectMembers.userId, users.id))
      .where(eq(projectMembers.projectId, projectId));

    const members = pMemberRecords.map((r) => ({
      id: r.pm.id,
      projectId: r.pm.projectId,
      userId: r.pm.userId,
      role: r.pm.role,
      createdAt: r.pm.createdAt.toISOString(),
      user: {
        id: r.user.id,
        name: r.user.name,
        email: r.user.email,
        avatarUrl: r.user.avatarUrl,
        createdAt: r.user.createdAt.toISOString(),
        updatedAt: r.user.updatedAt.toISOString(),
      },
    }));

    return reply.send({
      success: true,
      data: {
        id: project.id,
        organizationId: project.organizationId,
        organizationName: org.name,
        name: project.name,
        description: project.description,
        status: project.status,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        members,
      },
    });
  });

  // PATCH /api/projects/:projectId — Update project (Policy: project:update)
  app.patch('/:projectId', async (request: AuthenticatedRequest, reply) => {
    const { projectId } = request.params as { projectId: string };
    const db = getDb();
    const user = request.user!;

    const projectRecords = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (projectRecords.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      });
    }

    const project = projectRecords[0];

    // Policy check: project:update
    const policy = await enforcePolicy(user.id, project.organizationId, 'project:update', projectId);
    if (!policy.allowed) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: policy.reason },
      });
    }

    const parseResult = updateProjectSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(422).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parseResult.error.format() },
      });
    }

    const [updated] = await db.update(projects).set(parseResult.data).where(eq(projects.id, projectId)).returning();

    return reply.send({
      success: true,
      data: {
        id: updated.id,
        organizationId: updated.organizationId,
        name: updated.name,
        description: updated.description,
        status: updated.status,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  });

  // POST /api/projects/:projectId/approve — Role-specific business action check (Policy: project:client_approve)
  app.post('/:projectId/approve', async (request: AuthenticatedRequest, reply) => {
    const { projectId } = request.params as { projectId: string };
    const db = getDb();
    const user = request.user!;

    const projectRecords = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (projectRecords.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      });
    }

    const project = projectRecords[0];

    // Policy check: project:client_approve
    // Strictly requires projectRole === 'client'. Org admins without client role on the project are denied.
    const policy = await enforcePolicy(user.id, project.organizationId, 'project:client_approve', projectId);
    if (!policy.allowed) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: policy.reason },
      });
    }

    return reply.send({
      success: true,
      message: 'Client approval action verified successfully',
    });
  });

  // GET /api/projects/:projectId/attachments — List project attachments
  app.get('/:projectId/attachments', async (request: AuthenticatedRequest, reply) => {
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

