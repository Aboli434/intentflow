import { FastifyInstance } from 'fastify';
import { eq, and, gt } from 'drizzle-orm';
import { getDb } from '../../config/database.js';
import {
  organizationInvitations,
  organizationMembers,
  organizations,
} from '../../db/schema/index.js';
import { authenticateRequest, AuthenticatedRequest } from '../../lib/auth.js';

export async function invitationRoutes(app: FastifyInstance) {
  // GET /api/invitations/:token — Preview invitation details
  app.get('/:token', async (request, reply) => {
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
    const isAccepted = !!invitation.acceptedAt;

    return reply.send({
      success: true,
      data: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        organizationId: organization.id,
        organizationName: organization.name,
        expiresAt: invitation.expiresAt.toISOString(),
        isExpired,
        isAccepted,
      },
    });
  });

  // POST /api/invitations/:token/accept — Accept invitation (Requires Auth)
  app.post('/:token/accept', { preHandler: [authenticateRequest] }, async (request: AuthenticatedRequest, reply) => {
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

    if (invitation.acceptedAt) {
      return reply.status(409).send({
        success: false,
        error: { code: 'ALREADY_ACCEPTED', message: 'This invitation has already been accepted' },
      });
    }

    if (new Date(invitation.expiresAt) < new Date()) {
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

    // Mark accepted
    await db
      .update(organizationInvitations)
      .set({ acceptedAt: new Date() })
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
}
