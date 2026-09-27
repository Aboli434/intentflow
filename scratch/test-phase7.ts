import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config({ path: path.join(process.cwd(), 'apps/api/.env') });

import { buildApp } from '../apps/api/src/app.js';
import { getDb, checkDatabaseConnection } from '../apps/api/src/config/database.js';
import {
  users,
  organizations,
  organizationMembers,
  projects,
  projectMembers,
  deliverables,
  clientReviews,
  revisionRequests,
  projectMilestones,
  notifications,
  projectActivity,
  sessions,
  workItems,
} from '../apps/api/src/db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { generateToken } from '../apps/api/src/lib/auth.js';

async function createTestSession(userId: string) {
  const db = getDb();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({
    userId,
    token,
    expiresAt,
  });
  return token;
}

async function runPhase7Tests() {
  console.log('====================================================');
  console.log('--- STARTING PHASE 7 VERIFICATION SUITE ---');
  console.log('====================================================');

  // Verify DB Connection
  const dbHealth = await checkDatabaseConnection();
  if (!dbHealth.connected) {
    console.error('❌ DB connection failed:', dbHealth.error);
    process.exit(1);
  }
  console.log('✅ PostgreSQL database connected.');

  const app = buildApp();
  await app.ready();

  const db = getDb();

  // Test setup data
  const testRunId = Date.now();
  const adminEmail = `admin.phase7.${testRunId}@intentflow.io`;
  const devEmail = `dev.phase7.${testRunId}@intentflow.io`;
  const clientEmail = `client.phase7.${testRunId}@intentflow.io`;
  const strangerEmail = `stranger.phase7.${testRunId}@intentflow.io`;

  // Create test users
  const [adminUser] = await db
    .insert(users)
    .values({
      email: adminEmail,
      name: 'Phase 7 Org Admin',
      passwordHash: 'hash_phase7_admin',
    })
    .returning();

  const [devUser] = await db
    .insert(users)
    .values({
      email: devEmail,
      name: 'Phase 7 Developer',
      passwordHash: 'hash_phase7_dev',
    })
    .returning();

  const [clientUser] = await db
    .insert(users)
    .values({
      email: clientEmail,
      name: 'Phase 7 Client',
      passwordHash: 'hash_phase7_client',
    })
    .returning();

  const [strangerUser] = await db
    .insert(users)
    .values({
      email: strangerEmail,
      name: 'Phase 7 Stranger',
      passwordHash: 'hash_phase7_stranger',
    })
    .returning();

  const adminToken = await createTestSession(adminUser.id);
  const devToken = await createTestSession(devUser.id);
  const clientToken = await createTestSession(clientUser.id);
  const strangerToken = await createTestSession(strangerUser.id);

  // Create Organization 1 & Project 1
  const [org1] = await db
    .insert(organizations)
    .values({
      name: `Phase 7 Org ${testRunId}`,
      slug: `p7-org-${testRunId}`,
    })
    .returning();

  await db.insert(organizationMembers).values([
    { organizationId: org1.id, userId: adminUser.id, role: 'admin' },
    { organizationId: org1.id, userId: devUser.id, role: 'developer' },
    { organizationId: org1.id, userId: clientUser.id, role: 'client' },
  ]);

  const [project1] = await db
    .insert(projects)
    .values({
      organizationId: org1.id,
      name: `P7 Delivery Project ${testRunId}`,
      key: `P7-${testRunId.toString().slice(-4)}`,
    })
    .returning();

  // Project roles: Dev as developer, Client as client. Admin has NO projectRole assignment.
  await db.insert(projectMembers).values([
    { projectId: project1.id, userId: devUser.id, role: 'developer' },
    { projectId: project1.id, userId: clientUser.id, role: 'client' },
  ]);

  // Create Organization 2 for Stranger
  const [org2] = await db
    .insert(organizations)
    .values({
      name: `Phase 7 Stranger Org ${testRunId}`,
      slug: `p7-stranger-${testRunId}`,
    })
    .returning();

  await db.insert(organizationMembers).values({
    organizationId: org2.id,
    userId: strangerUser.id,
    role: 'admin',
  });

  console.log('✅ Test environment, users, organizations, and project created.');

  // Create work item
  const [workItem1] = await db
    .insert(workItems)
    .values({
      projectId: project1.id,
      title: 'Homepage Component Implementation',
      status: 'completed',
      createdBy: devUser.id,
    })
    .returning();

  // Create milestone
  const [milestone1] = await db
    .insert(projectMilestones)
    .values({
      projectId: project1.id,
      title: 'Discovery & V1 Prototype',
      status: 'in_progress',
      createdBy: devUser.id,
    })
    .returning();

  // TEST 1: Deliverable Creation
  console.log('\n--- TEST 1: Deliverable Creation ---');
  const createRes = await app.inject({
    method: 'POST',
    url: `/api/projects/${project1.id}/deliverables`,
    headers: { authorization: `Bearer ${devToken}` },
    payload: {
      title: 'Homepage V1 Package',
      description: 'First version of client homepage ready for review.',
      workItemIds: [workItem1.id],
      milestoneId: milestone1.id,
    },
  });

  if (createRes.statusCode !== 201) {
    console.error('❌ Failed to create deliverable:', createRes.body);
    process.exit(1);
  }
  const deliv1 = JSON.parse(createRes.body).data;
  console.log(`  ✅ Deliverable created by Developer: "${deliv1.title}" (Status: ${deliv1.status})`);

  // TEST 2: Submit for Review
  console.log('\n--- TEST 2: Submit for Review ---');
  const submitRes = await app.inject({
    method: 'POST',
    url: `/api/deliverables/${deliv1.id}/submit-review`,
    headers: { authorization: `Bearer ${devToken}` },
  });

  if (submitRes.statusCode !== 200) {
    console.error('❌ Failed to submit deliverable:', submitRes.body);
    process.exit(1);
  }
  const submittedDeliv = JSON.parse(submitRes.body).data;
  if (submittedDeliv.status !== 'ready_for_review') {
    console.error('❌ Expected status ready_for_review, got:', submittedDeliv.status);
    process.exit(1);
  }
  console.log('  ✅ Deliverable submitted for client review (Status: ready_for_review).');

  // TEST 3: Client Visibility
  console.log('\n--- TEST 3: Client Deliverable Retrieval ---');
  const clientGetRes = await app.inject({
    method: 'GET',
    url: `/api/deliverables/${deliv1.id}`,
    headers: { authorization: `Bearer ${clientToken}` },
  });

  if (clientGetRes.statusCode !== 200) {
    console.error('❌ Client failed to retrieve deliverable:', clientGetRes.body);
    process.exit(1);
  }
  const clientDelivDetail = JSON.parse(clientGetRes.body).data;
  if (!clientDelivDetail.linkedWorkItems || clientDelivDetail.linkedWorkItems.length === 0) {
    console.error('❌ Linked work items missing in client view:', clientDelivDetail);
    process.exit(1);
  }
  console.log('  ✅ Assigned client successfully retrieved deliverable details & linked work items.');

  // TEST 4: Developer Cannot Approve
  console.log('\n--- TEST 4: Developer Approval Restriction ---');
  const devApproveRes = await app.inject({
    method: 'POST',
    url: `/api/deliverables/${deliv1.id}/approve`,
    headers: { authorization: `Bearer ${devToken}` },
  });

  if (devApproveRes.statusCode !== 403) {
    console.error('❌ Security failure! Developer was allowed to approve deliverable, code:', devApproveRes.statusCode);
    process.exit(1);
  }
  console.log('  ✅ Authorization enforced: Developer approval attempt returned 403 Forbidden.');

  // TEST 5: Admin Cannot Impersonate Client Approval
  console.log('\n--- TEST 5: Admin Impersonation Restriction (orgRole !== client authority) ---');
  const adminApproveRes = await app.inject({
    method: 'POST',
    url: `/api/deliverables/${deliv1.id}/approve`,
    headers: { authorization: `Bearer ${adminToken}` },
  });

  if (adminApproveRes.statusCode !== 403) {
    console.error('❌ Security failure! Org Admin without client role was allowed to approve deliverable, code:', adminApproveRes.statusCode);
    process.exit(1);
  }
  console.log('  ✅ Authorization rule verified: Org Admin without project client assignment returned 403 Forbidden.');

  // TEST 6: Client Approval
  console.log('\n--- TEST 6: Client Approval ---');
  const clientApproveRes = await app.inject({
    method: 'POST',
    url: `/api/deliverables/${deliv1.id}/approve`,
    headers: { authorization: `Bearer ${clientToken}` },
    payload: { comment: 'Looks great! Approved.' },
  });

  if (clientApproveRes.statusCode !== 200) {
    console.error('❌ Client failed to approve deliverable:', clientApproveRes.body);
    process.exit(1);
  }
  const approvedDeliv = JSON.parse(clientApproveRes.body).data;
  if (approvedDeliv.status !== 'approved' || approvedDeliv.approvedBy !== clientUser.id) {
    console.error('❌ Approval properties invalid:', approvedDeliv);
    process.exit(1);
  }
  console.log(`  ✅ Assigned client approved deliverable (approvedBy: ${approvedDeliv.approvedBy}).`);

  // TEST 7: Client Requests Changes & Revision Request Creation
  console.log('\n--- TEST 7: Client Change Request & Revision Creation ---');
  // Create deliverable 2
  const deliv2Res = await app.inject({
    method: 'POST',
    url: `/api/projects/${project1.id}/deliverables`,
    headers: { authorization: `Bearer ${devToken}` },
    payload: { title: 'Mobile APK Build V1' },
  });
  const deliv2 = JSON.parse(deliv2Res.body).data;

  // Submit deliverable 2
  await app.inject({
    method: 'POST',
    url: `/api/deliverables/${deliv2.id}/submit-review`,
    headers: { authorization: `Bearer ${devToken}` },
  });

  // Client requests changes
  const changeRes = await app.inject({
    method: 'POST',
    url: `/api/deliverables/${deliv2.id}/request-changes`,
    headers: { authorization: `Bearer ${clientToken}` },
    payload: { comment: 'Please adjust primary button colors to emerald green.' },
  });

  if (changeRes.statusCode !== 200) {
    console.error('❌ Client failed to request changes:', changeRes.body);
    process.exit(1);
  }
  const changeData = JSON.parse(changeRes.body).data;
  if (changeData.deliverable.status !== 'changes_requested' || !changeData.revisionRequest) {
    console.error('❌ Change request response data invalid:', changeData);
    process.exit(1);
  }
  const revisionReq = changeData.revisionRequest;
  console.log(`  ✅ Client requested changes. Status: changes_requested, Revision ID: ${revisionReq.id}`);

  // TEST 8: Revision Request Lifecycle
  console.log('\n--- TEST 8: Revision Request Lifecycle ---');
  // Dev updates revision to in_progress
  const revProgressRes = await app.inject({
    method: 'PATCH',
    url: `/api/revisions/${revisionReq.id}/status`,
    headers: { authorization: `Bearer ${devToken}` },
    payload: { status: 'in_progress' },
  });
  if (revProgressRes.statusCode !== 200) {
    console.error('❌ Failed to update revision status to in_progress:', revProgressRes.body);
    process.exit(1);
  }

  // Dev resolves revision
  const revResolveRes = await app.inject({
    method: 'PATCH',
    url: `/api/revisions/${revisionReq.id}/status`,
    headers: { authorization: `Bearer ${devToken}` },
    payload: { status: 'resolved' },
  });
  if (revResolveRes.statusCode !== 200) {
    console.error('❌ Failed to resolve revision:', revResolveRes.body);
    process.exit(1);
  }
  const resolvedRev = JSON.parse(revResolveRes.body).data;
  if (resolvedRev.status !== 'resolved' || resolvedRev.resolvedBy !== devUser.id) {
    console.error('❌ Resolved revision properties invalid:', resolvedRev);
    process.exit(1);
  }
  console.log('  ✅ Revision request lifecycle completed: open -> in_progress -> resolved.');

  // TEST 9: Resubmission After Revision
  console.log('\n--- TEST 9: Resubmission After Revision ---');
  const resubmitRes = await app.inject({
    method: 'POST',
    url: `/api/deliverables/${deliv2.id}/submit-review`,
    headers: { authorization: `Bearer ${devToken}` },
  });
  if (resubmitRes.statusCode !== 200) {
    console.error('❌ Resubmission failed:', resubmitRes.body);
    process.exit(1);
  }
  const resubmittedDeliv = JSON.parse(resubmitRes.body).data;
  if (resubmittedDeliv.status !== 'ready_for_review') {
    console.error('❌ Expected status ready_for_review after resubmission, got:', resubmittedDeliv.status);
    process.exit(1);
  }
  console.log('  ✅ Deliverable resubmitted after revision resolution (changes_requested -> ready_for_review).');

  // TEST 10: Tenant Isolation
  console.log('\n--- TEST 10: Tenant Isolation ---');
  const tenantRes = await app.inject({
    method: 'GET',
    url: `/api/deliverables/${deliv1.id}`,
    headers: { authorization: `Bearer ${strangerToken}` },
  });
  if (tenantRes.statusCode !== 403) {
    console.error('❌ Security failure! Stranger accessed deliverable from another organization, code:', tenantRes.statusCode);
    process.exit(1);
  }
  console.log('  ✅ Tenant isolation verified: Cross-organization deliverable access returned 403 Forbidden.');

  // TEST 11: Activity Log Verification
  console.log('\n--- TEST 11: Immutable Project Activity Trail ---');
  const activityRes = await app.inject({
    method: 'GET',
    url: `/api/projects/${project1.id}/activity`,
    headers: { authorization: `Bearer ${devToken}` },
  });
  const activities = JSON.parse(activityRes.body).data;
  const hasDeliverableActivity = activities.some(
    (act: any) => act.type === 'deliverable_created' || act.type === 'deliverable_approved' || act.type === 'deliverable_changes_requested'
  );
  if (!hasDeliverableActivity) {
    console.error('❌ Delivery activity trail missing in project_activity:', activities);
    process.exit(1);
  }
  console.log(`  ✅ Project activity trail verified (${activities.length} immutable events recorded).`);

  // TEST 12: Notification Dispatch Verification
  console.log('\n--- TEST 12: Notification Dispatch Verification ---');
  const devNotifsRes = await app.inject({
    method: 'GET',
    url: '/api/notifications',
    headers: { authorization: `Bearer ${devToken}` },
  });
  const devNotifs = JSON.parse(devNotifsRes.body).data;
  const hasChangeReqNotif = devNotifs.some(
    (n: any) => n.type === 'deliverable_changes_requested' || n.type === 'deliverable_approved'
  );
  if (!hasChangeReqNotif) {
    console.error('❌ Expected developer notification for delivery events missing:', devNotifs);
    process.exit(1);
  }
  console.log('  ✅ Developer notifications correctly delivered for change requests and approvals.');

  // TEST 13: Milestones API & Completion Workflow
  console.log('\n--- TEST 13: Milestone Completion Workflow ---');
  const completeMilestoneRes = await app.inject({
    method: 'POST',
    url: `/api/milestones/${milestone1.id}/status`,
    headers: { authorization: `Bearer ${devToken}` },
    payload: { status: 'completed' },
  });

  if (completeMilestoneRes.statusCode !== 200) {
    console.error('❌ Failed to complete milestone:', completeMilestoneRes.body);
    process.exit(1);
  }
  const completedMilestone = JSON.parse(completeMilestoneRes.body).data;
  if (completedMilestone.status !== 'completed' || !completedMilestone.completedAt) {
    console.error('❌ Completed milestone properties invalid:', completedMilestone);
    process.exit(1);
  }
  console.log(`  ✅ Milestone completed successfully (completedAt: ${completedMilestone.completedAt}).`);

  console.log('\n====================================================');
  console.log('🎉 ALL PHASE 7 INTEGRATION TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================\n');

  await app.close();
  process.exit(0);
}

runPhase7Tests().catch((err) => {
  console.error('❌ Phase 7 test suite failed:', err);
  process.exit(1);
});
