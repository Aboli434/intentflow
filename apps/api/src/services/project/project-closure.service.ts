import { eq, and, desc, inArray } from 'drizzle-orm';
import { getDb } from '../../config/database.js';
import {
  projectClosures,
  closureReviews,
  closureRevisionRequests,
  projectHandoffs,
  handoffItems,
  projects,
  users,
  deliverables,
  workItems,
  projectCompletionChecklist,
  projectMembers,
} from '../../db/schema/index.js';
import { checkProjectCompletionEligibility } from './project-completion.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { NotificationService } from '../notifications/notification.service.js';
import { broadcastToProject } from '../../modules/conversations/websocket.js';
import {
  ProjectClosure as ProjectClosureType,
  ProjectHandoff as ProjectHandoffType,
  ClosureReview as ClosureReviewType,
  ClosureRevisionRequest as ClosureRevisionRequestType,
  HandoffItem as HandoffItemType,
} from '@intentflow/types';

const activityService = new ActivityService();
const notificationService = new NotificationService();

/**
 * Creates a draft closure request for a project.
 */
export async function createProjectClosure(
  projectId: string,
  userId: string,
  data: { summary?: string; completionNotes?: string }
): Promise<ProjectClosureType> {
  const db = getDb();

  // Check if an active non-completed closure request already exists
  const existingActive = await db
    .select()
    .from(projectClosures)
    .where(
      and(
        eq(projectClosures.projectId, projectId),
        inArray(projectClosures.status, ['draft', 'pending_client_approval', 'changes_requested'])
      )
    )
    .limit(1);

  if (existingActive.length > 0) {
    return fetchClosureById(existingActive[0].id);
  }

  const [closure] = await db
    .insert(projectClosures)
    .values({
      projectId,
      createdBy: userId,
      summary: data.summary,
      completionNotes: data.completionNotes,
      status: 'draft',
    })
    .returning();

  await activityService.recordActivity({
    projectId,
    actorId: userId,
    type: 'closure_created',
    entityType: 'project_closure',
    entityId: closure.id,
    metadata: { summary: data.summary },
  });

  broadcastToProject(projectId, {
    type: 'closure.created',
    projectId,
    closure: await fetchClosureById(closure.id),
  });

  return fetchClosureById(closure.id);
}

/**
 * Submits a closure request for client approval.
 */
export async function submitProjectClosure(
  closureId: string,
  userId: string,
  notes?: string
): Promise<ProjectClosureType> {
  const db = getDb();

  const [closure] = await db
    .select()
    .from(projectClosures)
    .where(eq(projectClosures.id, closureId))
    .limit(1);

  if (!closure) {
    throw new Error('Closure request not found');
  }

  if (closure.status !== 'draft' && closure.status !== 'changes_requested') {
    throw new Error(`Cannot submit closure in status "${closure.status}"`);
  }

  // Verify eligibility (or throw error with blockers)
  const eligibility = await checkProjectCompletionEligibility(closure.projectId);
  if (!eligibility.eligible) {
    const blockerMsgs = eligibility.blockers.map((b) => b.label).join('; ');
    throw new Error(`Project is not eligible for closure due to blockers: ${blockerMsgs}`);
  }

  const submittedAt = new Date();
  await db
    .update(projectClosures)
    .set({
      status: 'pending_client_approval',
      submittedAt,
      completionNotes: notes || closure.completionNotes,
      updatedAt: submittedAt,
    })
    .where(eq(projectClosures.id, closureId));

  // Update project status to client_review / closure_requested
  await db
    .update(projects)
    .set({
      status: 'client_review',
      updatedAt: submittedAt,
    })
    .where(eq(projects.id, closure.projectId));

  await activityService.recordActivity({
    projectId: closure.projectId,
    actorId: userId,
    type: 'closure_submitted',
    entityType: 'project_closure',
    entityId: closure.id,
    metadata: { notes },
  });

  // Notify Project Clients
  const proj = (await db.select().from(projects).where(eq(projects.id, closure.projectId)).limit(1))[0];
  const targetClients = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, closure.projectId), eq(projectMembers.role, 'client')));

  for (const clientMember of targetClients) {
    if (clientMember.userId !== userId) {
      await notificationService.createNotification({
        userId: clientMember.userId,
        organizationId: proj.organizationId,
        projectId: closure.projectId,
        type: 'closure_submitted',
        title: 'Project Completion Review Requested',
        body: `Development team submitted final closure request for review.`,
        entityType: 'project_closure',
        entityId: closure.id,
      });
    }
  }

  const updatedClosure = await fetchClosureById(closureId);

  broadcastToProject(closure.projectId, {
    type: 'closure.submitted',
    projectId: closure.projectId,
    closure: updatedClosure,
  });

  return updatedClosure;
}

