import { FastifyInstance } from 'fastify';
import { eq, and, desc, isNull, or } from 'drizzle-orm';
import crypto from 'crypto';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  createInvitationSchema,
  updateMemberRoleSchema,
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
import { InvitationDeliveryService } from '../../services/invitations/invitation-delivery.service.js';
import { ActivityService } from '../../services/activity/activity.service.js';
import { NotificationService } from '../../services/notifications/notification.service.js';

const activityService = new ActivityService();
const notificationService = new NotificationService();

export function normalizePhoneNumber(phone: string, defaultCountryCode = '+91'): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (!cleaned.startsWith('+')) {
    if (cleaned.length === 10) {
      cleaned = `${defaultCountryCode}${cleaned}`;
    } else if (cleaned.startsWith('0')) {
      cleaned = `${defaultCountryCode}${cleaned.slice(1)}`;
    } else {
      cleaned = `+${cleaned}`;
    }
  }
  return cleaned;
}

export async function organizationRoutes(app: FastifyInstance) {
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

  // PATCH /api/organizations/:organizationId — Update organization
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

  // GET /api/organizations/:organizationId/members — List members
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

  // PATCH /api/organizations/:organizationId/members/:memberId — Change Member Role (Admin Only)
  app.patch('/:organizationId/members/:memberId', async (request: AuthenticatedRequest, reply) => {
    const { organizationId, memberId } = request.params as { organizationId: string; memberId: string };
    const user = request.user!;

    const policy = await enforcePolicy(user.id, organizationId, 'org:member_edit');
    if (!policy.allowed) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: policy.reason },
      });
    }

    const parseResult = updateMemberRoleSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid role update payload' },
      });
    }

    const newRole = parseResult.data.role;
    const db = getDb();
    const target = await db.select().from(organizationMembers).where(eq(organizationMembers.id, memberId)).limit(1);
    if (target.length === 0 || target[0].organizationId !== organizationId) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Member record not found in this organization' },
      });
    }

    const oldRole = target[0].role;
    if (oldRole === 'admin' && newRole !== 'admin') {
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
          error: { code: 'LAST_ADMIN', message: 'Cannot downgrade the last admin of the organization' },
        });
      }
    }

    const [updated] = await db
      .update(organizationMembers)
      .set({ role: newRole })
      .where(eq(organizationMembers.id, memberId))
      .returning();

    const orgRes = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
    if (updated.userId !== user.id) {
      await notificationService.createNotification({
        userId: updated.userId,
        organizationId,
        type: 'organization_role_changed',
        title: 'Organization Role Updated',
        body: `Your role in "${orgRes[0]?.name}" was updated to ${newRole}.`,
        entityType: 'organization_member',
        entityId: updated.id,
      });
    }

    return reply.send({
      success: true,
      data: {
        id: updated.id,
        organizationId: updated.organizationId,
        userId: updated.userId,
        role: updated.role,
        createdAt: updated.createdAt.toISOString(),
      },
    });
  });

  // DELETE /api/organizations/:organizationId/members/:memberId — Remove Member (Admin Only)
  app.delete('/:organizationId/members/:memberId', async (request: AuthenticatedRequest, reply) => {
    const { organizationId, memberId } = request.params as { organizationId: string; memberId: string };
    const user = request.user!;

    const policy = await enforcePolicy(user.id, organizationId, 'org:member_remove');
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

    const orgRes = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
    if (target[0].userId !== user.id) {
      await notificationService.createNotification({
        userId: target[0].userId,
        organizationId,
        type: 'organization_member_removed',
        title: 'Removed from Organization',
        body: `You were removed from "${orgRes[0]?.name}".`,
        entityType: 'organization',
        entityId: organizationId,
      });
    }

    return reply.send({ success: true, message: 'Member removed successfully' });
  });

  // GET /api/organizations/:organizationId/invitations — List pending invitations (Policy: org:invitation_view)
  app.get('/:organizationId/invitations', async (request: AuthenticatedRequest, reply) => {
    const { organizationId } = request.params as { organizationId: string };
    const user = request.user!;

    const policy = await enforcePolicy(user.id, organizationId, 'org:invitation_view');
    if (!policy.allowed) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: policy.reason },
      });
    }

    const db = getDb();
    const invs = await db
      .select({
        invitation: organizationInvitations,
        inviter: users,
      })
      .from(organizationInvitations)
      .leftJoin(users, eq(organizationInvitations.invitedBy, users.id))
      .where(
        and(
          eq(organizationInvitations.organizationId, organizationId),
          eq(organizationInvitations.status, 'pending')
        )
      )
      .orderBy(desc(organizationInvitations.createdAt));

    const result = invs.map(({ invitation: inv, inviter }) => ({
      id: inv.id,
      organizationId: inv.organizationId,
      email: inv.email || undefined,
      phone: inv.phone || undefined,
      invitationMethod: inv.invitationMethod,
      role: inv.role,
      status: inv.status,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
      inviterName: inviter?.name,
      isExpired: new Date() > inv.expiresAt,
    }));

    return reply.send({ success: true, data: result });
  });

  // POST /api/organizations/:organizationId/invitations — Invite member (Policy: org:invitation_create)
  app.post('/:organizationId/invitations', async (request: AuthenticatedRequest, reply) => {
    const { organizationId } = request.params as { organizationId: string };
    const user = request.user!;

    const policy = await enforcePolicy(user.id, organizationId, 'org:invitation_create');
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

    const { method, email, phone, role } = parseResult.data;
    const invitationMethod = method || 'email';

    let targetEmail: string | null = null;
    let targetPhone: string | null = null;

    if (invitationMethod === 'sms') {
      if (!phone || phone.trim().length < 8) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Mobile phone number is required for SMS invitation' },
        });
      }
      targetPhone = normalizePhoneNumber(phone.trim());
    } else {
      if (!email || !email.includes('@')) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Valid email address is required for Email invitation' },
        });
      }
      targetEmail = email.toLowerCase().trim();
    }

    const db = getDb();

    // 1. Prevent inviting an existing member of this organization
    if (targetEmail) {
      const existingUser = await db.select().from(users).where(eq(users.email, targetEmail)).limit(1);
      if (existingUser.length > 0) {
        const isMember = await db
          .select()
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.organizationId, organizationId),
              eq(organizationMembers.userId, existingUser[0].id)
            )
          )
          .limit(1);

        if (isMember.length > 0) {
          return reply.status(409).send({
            success: false,
            error: { code: 'ALREADY_MEMBER', message: 'User is already a member of this organization' },
          });
        }
      }
    }

    // 2. Prevent duplicate active pending invitation for same contact in this org
    if (targetEmail) {
      const dup = await db
        .select()
        .from(organizationInvitations)
        .where(
          and(
            eq(organizationInvitations.organizationId, organizationId),
            eq(organizationInvitations.email, targetEmail),
            eq(organizationInvitations.status, 'pending')
          )
        )
        .limit(1);

      if (dup.length > 0) {
        return reply.status(409).send({
          success: false,
          error: { code: 'DUPLICATE_INVITATION', message: 'An active invitation already exists for this email address' },
        });
      }
    }

    if (targetPhone) {
      const dup = await db
        .select()
        .from(organizationInvitations)
        .where(
          and(
            eq(organizationInvitations.organizationId, organizationId),
            eq(organizationInvitations.phone, targetPhone),
            eq(organizationInvitations.status, 'pending')
          )
        )
        .limit(1);

      if (dup.length > 0) {
        return reply.status(409).send({
          success: false,
          error: { code: 'DUPLICATE_INVITATION', message: 'An active invitation already exists for this phone number' },
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
        phone: targetPhone,
        invitationMethod,
        role,
        token,
        invitedBy: user.id,
        status: 'pending',
        expiresAt,
      })
      .returning();

    // 3. Dispatch Delivery Abstraction (Stubs Resend/Twilio/WhatsApp)
    const orgRes = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
    const orgName = orgRes[0]?.name || 'IntentFlow Workspace';
    const targetDestination = targetEmail || targetPhone || '';

    const deliveryService = new InvitationDeliveryService();
    await deliveryService.dispatchInvitation({
      destination: targetDestination,
      invitationUrl: `${process.env.APP_URL || 'http://localhost:3000'}/invite/${token}`,
      organizationName: orgName,
      role,
      invitationMethod,
    });

    return reply.status(201).send({
      success: true,
      data: {
        id: invitation.id,
        organizationId: invitation.organizationId,
        email: invitation.email || undefined,
        phone: invitation.phone || undefined,
        invitationMethod: invitation.invitationMethod,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt.toISOString(),
        createdAt: invitation.createdAt.toISOString(),
      },
    });
  });
}
