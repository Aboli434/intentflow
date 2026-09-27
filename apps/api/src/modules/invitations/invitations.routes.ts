import { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { getDb } from '../../config/database.js';
import {
  organizationInvitations,
  organizationMembers,
  organizations,
  users,
} from '../../db/schema/index.js';
import { authenticateRequest, AuthenticatedRequest } from '../../lib/auth.js';
import { enforcePolicy } from '../../lib/permissions.js';
import { InvitationDeliveryService } from '../../services/invitations/invitation-delivery.service.js';

export async function invitationRoutes(app: FastifyInstance) {
  // GET /api/invitations/:token — Preview invitation details (Public)
  app.get('/invitations/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const db = getDb();

    const inviteRecords = await db
      .select({
        invitation: organizationInvitations,
        organization: organizations,
      })
      .from(organizationInvitations)
      .innerJoin(organizations, eq(organizationInvitations.organizationId, organizations.id))
      .where(eq(organizationInvitations.token, token))
      .limit(1);

    if (inviteRecords.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invitation not found or invalid' },
      });
    }

    const { invitation, organization } = inviteRecords[0];
    const isExpired = new Date(invitation.expiresAt) < new Date();
    const isAccepted = invitation.status === 'accepted' || !!invitation.acceptedAt;

    return reply.send({
      success: true,
      data: {
        id: invitation.id,
        email: invitation.email || undefined,
        phone: invitation.phone || undefined,
        invitationMethod: invitation.invitationMethod,
        role: invitation.role,
        status: invitation.status,
        organizationId: organization.id,
        organizationName: organization.name,
        expiresAt: invitation.expiresAt.toISOString(),
        isExpired,
        isAccepted,
      },
    });
  });

  // POST /api/invitations/:token/accept — Accept invitation (Requires Auth)
  app.post('/invitations/:token/accept', { preHandler: [authenticateRequest] }, async (request: AuthenticatedRequest, reply) => {
    const { token } = request.params as { token: string };
    const db = getDb();
    const user = request.user!;

    const inviteRecords = await db
      .select()
      .from(organizationInvitations)
      .where(eq(organizationInvitations.token, token))
      .limit(1);

    if (inviteRecords.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invitation token not found' },
      });
    }

    const invitation = inviteRecords[0];

    if (invitation.status === 'accepted' || invitation.acceptedAt) {
      return reply.status(409).send({
        success: false,
        error: { code: 'ALREADY_ACCEPTED', message: 'This invitation has already been accepted' },
      });
    }

    if (invitation.status === 'cancelled') {
      return reply.status(410).send({
        success: false,
        error: { code: 'CANCELLED', message: 'This invitation has been cancelled' },
      });
    }

    if (new Date(invitation.expiresAt) < new Date() || invitation.status === 'expired') {
      return reply.status(410).send({
        success: false,
        error: { code: 'EXPIRED', message: 'This invitation has expired' },
      });
    }

    // Add user as organization member
    await db
      .insert(organizationMembers)
      .values({
        organizationId: invitation.organizationId,
        userId: user.id,
        role: invitation.role,
      })
      .onConflictDoNothing();

    // Mark invitation accepted
    const now = new Date();
    await db
      .update(organizationInvitations)
      .set({
        status: 'accepted',
        acceptedAt: now,
        updatedAt: now,
      })
      .where(eq(organizationInvitations.id, invitation.id));

    return reply.send({
      success: true,
      message: 'Invitation accepted successfully',
      data: {
        organizationId: invitation.organizationId,
        role: invitation.role,
      },
    });
  });

  // POST /api/organization-invitations/:invitationId/cancel (Policy: org:invitation_cancel)
  app.post('/organization-invitations/:invitationId/cancel', { preHandler: [authenticateRequest] }, async (request: AuthenticatedRequest, reply) => {
    const { invitationId } = request.params as { invitationId: string };
    const user = request.user!;
    const db = getDb();

    const [inv] = await db.select().from(organizationInvitations).where(eq(organizationInvitations.id, invitationId)).limit(1);
    if (!inv) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invitation not found' },
      });
    }

    const policy = await enforcePolicy(user.id, inv.organizationId, 'org:invitation_cancel');
    if (!policy.allowed) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: policy.reason },
      });
    }

    const now = new Date();
    await db
      .update(organizationInvitations)
      .set({
        status: 'cancelled',
        updatedAt: now,
      })
      .where(eq(organizationInvitations.id, invitationId));

    return reply.send({ success: true, message: 'Invitation cancelled successfully' });
  });

  // POST /api/organization-invitations/:invitationId/resend (Policy: org:invitation_resend)
  app.post('/organization-invitations/:invitationId/resend', { preHandler: [authenticateRequest] }, async (request: AuthenticatedRequest, reply) => {
    const { invitationId } = request.params as { invitationId: string };
    const user = request.user!;
    const db = getDb();

    const [inv] = await db.select().from(organizationInvitations).where(eq(organizationInvitations.id, invitationId)).limit(1);
    if (!inv) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invitation not found' },
      });
    }

    const policy = await enforcePolicy(user.id, inv.organizationId, 'org:invitation_resend');
    if (!policy.allowed) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: policy.reason },
      });
    }

    const newToken = crypto.randomBytes(32).toString('hex');
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const now = new Date();

    const [updated] = await db
      .update(organizationInvitations)
      .set({
        token: newToken,
        status: 'pending',
        expiresAt: newExpiresAt,
        updatedAt: now,
      })
      .where(eq(organizationInvitations.id, invitationId))
      .returning();

    const orgRes = await db.select().from(organizations).where(eq(organizations.id, inv.organizationId)).limit(1);

    const deliveryService = new InvitationDeliveryService();
    await deliveryService.dispatchInvitation({
      destination: updated.email || updated.phone || '',
      invitationUrl: `${process.env.APP_URL || 'http://localhost:3000'}/invite/${updated.token}`,
      organizationName: orgRes[0]?.name || 'IntentFlow Workspace',
      role: updated.role,
      invitationMethod: updated.invitationMethod as any,
    });

    return reply.send({
      success: true,
      message: 'Invitation resent successfully',
      data: {
        id: updated.id,
        organizationId: updated.organizationId,
        email: updated.email || undefined,
        phone: updated.phone || undefined,
        invitationMethod: updated.invitationMethod,
        role: updated.role,
        status: updated.status,
        expiresAt: updated.expiresAt.toISOString(),
      },
    });
  });
}
