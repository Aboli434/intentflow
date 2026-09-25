import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { getDb } from '../../config/database.js';
import { organizationMembers, organizations } from '../../db/schema/index.js';
import { authenticateRequest, AuthenticatedRequest } from '../../lib/auth.js';

export async function usersRoutes(app: FastifyInstance) {
  // GET /api/users/me
  app.get('/me', { preHandler: [authenticateRequest] }, async (request: AuthenticatedRequest, reply) => {
    const db = getDb();
    const user = request.user!;

    const memberRecords = await db
      .select({
        member: organizationMembers,
        organization: organizations,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(eq(organizationMembers.userId, user.id));

    const memberships = memberRecords.map((r) => ({
      id: r.member.id,
      organizationId: r.member.organizationId,
      userId: r.member.userId,
      role: r.member.role,
      createdAt: r.member.createdAt.toISOString(),
      organization: {
        id: r.organization.id,
        name: r.organization.name,
        slug: r.organization.slug,
        createdAt: r.organization.createdAt.toISOString(),
        updatedAt: r.organization.updatedAt.toISOString(),
      },
    }));

    return reply.send({
      success: true,
      data: {
        user,
        memberships,
      },
    });
  });
}
