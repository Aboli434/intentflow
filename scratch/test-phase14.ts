import { buildApp } from '../apps/api/src/app.js';
import { getDb } from '../apps/api/src/config/database.js';
import { users, organizations, projectMembers, organizationMembers, organizationInvitations, projectCompletionChecklist } from '../apps/api/src/db/schema/index.js';
import { NotificationService } from '../apps/api/src/services/notifications/notification.service.js';
import { ensureProjectChecklist } from '../apps/api/src/services/project/project-completion.service.js';
import { eq } from 'drizzle-orm';

async function runTests() {
  console.log('----------------------------------------------------');
  console.log('   STARTING PHASE 14 INTEGRATION VERIFICATION SUITE   ');
  console.log('----------------------------------------------------');

  const app = buildApp();
  await app.ready();

  const timestamp = Date.now();
  const db = getDb();
  const notificationService = new NotificationService();

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (condition) {
      console.log(`  ✓ Test ${total}: ${message}`);
      passed++;
    } else {
      console.error(`  ✕ Test ${total} FAILED: ${message}`);
    }
  }

  // 1. Setup Admin & User account (Login & Session Persistence)
  const signupResAdmin = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p14_admin_${timestamp}@example.com`, password: 'Password123!', name: 'P14 Admin' },
  });
  const tokenAdmin = signupResAdmin.json().data.token;
  const userAdmin = signupResAdmin.json().data.user;

  const loginResAdmin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: `p14_admin_${timestamp}@example.com`, password: 'Password123!' },
  });
  assert(loginResAdmin.statusCode === 200 && loginResAdmin.json().data.token !== undefined, '1. Login & session token generation succeeds');

  const meRes = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  assert(meRes.statusCode === 200 && meRes.json().data.user.id === userAdmin.id, '1b. Session persistence via /api/auth/me succeeds');

  // 2. Organization Creation & Access
  const orgResA = await app.inject({
    method: 'POST',
    url: '/api/organizations',
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { name: `Phase 14 Org A ${timestamp}` },
  });
  const orgA = orgResA.json().data;
  assert(orgResA.statusCode === 201 && orgA.id !== undefined, '2. Organization creation & access succeeds');

  // 3. Invitation Creation (Email & Mobile)
  const inviteEmail = await app.inject({
    method: 'POST',
    url: `/api/organizations/${orgA.id}/invitations`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { email: `p14_invited_email_${timestamp}@example.com`, role: 'developer', method: 'email' },
  });
  const inviteData = inviteEmail.json().data;
  const [invRecord] = await db.select().from(organizationInvitations).where(eq(organizationInvitations.id, inviteData.id)).limit(1);
  const invEmailToken = invRecord.token;
  assert(inviteEmail.statusCode === 201 && invEmailToken !== undefined, '3a. Email invitation creation succeeds');

  const inviteMobile = await app.inject({
    method: 'POST',
    url: `/api/organizations/${orgA.id}/invitations`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { phone: `+1555${timestamp.toString().slice(-7)}`, role: 'client', method: 'sms' },
  });
  assert(inviteMobile.statusCode === 201 && inviteMobile.json().data.id !== undefined, '3b. Mobile invitation creation succeeds');

  // 4. Invitation Acceptance
  const signupDev = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p14_invited_email_${timestamp}@example.com`, password: 'Password123!', name: 'P14 Dev' },
  });
  const tokenDev = signupDev.json().data.token;
  const userDev = signupDev.json().data.user;

  const acceptRes = await app.inject({
    method: 'POST',
    url: `/api/invitations/${invEmailToken}/accept`,
    headers: { authorization: `Bearer ${tokenDev}` },
  });
  assert(acceptRes.statusCode === 200, '4. Invitation acceptance joins recipient into organization');

  // 5. Duplicate Invitation Rejection
  const dupAccept = await app.inject({
    method: 'POST',
    url: `/api/invitations/${invEmailToken}/accept`,
    headers: { authorization: `Bearer ${tokenDev}` },
  });
  assert(dupAccept.statusCode === 400 || dupAccept.statusCode === 409 || dupAccept.statusCode === 422, '5. Already accepted invitation cannot be accepted again');

  // Setup Client User
  const signupClient = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p14_client_${timestamp}@example.com`, password: 'Password123!', name: 'P14 Client' },
  });
  const tokenClient = signupClient.json().data.token;
  const userClient = signupClient.json().data.user;
  await db.insert(organizationMembers).values({ organizationId: orgA.id, userId: userClient.id, role: 'client' }).onConflictDoNothing();

  // Setup Viewer User
  const signupViewer = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p14_viewer_${timestamp}@example.com`, password: 'Password123!', name: 'P14 Viewer' },
  });
  const tokenViewer = signupViewer.json().data.token;
  const userViewer = signupViewer.json().data.user;
  await db.insert(organizationMembers).values({ organizationId: orgA.id, userId: userViewer.id, role: 'developer' }).onConflictDoNothing();

  // 6. Project Creation
  const projRes = await app.inject({
    method: 'POST',
    url: '/api/projects',
    headers: { authorization: `Bearer ${tokenAdmin}`, 'x-organization-id': orgA.id },
    payload: { organizationId: orgA.id, name: `Phase 14 Project ${timestamp}`, description: 'Production Flow Test' },
  });
  const project = projRes.json().data;
  assert(projRes.statusCode === 201 && project.id !== undefined, '6. Project creation succeeds');

  // 7. Project Assignment
  await app.inject({
    method: 'POST',
    url: `/api/projects/${project.id}/members`,
    headers: { authorization: `Bearer ${tokenAdmin}`, 'x-organization-id': orgA.id },
    payload: { userId: userDev.id, projectRole: 'developer' },
  });
  await app.inject({
    method: 'POST',
    url: `/api/projects/${project.id}/members`,
    headers: { authorization: `Bearer ${tokenAdmin}`, 'x-organization-id': orgA.id },
    payload: { userId: userClient.id, projectRole: 'client' },
  });
  const assignViewer = await app.inject({
    method: 'POST',
    url: `/api/projects/${project.id}/members`,
    headers: { authorization: `Bearer ${tokenAdmin}`, 'x-organization-id': orgA.id },
    payload: { userId: userViewer.id, projectRole: 'viewer' },
  });
  assert(assignViewer.statusCode === 200 || assignViewer.statusCode === 201, '7. Project member assignment succeeds');

  // 8. Project Role Enforcement (Client trying to update project gets 403)
  const updateProjByClient = await app.inject({
    method: 'PATCH',
    url: `/api/projects/${project.id}`,
    headers: { authorization: `Bearer ${tokenClient}`, 'x-organization-id': orgA.id },
    payload: { description: 'Client update attempt' },
  });
  assert(updateProjByClient.statusCode === 403, '8. Project role enforcement blocks unauthorized project updates');

  // 9. Conversation Access
  const convRes = await app.inject({
    method: 'POST',
    url: `/api/projects/${project.id}/conversations`,
    headers: { authorization: `Bearer ${tokenDev}`, 'x-organization-id': orgA.id },
    payload: { title: 'Development Sync' },
  });
  assert(convRes.statusCode === 201 || convRes.statusCode === 200, '9. Conversation access succeeds for assigned project members');

  // 10. Work Access
  const workRes = await app.inject({
    method: 'GET',
    url: `/api/projects/${project.id}/work`,
    headers: { authorization: `Bearer ${tokenDev}`, 'x-organization-id': orgA.id },
  });
  assert(workRes.statusCode === 200, '10. Work item access succeeds for assigned project members');

  // 11. Deliverable Submission
  const delivRes = await app.inject({
    method: 'POST',
    url: `/api/projects/${project.id}/deliverables`,
    headers: { authorization: `Bearer ${tokenDev}`, 'x-organization-id': orgA.id },
    payload: { title: 'v1.0 Release Candidate', description: 'Core build' },
  });
  const deliverable = delivRes.json().data;

  const submitDeliv = await app.inject({
    method: 'POST',
    url: `/api/deliverables/${deliverable.id}/submit-review`,
    headers: { authorization: `Bearer ${tokenDev}`, 'x-organization-id': orgA.id },
  });
  assert(submitDeliv.statusCode === 200, '11. Deliverable submission for client review succeeds');

  // 12. Client Approval
  const approveDeliv = await app.inject({
    method: 'POST',
    url: `/api/deliverables/${deliverable.id}/approve`,
    headers: { authorization: `Bearer ${tokenClient}`, 'x-organization-id': orgA.id },
    payload: { comment: 'Looks great!' },
  });
  assert(approveDeliv.statusCode === 200, '12. Client approval of deliverable succeeds');

  // Complete required checklist items for eligibility
  const checklist = await ensureProjectChecklist(project.id);
  for (const item of checklist) {
    if (item.required && item.key !== 'client_approved') {
      await db.update(projectCompletionChecklist)
        .set({ status: 'completed', completedBy: userAdmin.id, completedAt: new Date() })
        .where(eq(projectCompletionChecklist.id, item.id));
    }
  }

  // 13. Closure Submission
  const closureRes = await app.inject({
    method: 'POST',
    url: `/api/projects/${project.id}/closure`,
    headers: { authorization: `Bearer ${tokenAdmin}`, 'x-organization-id': orgA.id },
    payload: { summary: 'Project work completed', completionNotes: 'All deliverables ready' },
  });
  const closure = closureRes.json().data;

  const submitClosureRes = await app.inject({
    method: 'POST',
    url: `/api/project-closures/${closure.id}/submit`,
    headers: { authorization: `Bearer ${tokenAdmin}`, 'x-organization-id': orgA.id },
    payload: { notes: 'Submitting for client sign-off' },
  });
  assert(submitClosureRes.statusCode === 200, '13. Project closure submission succeeds');

  // 14. Client Change Request
  const requestChangesRes = await app.inject({
    method: 'POST',
    url: `/api/project-closures/${closure.id}/request-changes`,
    headers: { authorization: `Bearer ${tokenClient}`, 'x-organization-id': orgA.id },
    payload: { comment: 'Need update on user documentation', description: 'Docs link missing' },
  });
  assert(requestChangesRes.statusCode === 200, '14. Client closure change request succeeds');

  // Resolve revision request & resubmit closure
  const fetchClosure = await app.inject({
    method: 'GET',
    url: `/api/project-closures/${closure.id}`,
    headers: { authorization: `Bearer ${tokenAdmin}`, 'x-organization-id': orgA.id },
  });
  const revisions = fetchClosure.json().data.revisions || [];
  if (revisions.length > 0) {
    await app.inject({
      method: 'PATCH',
      url: `/api/closure-revisions/${revisions[0].id}/status`,
      headers: { authorization: `Bearer ${tokenAdmin}`, 'x-organization-id': orgA.id },
      payload: { status: 'resolved' },
    });
  }
  await app.inject({
    method: 'POST',
    url: `/api/project-closures/${closure.id}/submit`,
    headers: { authorization: `Bearer ${tokenAdmin}`, 'x-organization-id': orgA.id },
    payload: { notes: 'Resubmitting closure with documentation' },
  });

  // 15. Closure Approval
  const approveClosureRes = await app.inject({
    method: 'POST',
    url: `/api/project-closures/${closure.id}/approve`,
    headers: { authorization: `Bearer ${tokenClient}`, 'x-organization-id': orgA.id },
    payload: { comment: 'All checklist items verified and approved' },
  });
  assert(approveClosureRes.statusCode === 200, '15. Client closure approval succeeds');

  // 16. Handoff Generation
  const handoffRes = await app.inject({
    method: 'POST',
    url: `/api/project-closures/${closure.id}/handoff`,
    headers: { authorization: `Bearer ${tokenAdmin}`, 'x-organization-id': orgA.id },
  });
  const handoff = handoffRes.json().data;
  assert(handoffRes.statusCode === 201 && handoff.id !== undefined, '16. Handoff package generation succeeds');

  // 17. Handoff Acknowledgement
  const ackHandoffRes = await app.inject({
    method: 'POST',
    url: `/api/handoffs/${handoff.id}/acknowledge`,
    headers: { authorization: `Bearer ${tokenClient}`, 'x-organization-id': orgA.id },
  });
  assert(ackHandoffRes.statusCode === 200, '17. Client handoff package acknowledgement succeeds');

  // 18. Notification Ownership
  const notif = await notificationService.createNotification({
    userId: userAdmin.id,
    organizationId: orgA.id,
    projectId: project.id,
    type: 'closure_approved',
    title: 'Project Closed',
    body: 'Closure approved by client',
  });
  const markNotifClient = await app.inject({
    method: 'POST',
    url: `/api/notifications/${notif.id}/read`,
    headers: { authorization: `Bearer ${tokenClient}` },
  });
  assert(markNotifClient.statusCode === 404 || markNotifClient.statusCode === 403, '18. Notification ownership prevents unauthorized read updates');

  // 19. Cross-Org Isolation
  const signupOrgBUser = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p14_orgb_${timestamp}@example.com`, password: 'Password123!', name: 'OrgB User' },
  });
  const tokenOrgB = signupOrgBUser.json().data.token;
  const crossOrgGet = await app.inject({
    method: 'GET',
    url: `/api/projects/${project.id}`,
    headers: { authorization: `Bearer ${tokenOrgB}` },
  });
  assert(crossOrgGet.statusCode === 403, '19. Cross-organization project access is rejected with 403');

  // 20. Unauthorized Mutation Protection
  const viewerMutateWork = await app.inject({
    method: 'POST',
    url: `/api/projects/${project.id}/work`,
    headers: { authorization: `Bearer ${tokenViewer}`, 'x-organization-id': orgA.id },
    payload: { title: 'Viewer Work Item' },
  });
  assert(viewerMutateWork.statusCode === 403, '20. Unauthorized mutation is rejected with 403');

  console.log('----------------------------------------------------');
  console.log(` RESULTS: ${passed} / ${total} TESTS PASSED! 🎉`);
  console.log('----------------------------------------------------');

  await app.close();

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal Test Execution Error:', err);
  process.exit(1);
});