/**
 * Client approves final project completion.
 */
export async function approveProjectClosure(
  closureId: string,
  clientId: string,
  comment?: string
): Promise<{ closure: ProjectClosureType; handoff: ProjectHandoffType }> {
  const db = getDb();

  const [closure] = await db
    .select()
    .from(projectClosures)
    .where(eq(projectClosures.id, closureId))
    .limit(1);

  if (!closure) {
    throw new Error('Closure request not found');
  }

  if (closure.status !== 'pending_client_approval') {
    throw new Error(`Cannot approve closure in status "${closure.status}"`);
  }

  const now = new Date();

  // 1. Record client review record
  await db.insert(closureReviews).values({
    closureId,
    clientId,
    status: 'approved',
    comment,
    resolvedAt: now,
  });

  // 2. Update closure status to approved & completed
  await db
    .update(projectClosures)
    .set({
      status: 'completed',
      approvedAt: now,
      approvedBy: clientId,
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(projectClosures.id, closureId));

  // 3. Mark project as completed!
  await db
    .update(projects)
    .set({
      status: 'completed',
      updatedAt: now,
    })
    .where(eq(projects.id, closure.projectId));

  // 4. Update completion checklist item for client approval
  await db
    .update(projectCompletionChecklist)
    .set({
      status: 'completed',
      completedBy: clientId,
      completedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(projectCompletionChecklist.projectId, closure.projectId),
        eq(projectCompletionChecklist.key, 'client_approved')
      )
    );

  // 5. Generate Project Handoff Record
  const handoff = await generateProjectHandoff(closure.id, clientId);

  // 6. Log immutable project activity
  await activityService.recordActivity({
    projectId: closure.projectId,
    actorId: clientId,
    type: 'closure_approved',
    entityType: 'project_closure',
    entityId: closure.id,
    metadata: { comment },
  });

  await activityService.recordActivity({
    projectId: closure.projectId,
    actorId: clientId,
    type: 'project_completed',
    entityType: 'project',
    entityId: closure.projectId,
  });

  // 7. Send notifications to developers
  const proj = (await db.select().from(projects).where(eq(projects.id, closure.projectId)).limit(1))[0];
  const targetDevelopers = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, closure.projectId), eq(projectMembers.role, 'developer')));

  for (const devMember of targetDevelopers) {
    if (devMember.userId !== clientId) {
      await notificationService.createNotification({
        userId: devMember.userId,
        organizationId: proj.organizationId,
        projectId: closure.projectId,
        type: 'closure_approved',
        title: 'Project Completion Approved!',
        body: `Client approved the final project completion.`,
        entityType: 'project_closure',
        entityId: closure.id,
      });

      await notificationService.createNotification({
        userId: devMember.userId,
        organizationId: proj.organizationId,
        projectId: closure.projectId,
        type: 'project_completed',
        title: 'Project Closed & Completed',
        body: `Project "${proj.name}" is now formally completed and closed.`,
        entityType: 'project',
        entityId: closure.projectId,
      });
    }
  }

  const updatedClosure = await fetchClosureById(closureId);

  broadcastToProject(closure.projectId, {
    type: 'closure.approved',
    projectId: closure.projectId,
    closure: updatedClosure,
  });

  broadcastToProject(closure.projectId, {
    type: 'project.completed',
    projectId: closure.projectId,
  });

  return {
    closure: updatedClosure,
    handoff,
  };
}

/**
 * Client requests final changes during closure review.
 */
