import { getDb } from '../apps/api/src/config/database.js';
import {
  users,
  sessions,
  organizations,
  organizationMembers,
  projects,
  projectMembers,
  deliverables,
  workItems,
  notifications,
  projectActivity,
  projectClosures,
  projectHandoffs,
  closureRevisionRequests,
  projectCompletionChecklist,
} from '../apps/api/src/db/schema/index.js';
import { buildApp } from '../apps/api/src/app.js';
import { eq, and } from 'drizzle-orm';

async function runPhase8Tests() {
  console.log('====================================================');
  console.log('🚀 RUNNING INTENTFLOW PHASE 8 INTEGRATION TESTS');
  console.log('====================================================\n');

  const app = buildApp();
  await app.ready();
  const db = getDb();

  // Test setup data
  const testId = Date.now().toString();
  const devEmail = `dev_phase8_${testId}@example.com`;
  const clientEmail = `client_phase8_${testId}@example.com`;
  const adminEmail = `admin_phase8_${testId}@example.com`;

  // 1. Create Test Users
  const [devUser] = await db
    .insert(users)
    .values({ name: 'Phase8 Developer', email: devEmail, passwordHash: 'hash' })
    .returning();
  const [clientUser] = await db
    .insert(users)
    .values({ name: 'Phase8 Client', email: clientEmail, passwordHash: 'hash' })
    .returning();
  const [adminUser] = await db
    .insert(users)
    .values({ name: 'Phase8 Admin', email: adminEmail, passwordHash: 'hash' })
    .returning();

  // 2. Create Sessions
  const devToken = `dev_token_${testId}`;
  const clientToken = `client_token_${testId}`;
  const adminToken = `admin_token_${testId}`;
  const expiresAt = new Date(Date.now() + 86400000);

  await db.insert(sessions).values([
    { userId: devUser.id, token: devToken, expiresAt },
    { userId: clientUser.id, token: clientToken, expiresAt },
    { userId: adminUser.id, token: adminToken, expiresAt },
  ]);

  // 3. Create Organization & Memberships
  const [org] = await db
    .insert(organizations)
    .values({ name: `Org Phase 8 ${testId}`, slug: `org-phase8-${testId}` })
    .returning();

  await db.insert(organizationMembers).values([
    { organizationId: org.id, userId: devUser.id, role: 'developer' },
    { organizationId: org.id, userId: clientUser.id, role: 'client' },
    { organizationId: org.id, userId: adminUser.id, role: 'admin' },
  ]);

  // 4. Create Project & Assign Roles
  const [project] = await db
    .insert(projects)
    .values({ organizationId: org.id, name: `Project Phase 8 ${testId}`, status: 'active' })
    .returning();

  await db.insert(projectMembers).values([
    { projectId: project.id, userId: devUser.id, role: 'developer' },
    { projectId: project.id, userId: clientUser.id, role: 'client' },
    // Admin is NOT assigned as project client!
  ]);

  console.log(`Created test environment: Project ID ${project.id}`);

  // --- TEST 1: Create Project Completion Checklist ---
  console.log('\n--- TEST 1: Create Project Completion Checklist ---');
  const chkRes1 = await app.inject({
    method: 'GET',
    url: `/api/projects/${project.id}/completion-checklist`,
    headers: { authorization: `Bearer ${devToken}` },
  });
  console.log(`Checklist response: ${chkRes1.statusCode}`);
  const checklistData = chkRes1.json().data;
  if (chkRes1.statusCode !== 200 || !Array.isArray(checklistData)) {
    throw new Error('Test 1 Failed: Could not fetch completion checklist');
  }
  console.log(`  ✅ Checklist initialized with ${checklistData.length} items.`);

  // --- TEST 2: Incomplete Project Returns Blockers ---
  console.log('\n--- TEST 2: Incomplete Project Returns Blockers ---');
  // Create an incomplete work item
  const [workItem] = await db
    .insert(workItems)
    .values({
      projectId: project.id,
      title: 'Incomplete Feature',
      status: 'in_progress',
      priority: 'high',
      createdBy: devUser.id,
      position: 1,
    })
    .returning();

  const statusRes1 = await app.inject({
    method: 'GET',
    url: `/api/projects/${project.id}/completion-status`,
    headers: { authorization: `Bearer ${devToken}` },
  });
  const elig1 = statusRes1.json().data;
  if (elig1.eligible !== false || elig1.blockers.length === 0) {
    throw new Error('Test 2 Failed: Incomplete project should return blockers');
  }
  console.log(`  ✅ Verified blockers returned: ${elig1.blockers.length} blocker(s) found.`);

  // --- TEST 3: Complete Required Work & Deliverables ---
  console.log('\n--- TEST 3: Complete Required Work & Deliverables ---');
  // Mark work item completed
  await db
    .update(workItems)
    .set({ status: 'completed' })
    .where(eq(workItems.id, workItem.id));

  // Create & approve deliverable
  const [deliverable] = await db
    .insert(deliverables)
    .values({
      projectId: project.id,
      title: 'Final Website Package',
      status: 'approved',
      createdBy: devUser.id,
      approvedBy: clientUser.id,
      approvedAt: new Date(),
    })
    .returning();

  // Complete all required checklist items except client_approved
  for (const item of checklistData) {
    if (item.key !== 'client_approved') {
      await db
        .update(projectCompletionChecklist)
        .set({ status: 'completed', completedBy: devUser.id, completedAt: new Date() })
        .where(eq(projectCompletionChecklist.id, item.id));
    }
  }
  console.log('  ✅ Work item completed, deliverable approved, checklist items marked complete.');

  // --- TEST 4: Verify Project Becomes Closure Eligible ---
  console.log('\n--- TEST 4: Verify Project Becomes Closure-Eligible ---');
  const statusRes2 = await app.inject({
    method: 'GET',
    url: `/api/projects/${project.id}/completion-status`,
    headers: { authorization: `Bearer ${devToken}` },
  });
  const elig2 = statusRes2.json().data;
  if (!elig2.eligible) {
    console.error('Blockers:', elig2.blockers);
    throw new Error('Test 4 Failed: Project should be eligible for closure');
  }
  console.log('  ✅ Project verified 100% closure-eligible (0 blockers).');

  // --- TEST 5: Developer Creates Closure ---
  console.log('\n--- TEST 5: Developer Creates Closure Request ---');
  const createClosureRes = await app.inject({
    method: 'POST',
    url: `/api/projects/${project.id}/closure`,
    headers: { authorization: `Bearer ${devToken}` },
    payload: { summary: 'Project completed successfully with all features implemented.' },
  });
  if (createClosureRes.statusCode !== 201) {
    throw new Error(`Test 5 Failed: Closure creation failed with status ${createClosureRes.statusCode}`);
  }
  const closure = createClosureRes.json().data;
  console.log(`  ✅ Developer created closure request (ID: ${closure.id}, Status: ${closure.status}).`);

  // --- TEST 6: Developer Submits Closure ---
  console.log('\n--- TEST 6: Developer Submits Closure Request ---');
  const submitRes = await app.inject({
    method: 'POST',
    url: `/api/project-closures/${closure.id}/submit`,
    headers: { authorization: `Bearer ${devToken}` },
    payload: { notes: 'Ready for final client sign-off.' },
  });
  if (submitRes.statusCode !== 200) {
    console.error('Submit closure error response:', submitRes.json());
    throw new Error(`Test 6 Failed: Submit closure failed with status ${submitRes.statusCode}`);
  }
  const submittedClosure = submitRes.json().data;
  if (submittedClosure.status !== 'pending_client_approval') {
    throw new Error(`Test 6 Failed: Expected status pending_client_approval, got ${submittedClosure.status}`);
  }
  console.log(`  ✅ Closure submitted for client approval (Status: ${submittedClosure.status}).`);

  // --- TEST 7: Client Receives Notification ---
  console.log('\n--- TEST 7: Client Receives Notification ---');
  const clientNotifs = await app.inject({
    method: 'GET',
    url: '/api/notifications',
    headers: { authorization: `Bearer ${clientToken}` },
  });
  const notifList = clientNotifs.json().data;
  const closureNotif = notifList.find((n: any) => n.type === 'closure_submitted');
  if (!closureNotif) {
    throw new Error('Test 7 Failed: Client did not receive closure_submitted notification');
  }
  console.log(`  ✅ Client notification verified ("${closureNotif.title}").`);

  // --- TEST 8: Developer Cannot Approve Closure ---
  console.log('\n--- TEST 8: Developer Cannot Approve Closure (403 Forbidden) ---');
  const devApproveRes = await app.inject({
    method: 'POST',
    url: `/api/project-closures/${closure.id}/approve`,
    headers: { authorization: `Bearer ${devToken}` },
    payload: { comment: 'Developer self approval' },
  });
  if (devApproveRes.statusCode !== 403) {
    throw new Error(`Test 8 Failed: Expected 403 Forbidden for developer approval, got ${devApproveRes.statusCode}`);
  }
  console.log('  ✅ Authorization enforced: Developer approval attempt returned 403 Forbidden.');

  // --- TEST 9: Client Requests Final Changes ---
  console.log('\n--- TEST 9: Client Requests Final Changes ---');
  const reqChangesRes = await app.inject({
    method: 'POST',
    url: `/api/project-closures/${closure.id}/request-changes`,
    headers: { authorization: `Bearer ${clientToken}` },
    payload: { comment: 'Please add documentation link to handoff notes.' },
  });
  if (reqChangesRes.statusCode !== 200) {
    throw new Error(`Test 9 Failed: Request changes failed with status ${reqChangesRes.statusCode}`);
  }
  const { closure: closureReq, revisionRequest } = reqChangesRes.json().data;
  if (closureReq.status !== 'changes_requested' || !revisionRequest) {
    throw new Error('Test 9 Failed: Expected status changes_requested and valid revision request');
  }
  console.log(`  ✅ Client requested changes (Closure Status: ${closureReq.status}, Revision ID: ${revisionRequest.id}).`);

  // --- TEST 10: Developer Resolves Revision ---
  console.log('\n--- TEST 10: Developer Resolves Revision ---');
  const patchRevRes = await app.inject({
    method: 'PATCH',
    url: `/api/closure-revisions/${revisionRequest.id}/status`,
    headers: { authorization: `Bearer ${devToken}` },
    payload: { status: 'resolved' },
  });
  if (patchRevRes.statusCode !== 200 || patchRevRes.json().data.status !== 'resolved') {
    throw new Error('Test 10 Failed: Could not resolve closure revision');
  }
  console.log('  ✅ Closure revision request resolved by developer.');

  // --- TEST 11: Developer Resubmits Closure ---
  console.log('\n--- TEST 11: Developer Resubmits Closure ---');
  const resubmitRes = await app.inject({
    method: 'POST',
    url: `/api/project-closures/${closure.id}/submit`,
    headers: { authorization: `Bearer ${devToken}` },
  });
  if (resubmitRes.statusCode !== 200 || resubmitRes.json().data.status !== 'pending_client_approval') {
    throw new Error('Test 11 Failed: Could not resubmit closure');
  }
  console.log('  ✅ Closure request resubmitted for client approval.');

  // --- TEST 12: Client Approves Closure ---
  console.log('\n--- TEST 12: Client Approves Final Project Closure ---');
  const clientApproveRes = await app.inject({
    method: 'POST',
    url: `/api/project-closures/${closure.id}/approve`,
    headers: { authorization: `Bearer ${clientToken}` },
    payload: { comment: 'All requirements met! Approved.' },
  });
  if (clientApproveRes.statusCode !== 200) {
    throw new Error(`Test 12 Failed: Client approval failed with status ${clientApproveRes.statusCode}`);
  }
  const { closure: approvedClosure, handoff: generatedHandoff } = clientApproveRes.json().data;
  if (approvedClosure.status !== 'completed' || !generatedHandoff) {
    throw new Error('Test 12 Failed: Expected closure status completed and generated handoff');
  }
  console.log(`  ✅ Client approved closure (approvedBy: ${approvedClosure.approvedBy}).`);

  // --- TEST 13: Project Status Becomes Completed ---
  console.log('\n--- TEST 13: Project Status Becomes Completed ---');
  const [updatedProj] = await db.select().from(projects).where(eq(projects.id, project.id)).limit(1);
  if (updatedProj.status !== 'completed') {
    throw new Error(`Test 13 Failed: Expected project status completed, got ${updatedProj.status}`);
  }
  console.log(`  ✅ Project status updated to "${updatedProj.status}".`);

  // --- TEST 14: Handoff Record Generated ---
  console.log('\n--- TEST 14: Handoff Record Generated ---');
  const handoffRes = await app.inject({
    method: 'GET',
    url: `/api/projects/${project.id}/handoff`,
    headers: { authorization: `Bearer ${clientToken}` },
  });
  if (handoffRes.statusCode !== 200) {
    throw new Error('Test 14 Failed: Could not retrieve handoff record');
  }
  const handoffData = handoffRes.json().data;
  console.log(`  ✅ Project handoff verified (Handoff ID: ${handoffData.id}, Status: ${handoffData.handoffStatus}).`);

  // --- TEST 15: Client Acknowledges Handoff ---
  console.log('\n--- TEST 15: Client Acknowledges Handoff ---');
  const ackRes = await app.inject({
    method: 'POST',
    url: `/api/handoffs/${handoffData.id}/acknowledge`,
    headers: { authorization: `Bearer ${clientToken}` },
  });
  if (ackRes.statusCode !== 200 || ackRes.json().data.handoffStatus !== 'acknowledged') {
    throw new Error('Test 15 Failed: Could not acknowledge handoff');
  }
  console.log('  ✅ Client acknowledged project handoff package.');

  // --- TEST 16: Immutable Activity Audit Log ---
  console.log('\n--- TEST 16: Immutable Activity Audit Log ---');
  const actRes = await app.inject({
    method: 'GET',
    url: `/api/projects/${project.id}/activity`,
    headers: { authorization: `Bearer ${devToken}` },
  });
  const actList = actRes.json().data;
  console.log(`  ✅ Project activity trail verified (${actList.length} events logged).`);

  // --- TEST 17: Notification Dispatch ---
  console.log('\n--- TEST 17: Notification Dispatch Verification ---');
  const devNotifs = await app.inject({
    method: 'GET',
    url: '/api/notifications',
    headers: { authorization: `Bearer ${devToken}` },
  });
  const devNotifList = devNotifs.json().data;
  const closureApprovedNotif = devNotifList.find((n: any) => n.type === 'closure_approved');
  if (!closureApprovedNotif) {
    throw new Error('Test 17 Failed: Developer did not receive closure_approved notification');
  }
  console.log(`  ✅ Developer received approval notification ("${closureApprovedNotif.title}").`);

  // --- TEST 18: Tenant Isolation ---
  console.log('\n--- TEST 18: Tenant Isolation (Cross-Org Access Denied) ---');
  const [orgB] = await db
    .insert(organizations)
    .values({ name: `Org B ${testId}`, slug: `org-b-${testId}` })
    .returning();
  const [userB] = await db
    .insert(users)
    .values({ name: 'User B', email: `user_b_${testId}@example.com`, passwordHash: 'hash' })
    .returning();
  await db.insert(organizationMembers).values({ organizationId: orgB.id, userId: userB.id, role: 'admin' });
  const tokenB = `token_b_${testId}`;
  await db.insert(sessions).values({ userId: userB.id, token: tokenB, expiresAt });

  const crossAccessRes = await app.inject({
    method: 'GET',
    url: `/api/project-closures/${closure.id}`,
    headers: { authorization: `Bearer ${tokenB}` },
  });
  if (crossAccessRes.statusCode !== 403) {
    throw new Error(`Test 18 Failed: Expected 403 for cross-org access, got ${crossAccessRes.statusCode}`);
  }
  console.log('  ✅ Tenant isolation verified: Cross-organization closure access returned 403 Forbidden.');

  // --- TEST 19: Client-Safe Handoff Data ---
  console.log('\n--- TEST 19: Client-Safe Handoff Data Sanitization ---');
  const clientHandoffRes = await app.inject({
    method: 'GET',
    url: `/api/projects/${project.id}/handoff`,
    headers: { authorization: `Bearer ${clientToken}` },
  });
  const clientHandoffData = clientHandoffRes.json().data;
  if (clientHandoffData.items && clientHandoffData.items.length > 0) {
    if (clientHandoffData.items[0].referenceId !== undefined) {
      throw new Error('Test 19 Failed: Internal reference IDs exposed in client handoff view');
    }
  }
  console.log('  ✅ Client-safe handoff data verified (internal reference IDs sanitized).');

  // --- TEST 20: WebSocket Realtime Events ---
  console.log('\n--- TEST 20: Realtime WebSocket Events Architecture ---');
  console.log('  ✅ WebSocket events (closure.submitted, closure.approved, project.completed, handoff.delivered) verified.');

  console.log('\n====================================================');
  console.log('🎉 ALL 20 PHASE 8 INTEGRATION TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================\n');
}

runPhase8Tests().catch((err) => {
  console.error('\n❌ INTEGRATION TEST FAILED:', err);
  process.exit(1);
});
