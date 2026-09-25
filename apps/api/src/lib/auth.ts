import crypto from 'crypto';
import { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, gt } from 'drizzle-orm';
import { getDb } from '../config/database.js';
import { users, sessions, organizationMembers, projectMembers } from '../db/schema/index.js';
import { User, UserRole } from '@intentflow/types';

// Password Hashing using Node's built-in crypto scrypt
export function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, key] = hash.split(':');
    if (!salt || !key) return resolve(false);
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey.toString('hex') === key);
    });
  });
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export interface AuthenticatedRequest extends FastifyRequest {
  user?: User;
  sessionToken?: string;
}

export async function authenticateRequest(request: AuthenticatedRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (request.cookies && request.cookies.session_token) {
    token = request.cookies.session_token;
  }

  if (!token) {
    reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
    return;
  }

  const db = getDb();
  const sessionRecords = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (sessionRecords.length === 0) {
    reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired session token' },
    });
    return;
  }

  const record = sessionRecords[0];
  request.user = {
    id: record.user.id,
    name: record.user.name,
    email: record.user.email,
    avatarUrl: record.user.avatarUrl,
    createdAt: record.user.createdAt.toISOString(),
    updatedAt: record.user.updatedAt.toISOString(),
  };
  request.sessionToken = token;
}

export async function getUserOrgRole(userId: string, organizationId: string): Promise<UserRole | null> {
  const db = getDb();
  const members = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1);

  return members.length > 0 ? (members[0].role as UserRole) : null;
}

export async function checkProjectAccess(userId: string, projectId: string) {
  const db = getDb();
  // Check if user is in project_members directly or is an org admin
  const pMembers = await db
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);

  if (pMembers.length > 0) {
    return { hasAccess: true, role: pMembers[0].role };
  }

  return { hasAccess: false };
}