export async function requestClosureChanges(
  closureId: string,
  clientId: string,
  data: { comment: string; description?: string }
): Promise<{ closure: ProjectClosureType; revisionRequest: ClosureRevisionRequestType }> {
  const db = getDb();

  const [closure] = await db
    .select()
    .from(projectClosures)
    .where(eq(projectClosures.id, closureId))
    .limit(1);

  if (!closure) {
    throw new Error('Closure request not found');
  }

  if (closure.status !== 'pending_client_approval') {
    throw new Error(`Cannot request changes on closure in status "${closure.status}"`);
  }

  const now = new Date();

  // 1. Record client review record
  await db.insert(closureReviews).values({
    closureId,
    clientId,
    status: 'changes_requested',
    comment: data.comment,
  });

  // 2. Insert revision request
  const [revision] = await db
    .insert(closureRevisionRequests)
    .values({
      closureId,
      clientId,
      description: data.description || data.comment,
      status: 'open',
    })
    .returning();

  // 3. Update closure status to changes_requested
  await db
    .update(projectClosures)
    .set({
      status: 'changes_requested',
      updatedAt: now,
    })
    .where(eq(projectClosures.id, closureId));

  // 4. Update project status to changes_requested
  await db
    .update(projects)
    .set({
      status: 'changes_requested',
      updatedAt: now,
    })
    .where(eq(projects.id, closure.projectId));

  // 5. Log activity
  await activityService.recordActivity({
    projectId: closure.projectId,
    actorId: clientId,
    type: 'closure_changes_requested',
    entityType: 'project_closure',
    entityId: closure.id,
    metadata: { comment: data.comment, revisionId: revision.id },
  });

  // 6. Notify Developers
  const proj = (await db.select().from(projects).where(eq(projects.id, closure.projectId)).limit(1))[0];
  const targetDevelopers = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, closure.projectId), eq(projectMembers.role, 'developer')));

  for (const devMember of targetDevelopers) {
    if (devMember.userId !== clientId) {
      await notificationService.createNotification({
        userId: devMember.userId,
        organizationId: proj.organizationId,
        projectId: closure.projectId,
        type: 'closure_changes_requested',
        title: 'Completion Changes Requested',
        body: `Client requested changes on project closure: "${data.comment}"`,
        entityType: 'project_closure',
        entityId: closure.id,
      });
    }
  }

  const updatedClosure = await fetchClosureById(closureId);
  const updatedRevision = await fetchClosureRevisionById(revision.id);

  broadcastToProject(closure.projectId, {
    type: 'closure.changes_requested',
    projectId: closure.projectId,
    closure: updatedClosure,
    revisionRequest: updatedRevision,
  });

  return {
    closure: updatedClosure,
    revisionRequest: updatedRevision,
  };
}

/**
 * Generates the project handoff record.
 */
export async function generateProjectHandoff(
  closureId: string,
  userId: string
): Promise<ProjectHandoffType> {
  const db = getDb();

  const [closure] = await db
    .select()
    .from(projectClosures)
    .where(eq(projectClosures.id, closureId))
    .limit(1);

  if (!closure) {
    throw new Error('Closure request not found');
  }

  // Count deliverables and work items
  const allDeliverables = await db
    .select()
    .from(deliverables)
    .where(eq(deliverables.projectId, closure.projectId));

  const approvedDeliverables = allDeliverables.filter((d) => d.status === 'approved');

  const allWork = await db
    .select()
    .from(workItems)
    .where(eq(workItems.projectId, closure.projectId));

  const completedWork = allWork.filter((w) => w.status === 'completed');

  const now = new Date();

  // Check if handoff record exists for this closure
  const existingHandoff = await db
    .select()
    .from(projectHandoffs)
    .where(eq(projectHandoffs.closureId, closureId))
    .limit(1);

  let handoffId: string;

  if (existingHandoff.length > 0) {
    handoffId = existingHandoff[0].id;
    await db
      .update(projectHandoffs)
      .set({
        handoffStatus: 'delivered',
        deliveredAt: now,
        deliverablesCount: allDeliverables.length,
        completedWorkCount: completedWork.length,
        approvedDeliverablesCount: approvedDeliverables.length,
        updatedAt: now,
      })
      .where(eq(projectHandoffs.id, handoffId));
  } else {
    const [inserted] = await db
      .insert(projectHandoffs)
      .values({
        projectId: closure.projectId,
        closureId,
        handoffStatus: 'delivered',
        summary: closure.summary || 'Final project delivery and handoff package.',
        deliverablesCount: allDeliverables.length,
        completedWorkCount: completedWork.length,
        approvedDeliverablesCount: approvedDeliverables.length,
        createdBy: userId,
        deliveredAt: now,
      })
      .returning();
    handoffId = inserted.id;

    // Create client-safe handoff items for each approved deliverable
    let pos = 1;
    for (const deliv of approvedDeliverables) {
      await db.insert(handoffItems).values({
        handoffId,
        type: 'deliverable',
        title: deliv.title,
        description: deliv.description,
        referenceId: deliv.id,
        position: pos++,
      });
    }
  }

  await activityService.recordActivity({
    projectId: closure.projectId,
    actorId: userId,
    type: 'handoff_delivered',
    entityType: 'project_handoff',
    entityId: handoffId,
  });

  const finalHandoff = await fetchHandoffById(handoffId);

  broadcastToProject(closure.projectId, {
    type: 'handoff.delivered',
    projectId: closure.projectId,
    handoff: finalHandoff,
  });

  return finalHandoff;
}

