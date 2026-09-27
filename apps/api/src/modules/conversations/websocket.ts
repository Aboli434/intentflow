import { WebSocket } from 'ws';
import { RealtimeMessageEvent } from '@intentflow/types';
import { getDb } from '../../config/database.js';
import { sessions, users, conversations, projects } from '../../db/schema/index.js';
import { enforcePolicy } from '../../lib/permissions.js';
import { eq, and, gte } from 'drizzle-orm';

// In-memory active connections maps:
// conversationId -> Set of WebSockets
const conversationConnections = new Map<string, Set<WebSocket>>();
// userId -> Set of WebSockets
const userConnections = new Map<string, Set<WebSocket>>();

export function addConnection(conversationId: string, ws: WebSocket, userId?: string) {
  if (!conversationConnections.has(conversationId)) {
    conversationConnections.set(conversationId, new Set());
  }
  conversationConnections.get(conversationId)!.add(ws);

  if (userId) {
    if (!userConnections.has(userId)) {
      userConnections.set(userId, new Set());
    }
    userConnections.get(userId)!.add(ws);
  }
}

export function removeConnection(conversationId: string, ws: WebSocket, userId?: string) {
  const sockets = conversationConnections.get(conversationId);
  if (sockets) {
    sockets.delete(ws);
    if (sockets.size === 0) {
      conversationConnections.delete(conversationId);
    }
  }

  if (userId) {
    const uSockets = userConnections.get(userId);
    if (uSockets) {
      uSockets.delete(ws);
      if (uSockets.size === 0) {
        userConnections.delete(userId);
      }
    }
  }
}

export function broadcastToConversation(conversationId: string, event: RealtimeMessageEvent) {
  const sockets = conversationConnections.get(conversationId);
  if (!sockets) return;

  const payload = JSON.stringify(event);
  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  }
}

export function broadcastToProject(projectId: string, event: RealtimeMessageEvent) {
  broadcastToConversation(projectId, event);
}

export function broadcastToUser(userId: string, event: RealtimeMessageEvent) {
  const sockets = userConnections.get(userId);
  if (!sockets) return;

  const payload = JSON.stringify(event);
  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  }
}

export async function authenticateWsConnection(
  token: string,
  conversationId: string
): Promise<{ user: { id: string; email: string; name: string }; projectId: string; organizationId: string } | null> {
  if (!token || !conversationId) return null;
  const db = getDb();

  // Find session
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.token, token), gte(sessions.expiresAt, new Date())))
    .limit(1);

  if (!session) return null;

  // Find user
  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user) return null;

  // Find conversation & project
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  if (!conv) return null;

  const [proj] = await db.select().from(projects).where(eq(projects.id, conv.projectId)).limit(1);
  if (!proj) return null;

  // Policy check
  const policy = await enforcePolicy(user.id, proj.organizationId, 'conversation:view', proj.id);
  if (!policy.allowed) return null;

  return {
    user: { id: user.id, email: user.email, name: user.name },
    projectId: proj.id,
    organizationId: proj.organizationId,
  };
}
