import { getDb } from '../../config/database.js';
import { projectActivity, users } from '../../db/schema/index.js';
import { eq, desc } from 'drizzle-orm';

export interface RecordActivityInput {
  projectId: string;
  actorId?: string | null;
  type: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, any> | null;
}

export class ActivityService {
  /**
   * Central mechanism for recording immutable project events
   */
  async recordActivity(input: RecordActivityInput): Promise<any> {
    const db = getDb();
    const [entry] = await db
      .insert(projectActivity)
      .values({
        projectId: input.projectId,
        actorId: input.actorId || null,
        type: input.type,
        entityType: input.entityType,
        entityId: input.entityId || null,
        metadata: input.metadata || null,
      })
      .returning();

    return entry;
  }

  /**
   * Fetch project activity timeline in reverse chronological order
   * Respects client/developer visibility (filters internal metadata for clients)
   */
  async getProjectActivity(projectId: string, userRole: string = 'developer', limit: number = 50): Promise<any[]> {
    const db = getDb();
    const list = await db
      .select({
        id: projectActivity.id,
        projectId: projectActivity.projectId,
        actorId: projectActivity.actorId,
        type: projectActivity.type,
        entityType: projectActivity.entityType,
        entityId: projectActivity.entityId,
        metadata: projectActivity.metadata,
        createdAt: projectActivity.createdAt,
        actorName: users.name,
      })
      .from(projectActivity)
      .leftJoin(users, eq(projectActivity.actorId, users.id))
      .where(eq(projectActivity.projectId, projectId))
      .orderBy(desc(projectActivity.createdAt))
      .limit(limit);

    const isClient = userRole === 'client';

    return list
      .filter((item: any) => {
        if (isClient) {
          // Filter out developer-only internal events for clients
          if (item.type === 'work_proposal_generated' || item.type === 'intent_analyzed') {
            return false;
          }
        }
        return true;
      })
      .map((item: any) => {
        let meta = item.metadata;
        if (isClient && meta) {
          // Sanitize metadata for client view (remove confidence, provider internal metrics)
          const { confidence, provider, model, ...clientSafeMeta } = meta as any;
          meta = clientSafeMeta;
        }

        return {
          id: item.id,
          projectId: item.projectId,
          actorId: item.actorId,
          actorName: item.actorName || (item.actorId ? 'Team Member' : 'System'),
          type: item.type,
          entityType: item.entityType,
          entityId: item.entityId,
          metadata: meta,
          createdAt: item.createdAt.toISOString(),
        };
      });
  }
}