/**
 * Acknowledge Project Handoff
 */
export async function acknowledgeProjectHandoff(
  handoffId: string,
  clientId: string
): Promise<ProjectHandoffType> {
  const db = getDb();

  const [handoff] = await db
    .select()
    .from(projectHandoffs)
    .where(eq(projectHandoffs.id, handoffId))
    .limit(1);

  if (!handoff) {
    throw new Error('Handoff record not found');
  }

  const now = new Date();

  await db
    .update(projectHandoffs)
    .set({
      handoffStatus: 'acknowledged',
      acknowledgedAt: now,
      acknowledgedBy: clientId,
      updatedAt: now,
    })
    .where(eq(projectHandoffs.id, handoffId));

  await activityService.recordActivity({
    projectId: handoff.projectId,
    actorId: clientId,
    type: 'handoff_acknowledged',
    entityType: 'project_handoff',
    entityId: handoffId,
  });

  const updatedHandoff = await fetchHandoffById(handoffId);

  broadcastToProject(handoff.projectId, {
    type: 'handoff.acknowledged',
    projectId: handoff.projectId,
    handoff: updatedHandoff,
  });

  return updatedHandoff;
}

/**
 * Fetch closure by ID with relations.
 */
export async function fetchClosureById(closureId: string): Promise<ProjectClosureType> {
  const db = getDb();

  const [closure] = await db
    .select({
      c: projectClosures,
      creator: users,
    })
    .from(projectClosures)
    .leftJoin(users, eq(projectClosures.createdBy, users.id))
    .where(eq(projectClosures.id, closureId))
    .limit(1);

  if (!closure) {
    throw new Error('Closure request not found');
  }

  let approverName: string | undefined;
  if (closure.c.approvedBy) {
    const [appUser] = await db.select().from(users).where(eq(users.id, closure.c.approvedBy)).limit(1);
    approverName = appUser?.name;
  }

  // Fetch reviews
  const reviewsList = await db
    .select({
      rev: closureReviews,
      client: users,
    })
    .from(closureReviews)
    .leftJoin(users, eq(closureReviews.clientId, users.id))
    .where(eq(closureReviews.closureId, closureId))
    .orderBy(desc(closureReviews.createdAt));

  const reviews: ClosureReviewType[] = reviewsList.map(({ rev, client }) => ({
    id: rev.id,
    closureId: rev.closureId,
    clientId: rev.clientId,
    status: rev.status as any,
    comment: rev.comment,
    createdAt: rev.createdAt.toISOString(),
    updatedAt: rev.updatedAt.toISOString(),
    resolvedAt: rev.resolvedAt ? rev.resolvedAt.toISOString() : undefined,
    clientName: client?.name,
  }));

  // Fetch revisions
  const revisionsList = await db
    .select({
      rev: closureRevisionRequests,
      client: users,
    })
    .from(closureRevisionRequests)
    .leftJoin(users, eq(closureRevisionRequests.clientId, users.id))
    .where(eq(closureRevisionRequests.closureId, closureId))
    .orderBy(desc(closureRevisionRequests.createdAt));

  const revisions: ClosureRevisionRequestType[] = revisionsList.map(({ rev, client }) => ({
    id: rev.id,
    closureId: rev.closureId,
    clientId: rev.clientId,
    description: rev.description,
    status: rev.status as any,
    resolvedBy: rev.resolvedBy || undefined,
    createdAt: rev.createdAt.toISOString(),
    resolvedAt: rev.resolvedAt ? rev.resolvedAt.toISOString() : undefined,
    clientName: client?.name,
  }));

  // Fetch handoff
  const handoffs = await db
    .select()
    .from(projectHandoffs)
    .where(eq(projectHandoffs.closureId, closureId))
    .limit(1);

  let handoff: ProjectHandoffType | null = null;
  if (handoffs.length > 0) {
    handoff = await fetchHandoffById(handoffs[0].id);
  }

  return {
    id: closure.c.id,
    projectId: closure.c.projectId,
    status: closure.c.status as any,
    summary: closure.c.summary,
    completionNotes: closure.c.completionNotes,
    createdBy: closure.c.createdBy,
    submittedAt: closure.c.submittedAt ? closure.c.submittedAt.toISOString() : undefined,
    approvedAt: closure.c.approvedAt ? closure.c.approvedAt.toISOString() : undefined,
    approvedBy: closure.c.approvedBy || undefined,
    completedAt: closure.c.completedAt ? closure.c.completedAt.toISOString() : undefined,
    createdAt: closure.c.createdAt.toISOString(),
    updatedAt: closure.c.updatedAt.toISOString(),
    creatorName: closure.creator?.name,
    approverName,
    reviews,
    revisions,
    handoff,
  };
}

