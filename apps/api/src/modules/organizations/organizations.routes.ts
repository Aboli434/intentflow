import { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  createInvitationSchema,
} from '@intentflow/validation';
import { getDb } from '../../config/database.js';
import {
  organizations,
  organizationMembers,
  organizationInvitations,
  users,
} from '../../db/schema/index.js';
import { authenticateRequest, AuthenticatedRequest } from '../../lib/auth.js';
import { enforcePolicy } from '../../lib/permissions.js';

export async function organizationRoutes(app: FastifyInstance) {
  // All organization routes require authentication
  app.addHook('preHandler', authenticateRequest);

  // POST /api/organizations — Create organization
  app.post('/', async (request: AuthenticatedRequest, reply) => {
    const parseResult = createOrganizationSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(422).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid organization input',
          details: parseResult.error.format(),
        },
      });
    }

    const { name, slug: customSlug } = parseResult.data;
    const db = getDb();
    const user = request.user!;

    // Generate unique slug if not provided
    const baseSlug = customSlug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let slug = baseSlug || 'org';
    let counter = 1;

    while (true) {
      const existing = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
      if (existing.length === 0) break;
      slug = `${baseSlug}-${counter++}`;
    }

    const [newOrg] = await db
      .insert(organizations)
      .values({ name, slug })
      .returning();

    // Make creator Admin of organization
    await db.insert(organizationMembers).values({
      organizationId: newOrg.id,
      userId: user.id,
      role: 'admin',
    });

    return reply.status(201).send({
      success: true,
      data: {
        id: newOrg.id,
        name: newOrg.name,
        slug: newOrg.slug,
        role: 'admin',
        createdAt: newOrg.createdAt.toISOString(),
        updatedAt: newOrg.updatedAt.toISOString(),
      },
    });
  });

  // GET /api/organizations — List user's organizations
  app.get('/', async (request: AuthenticatedRequest, reply) => {
    const db = getDb();
    const user = request.user!;

    const records = await db
      .select({
        organization: organizations,
        member: organizationMembers,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(eq(organizationMembers.userId, user.id));

    const result = records.map((r) => ({
      id: r.organization.id,
      name: r.organization.name,
      slug: r.organization.slug,
      role: r.member.role,
      createdAt: r.organization.createdAt.toISOString(),
      updatedAt: r.organization.updatedAt.toISOString(),
    }));

    return reply.send({ success: true, data: result });
  });

  // GET /api/organizations/:organizationId — Get organization detail
  app.get('/:organizationId', async (request: AuthenticatedRequest, reply) => {
    const { organizationId } = request.params as { organizationId: string };
    const user = request.user!;

    const policy = await enforcePolicy(user.id, organizationId, 'org:view');
    if (!policy.allowed) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: policy.reason },
      });
    }

    const db = getDb();
    const orgs = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
    if (orgs.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Organization not found' },
      });
    }

    const org = orgs[0];
    return reply.send({
      success: true,
      data: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        role: policy.ctx.orgRole,
        createdAt: org.createdAt.toISOString(),
        updatedAt: org.updatedAt.toISOString(),
      },
    });
  });

  // PATCH /api/organizations/:organizationId — Update organization (Policy: org:update)
  app.patch('/:organizationId', async (request: AuthenticatedRequest, reply) => {
    const { organizationId } = request.params as { organizationId: string };
    const user = request.user!;

    const policy = await enforcePolicy(user.id, organizationId, 'org:update');
    if (!policy.allowed) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: policy.reason },
      });
    }

    const parseResult = updateOrganizationSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(422).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parseResult.error.format() },
      });
    }

    const db = getDb();
    const [updated] = await db
      .update(organizations)
      .set(parseResult.data)
      .where(eq(organizations.id, organizationId))
      .returning();

    return reply.send({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  });

  // GET /api/organizations/:organizationId/members — List members (Policy: org:view)
  app.get('/:organizationId/members', async (request: AuthenticatedRequest, reply) => {
    const { organizationId } = request.params as { organizationId: string };
    const user = request.user!;

    const policy = await enforcePolicy(user.id, organizationId, 'org:view');
    if (!policy.allowed) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: policy.reason },
      });
    }

    const db = getDb();
    const memberRecords = await db
      .select({
        member: organizationMembers,
        user: users,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.organizationId, organizationId));

    const result = memberRecords.map((r) => ({
      id: r.member.id,
      organizationId: r.member.organizationId,
      userId: r.member.userId,
      role: r.member.role,
      createdAt: r.member.createdAt.toISOString(),
      user: {
        id: r.user.id,
        name: r.user.name,
        email: r.user.email,
        avatarUrl: r.user.avatarUrl,
        createdAt: r.user.createdAt.toISOString(),
        updatedAt: r.user.updatedAt.toISOString(),
      },
    }));

    return reply.send({ success: true, data: result });
  });

  // DELETE /api/organizations/:organizationId/members/:memberId — Remove member (Policy: org:remove_member)
  app.delete('/:organizationId/members/:memberId', async (request: AuthenticatedRequest, reply) => {
    const { organizationId, memberId } = request.params as { organizationId: string; memberId: string };
    const user = request.user!;

    const policy = await enforcePolicy(user.id, organizationId, 'org:remove_member');
    if (!policy.allowed) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: policy.reason },
      });
    }

    const db = getDb();
    const target = await db.select().from(organizationMembers).where(eq(organizationMembers.id, memberId)).limit(1);
    if (target.length === 0 || target[0].organizationId !== organizationId) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Member record not found in this organization' },
      });
    }

    // Prevent deleting the last admin
    if (target[0].role === 'admin') {
      const adminCount = await db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, organizationId),
            eq(organizationMembers.role, 'admin')
          )
        );

      if (adminCount.length <= 1) {
        return reply.status(400).send({
          success: false,
          error: { code: 'LAST_ADMIN', message: 'Cannot remove the last admin of the organization' },
        });
      }
    }

    await db.delete(organizationMembers).where(eq(organizationMembers.id, memberId));
    return reply.send({ success: true, message: 'Member removed successfully' });
  });

  // POST /api/organizations/:organizationId/invitations — Invite member (Policy: org:invite)
  app.post('/:organizationId/invitations', async (request: AuthenticatedRequest, reply) => {
    const { organizationId } = request.params as { organizationId: string };
    const user = request.user!;

    const policy = await enforcePolicy(user.id, organizationId, 'org:invite');
    if (!policy.allowed) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: policy.reason },
      });
    }

    const parseResult = createInvitationSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(422).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid invitation payload', details: parseResult.error.format() },
      });
    }

    const { email, role } = parseResult.data;
    const targetEmail = email.toLowerCase();
    const db = getDb();

    // Check if user is already a member
    const existingUsers = await db.select().from(users).where(eq(users.email, targetEmail)).limit(1);
    if (existingUsers.length > 0) {
      const existingMember = await db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, organizationId),
            eq(organizationMembers.userId, existingUsers[0].id)
          )
        )
        .limit(1);

      if (existingMember.length > 0) {
        return reply.status(409).send({
          success: false,
          error: { code: 'ALREADY_MEMBER', message: 'User is already a member of this organization' },
        });
      }
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [invitation] = await db
      .insert(organizationInvitations)
      .values({
        organizationId,
        email: targetEmail,
        role,
        token,
        expiresAt,
      })
      .returning();

    return reply.status(201).send({
      success: true,
      data: {
        id: invitation.id,
        organizationId: invitation.organizationId,
        email: invitation.email,
        role: invitation.role,
        token: invitation.token,
        expiresAt: invitation.expiresAt.toISOString(),
        createdAt: invitation.createdAt.toISOString(),
      },
    });
  });
}
