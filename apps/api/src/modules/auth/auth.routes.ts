import { FastifyInstance } from 'fastify';
import { eq, and, gt } from 'drizzle-orm';
import { signupSchema, loginSchema } from '@intentflow/validation';
import { getDb } from '../../config/database.js';
import {
  users,
  sessions,
  organizationInvitations,
  organizationMembers,
  organizations,
} from '../../db/schema/index.js';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  authenticateRequest,
  AuthenticatedRequest,
} from '../../lib/auth.js';

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/signup
  app.post('/signup', async (request, reply) => {
    const parseResult = signupSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(422).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid registration input',
          details: parseResult.error.format(),
        },
      });
    }

    const { name, email, password, invitationToken } = parseResult.data;
    const db = getDb();

    // Check duplicate email
    const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    if (existing.length > 0) {
      return reply.status(409).send({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'A user with this email already exists' },
      });
    }

    const passwordHash = await hashPassword(password);
    const [newUser] = await db
      .insert(users)
      .values({
        name,
        email: email.toLowerCase(),
        passwordHash,
      })
      .returning();

    // Process invitation token if passed during signup
    if (invitationToken) {
      const inviteRecords = await db
        .select()
        .from(organizationInvitations)
        .where(
          and(
            eq(organizationInvitations.token, invitationToken),
            gt(organizationInvitations.expiresAt, new Date())
          )
        )
        .limit(1);

      if (inviteRecords.length > 0 && !inviteRecords[0].acceptedAt) {
        const invite = inviteRecords[0];
        // Create org membership
        await db.insert(organizationMembers).values({
          organizationId: invite.organizationId,
          userId: newUser.id,
          role: invite.role,
        }).onConflictDoNothing();

        // Mark invitation accepted
        await db
          .update(organizationInvitations)
          .set({ acceptedAt: new Date() })
          .where(eq(organizationInvitations.id, invite.id));
      }
    }

    // Create session (expires in 30 days)
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.insert(sessions).values({
      userId: newUser.id,
      token,
      expiresAt,
    });

    // Set HTTP-only session cookie
    reply.setCookie('session_token', token, {
      path: '/',
      httpOnly: true,
      secure: false, // development friendly
      sameSite: 'lax',
      expires: expiresAt,
    });

    const userPayload = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      avatarUrl: newUser.avatarUrl,
      createdAt: newUser.createdAt.toISOString(),
      updatedAt: newUser.updatedAt.toISOString(),
    };

    return reply.status(201).send({
      success: true,
      data: {
        token,
        user: userPayload,
      },
    });
  });

  // POST /api/auth/login
  app.post('/login', async (request, reply) => {
    const parseResult = loginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(422).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid login input',
          details: parseResult.error.format(),
        },
      });
    }

    const { email, password } = parseResult.data;
    const db = getDb();

    const userRecords = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    if (userRecords.length === 0) {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    const user = userRecords[0];
    const passwordMatch = await verifyPassword(password, user.passwordHash);
    if (!passwordMatch) {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    // Create session (expires in 30 days)
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.insert(sessions).values({
      userId: user.id,
      token,
      expiresAt,
    });

    reply.setCookie('session_token', token, {
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      expires: expiresAt,
    });

    const userPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    return reply.status(200).send({
      success: true,
      data: {
        token,
        user: userPayload,
      },
    });
  });

  // POST /api/auth/logout
  app.post('/logout', { preHandler: [authenticateRequest] }, async (request: AuthenticatedRequest, reply) => {
    const db = getDb();
    if (request.sessionToken) {
      await db.delete(sessions).where(eq(sessions.token, request.sessionToken));
    }
    reply.clearCookie('session_token', { path: '/' });
    return reply.send({ success: true, message: 'Logged out successfully' });
  });

  // GET /api/auth/me
  app.get('/me', { preHandler: [authenticateRequest] }, async (request: AuthenticatedRequest, reply) => {
    const db = getDb();
    const user = request.user!;

    // Fetch user memberships with org details
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