/**
 * Fetch Handoff by ID
 */
export async function fetchHandoffById(handoffId: string): Promise<ProjectHandoffType> {
  const db = getDb();

  const [h] = await db
    .select({
      handoff: projectHandoffs,
      creator: users,
    })
    .from(projectHandoffs)
    .leftJoin(users, eq(projectHandoffs.createdBy, users.id))
    .where(eq(projectHandoffs.id, handoffId))
    .limit(1);

  if (!h) {
    throw new Error('Handoff not found');
  }

  let ackName: string | undefined;
  if (h.handoff.acknowledgedBy) {
    const [ackUser] = await db.select().from(users).where(eq(users.id, h.handoff.acknowledgedBy)).limit(1);
    ackName = ackUser?.name;
  }

  const itemsList = await db
    .select()
    .from(handoffItems)
    .where(eq(handoffItems.handoffId, handoffId))
    .orderBy(handoffItems.position);

  const items: HandoffItemType[] = itemsList.map((item) => ({
    id: item.id,
    handoffId: item.handoffId,
    type: item.type as any,
    title: item.title,
    description: item.description,
    referenceId: item.referenceId || undefined,
    referenceUrl: item.referenceUrl || undefined,
    position: item.position,
    createdAt: item.createdAt.toISOString(),
  }));

  return {
    id: h.handoff.id,
    projectId: h.handoff.projectId,
    closureId: h.handoff.closureId,
    handoffStatus: h.handoff.handoffStatus as any,
    summary: h.handoff.summary,
    deliverablesCount: h.handoff.deliverablesCount,
    completedWorkCount: h.handoff.completedWorkCount,
    approvedDeliverablesCount: h.handoff.approvedDeliverablesCount,
    createdBy: h.handoff.createdBy,
    deliveredAt: h.handoff.deliveredAt ? h.handoff.deliveredAt.toISOString() : undefined,
    acknowledgedAt: h.handoff.acknowledgedAt ? h.handoff.acknowledgedAt.toISOString() : undefined,
    acknowledgedBy: h.handoff.acknowledgedBy || undefined,
    createdAt: h.handoff.createdAt.toISOString(),
    updatedAt: h.handoff.updatedAt.toISOString(),
    creatorName: h.creator?.name,
    acknowledgedByName: ackName,
    items,
  };
}

/**
 * Fetch closure revision request by ID
 */
export async function fetchClosureRevisionById(
  revisionId: string
): Promise<ClosureRevisionRequestType> {
  const db = getDb();

  const [rev] = await db
    .select({
      r: closureRevisionRequests,
      client: users,
    })
    .from(closureRevisionRequests)
    .leftJoin(users, eq(closureRevisionRequests.clientId, users.id))
    .where(eq(closureRevisionRequests.id, revisionId))
    .limit(1);

  if (!rev) {
    throw new Error('Revision request not found');
  }

  let resolverName: string | undefined;
  if (rev.r.resolvedBy) {
    const [resUser] = await db.select().from(users).where(eq(users.id, rev.r.resolvedBy)).limit(1);
    resolverName = resUser?.name;
  }

  return {
    id: rev.r.id,
    closureId: rev.r.closureId,
    clientId: rev.r.clientId,
    description: rev.r.description,
    status: rev.r.status as any,
    resolvedBy: rev.r.resolvedBy || undefined,
    createdAt: rev.r.createdAt.toISOString(),
    resolvedAt: rev.r.resolvedAt ? rev.r.resolvedAt.toISOString() : undefined,
    clientName: rev.client?.name,
    resolverName,
  };
}
