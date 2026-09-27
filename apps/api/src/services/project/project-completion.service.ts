import { eq, and, ne, inArray } from 'drizzle-orm';
import { getDb } from '../../config/database.js';
import {
  workItems,
  deliverables,
  revisionRequests,
  projectMilestones,
  projectCompletionChecklist,
  users,
} from '../../db/schema/index.js';
import {
  ProjectCompletionBlocker,
  ProjectCompletionEligibility,
  ProjectCompletionChecklist as ProjectCompletionChecklistType,
} from '@intentflow/types';

export const DEFAULT_CHECKLIST_ITEMS = [
  { key: 'work_completed', label: 'All work items completed', required: true },
  { key: 'deliverables_approved', label: 'All required deliverables approved', required: true },
  { key: 'revisions_resolved', label: 'Open revision requests resolved', required: true },
  { key: 'files_prepared', label: 'Final files prepared', required: true },
  { key: 'handoff_prepared', label: 'Final handoff prepared', required: true },
  { key: 'client_approved', label: 'Client approval received', required: true },
];

/**
 * Ensures a project has initial completion checklist items created.
 */
export async function ensureProjectChecklist(
  projectId: string,
  userId?: string
): Promise<ProjectCompletionChecklistType[]> {
  const db = getDb();

  const existing = await db
    .select()
    .from(projectCompletionChecklist)
    .where(eq(projectCompletionChecklist.projectId, projectId));

  if (existing.length === 0) {
    const toInsert = DEFAULT_CHECKLIST_ITEMS.map((item) => ({
      projectId,
      key: item.key,
      label: item.label,
      status: 'pending' as const,
      required: item.required,
    }));

    await db.insert(projectCompletionChecklist).values(toInsert);
  }

  const list = await db
    .select({
      item: projectCompletionChecklist,
      completedUser: users,
    })
    .from(projectCompletionChecklist)
    .leftJoin(users, eq(projectCompletionChecklist.completedBy, users.id))
    .where(eq(projectCompletionChecklist.projectId, projectId));

  return list.map(({ item, completedUser }) => ({
    id: item.id,
    projectId: item.projectId,
    key: item.key,
    label: item.label,
    status: item.status as any,
    required: item.required,
    completedBy: item.completedBy ?? undefined,
    completedAt: item.completedAt ? item.completedAt.toISOString() : undefined,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    completedByName: completedUser?.name,
  }));
}

/**
 * Checks project closure eligibility and returns blockers if any.
 */
export async function checkProjectCompletionEligibility(
  projectId: string
): Promise<ProjectCompletionEligibility> {
  const db = getDb();
  const blockers: ProjectCompletionBlocker[] = [];

  // 1. Fetch Work Items
  const allWorkItems = await db
    .select()
    .from(workItems)
    .where(eq(workItems.projectId, projectId));

  const totalWorkCount = allWorkItems.length;
  const incompleteWorkItems = allWorkItems.filter(
    (wi) => wi.status !== 'completed' && wi.status !== 'cancelled'
  );
  const completedWorkCount = totalWorkCount - incompleteWorkItems.length;

  for (const wi of incompleteWorkItems) {
    blockers.push({
      key: 'incomplete_work_item',
      label: `Work item "${wi.title}" is in status "${wi.status}"`,
      entityType: 'work_item',
      entityId: wi.id,
    });
  }

  // 2. Fetch Deliverables
  const allDeliverables = await db
    .select()
    .from(deliverables)
    .where(eq(deliverables.projectId, projectId));

  const totalDeliverablesCount = allDeliverables.length;
  const unapprovedDeliverables = allDeliverables.filter(
    (d) => d.status !== 'approved' && d.status !== 'archived'
  );
  const approvedDeliverablesCount = totalDeliverablesCount - unapprovedDeliverables.length;

  for (const deliv of unapprovedDeliverables) {
    blockers.push({
      key: 'unapproved_deliverable',
      label: `Deliverable "${deliv.title}" is not approved (status: "${deliv.status}")`,
      entityType: 'deliverable',
      entityId: deliv.id,
    });
  }

  // 3. Fetch Deliverable Revision Requests
  if (allDeliverables.length > 0) {
    const deliverableIds = allDeliverables.map((d) => d.id);
    const openRevisions = await db
      .select()
      .from(revisionRequests)
      .where(
        and(
          inArray(revisionRequests.deliverableId, deliverableIds),
          inArray(revisionRequests.status, ['open', 'in_progress'])
        )
      );

    for (const rev of openRevisions) {
      blockers.push({
        key: 'open_deliverable_revision',
        label: `Deliverable revision request "${rev.description}" is still open`,
        entityType: 'revision_request',
        entityId: rev.id,
      });
    }
  }

  // 4. Fetch Milestones
  const milestones = await db
    .select()
    .from(projectMilestones)
    .where(eq(projectMilestones.projectId, projectId));

  const blockedMilestones = milestones.filter((m) => m.status === 'blocked');
  for (const m of blockedMilestones) {
    blockers.push({
      key: 'blocked_milestone',
      label: `Milestone "${m.title}" is currently blocked`,
      entityType: 'project_milestone',
      entityId: m.id,
    });
  }

  // 5. Fetch Required Checklist Items
  const checklist = await ensureProjectChecklist(projectId);
  const incompleteChecklist = checklist.filter(
    (item) => item.required && item.key !== 'client_approved' && item.status !== 'completed'
  );

  for (const chk of incompleteChecklist) {
    blockers.push({
      key: `checklist_${chk.key}`,
      label: `Required checklist item "${chk.label}" is incomplete`,
      entityType: 'completion_checklist',
      entityId: chk.id,
    });
  }

  return {
    eligible: blockers.length === 0,
    blockers,
    completedWorkCount,
    totalWorkCount,
    approvedDeliverablesCount,
    totalDeliverablesCount,
  };
}
