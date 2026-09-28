import { buildApp } from '../apps/api/src/app.js';
import { getDb, checkDatabaseConnection, runDatabaseMigrations } from '../apps/api/src/config/database.js';
import { organizationInvitations } from '../apps/api/src/db/schema/index.js';
import { eq } from 'drizzle-orm';
import { normalizePhoneNumber, EmailInvitationProvider, SmsInvitationProvider } from '../apps/api/src/services/invitations/invitation-delivery.service.js';
import { StorageService, sanitizeFileName } from '../apps/api/src/services/storage/storage.service.js';
import { validateProductionEnvStatus } from '../apps/api/src/config/env.js';

async function runPhase19Tests() {
  console.log('----------------------------------------------------');
  console.log('   STARTING PHASE 19 PRODUCTION LAUNCH SUITE        ');
  console.log('----------------------------------------------------');

  validateProductionEnvStatus();
  await runDatabaseMigrations();
  const app = buildApp();
  await app.ready();

  const timestamp = Date.now();
  const db = getDb();

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

  // 1. Health Liveness Endpoint (Unauthenticated)
  const healthRes = await app.inject({
    method: 'GET',
    url: '/health',
  });
  assert(
    healthRes.statusCode === 200 && healthRes.json().status === 'ok',
    '1. Unauthenticated /health liveness endpoint (200 OK)'
  );

  // 2. Readiness Dependency Endpoint (Unauthenticated)
  const readyRes = await app.inject({
    method: 'GET',
    url: '/ready',
  });
  assert(
    readyRes.statusCode === 200 && readyRes.json().ready === true && readyRes.json().database === 'connected',
    '2. Unauthenticated /ready dependency verification endpoint (200 OK)'
  );

  // 3. Database Connectivity Check
  const dbCheck = await checkDatabaseConnection();
  assert(dbCheck.connected === true, '3. Direct PostgreSQL database connection check');

  // 4. Admin User Signup & Auth Token Issuance
  const signupAdmin = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p19_admin_${timestamp}@example.com`, password: 'Password123!', name: 'P19 Admin' },
  });
  const tokenAdmin = signupAdmin.json().data.token;
  assert(signupAdmin.statusCode === 201 && tokenAdmin !== undefined, '4. Admin user signup & auth token issuance');

  // 5. Organization Creation & Admin RBAC Setup
  const createOrg = await app.inject({
    method: 'POST',
    url: '/api/organizations',
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { name: `Phase 19 Production Launch Org ${timestamp}` },
  });
  const org = createOrg.json().data;
  assert(createOrg.statusCode === 201 && org.id !== undefined, '5. Organization creation & admin RBAC setup');

  // 6. Invitation Dispatch & Token Exclusion Privacy Safeguard
  const createInvite = await app.inject({
    method: 'POST',
    url: `/api/organizations/${org.id}/invitations`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { email: `p19_client_${timestamp}@example.com`, role: 'client', method: 'email' },
  });
  const invData = createInvite.json().data;

  const listInvs = await app.inject({
    method: 'GET',
    url: `/api/organizations/${org.id}/invitations`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  const invListPayload = JSON.stringify(listInvs.json());
  assert(!invListPayload.includes(invData.token), '6. Invitation raw token privacy (Token excluded from list API)');

  // 7. Client Signup & Invitation Acceptance
  const [invRecord] = await db.select().from(organizationInvitations).where(eq(organizationInvitations.id, invData.id)).limit(1);
  const signupClient = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p19_client_${timestamp}@example.com`, password: 'Password123!', name: 'P19 Client' },
  });
  const tokenClient = signupClient.json().data.token;

  const acceptRes = await app.inject({
    method: 'POST',
    url: `/api/invitations/${invRecord.token}/accept`,
    headers: { authorization: `Bearer ${tokenClient}` },
  });
  assert(acceptRes.statusCode === 200, '7. Client accepts invitation & joins organization workspace');

  // 8. Project Creation & Member Role Assignment
  const createProj = await app.inject({
    method: 'POST',
    url: '/api/projects',
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { organizationId: org.id, name: `P19 SaaS Platform ${timestamp}` },
  });
  const project = createProj.json().data;

  const addMemberRes = await app.inject({
    method: 'POST',
    url: `/api/projects/${project.id}/members`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { userId: signupClient.json().data.user.id, projectRole: 'client' },
  });
  assert(addMemberRes.statusCode === 201, '8. Project workspace creation & client member role designation');

  // 9. Conversation Thread & Message Post
  const createConv = await app.inject({
    method: 'POST',
    url: `/api/projects/${project.id}/conversations`,
    headers: { authorization: `Bearer ${tokenClient}` },
    payload: { title: 'P19 High Availability Storage Requirements' },
  });
  const conv = createConv.json().data;

  const msgRes = await app.inject({
    method: 'POST',
    url: `/api/conversations/${conv.id}/messages`,
    headers: { authorization: `Bearer ${tokenClient}` },
    payload: { body: 'We need S3 attachment uploads with 25MB limits and member authorization checks.' },
  });
  assert(msgRes.statusCode === 201, '9. Conversation thread creation & message posting');

  // 10. AI Intent Analysis & Confirmation Workflow
  const analyzeRes = await app.inject({
    method: 'POST',
    url: `/api/conversations/${conv.id}/intents/analyze`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  const intentData = analyzeRes.json().data;

  if (intentData?.id) {
    await app.inject({
      method: 'POST',
      url: `/api/intents/${intentData.id}/confirm`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
    });
  }
  assert(analyzeRes.statusCode === 200 && intentData?.id !== undefined, '10. AI Intent Intelligence analysis & human review');

  // 11. Work Proposal Generation & Execution
  const createWork = await app.inject({
    method: 'POST',
    url: `/api/projects/${project.id}/work`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { title: 'S3 & Supabase Storage Adapter Implementation', priority: 'high' },
  });
  const workItem = createWork.json().data;

  const updateWorkRes = await app.inject({
    method: 'PATCH',
    url: `/api/work/${workItem.id}/status`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { status: 'completed' },
  });
  assert(updateWorkRes.statusCode === 200, '11. Confirmed intent -> Work item creation & status transition');

  // 12. Deliverable Creation, Submission & Client Approval
  const createDeliv = await app.inject({
    method: 'POST',
    url: `/api/projects/${project.id}/deliverables`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { title: 'Storage Hardening & Migration Security Package' },
  });
  const deliv = createDeliv.json().data;

  await app.inject({
    method: 'POST',
    url: `/api/deliverables/${deliv.id}/submit`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });

  const approveDeliv = await app.inject({
    method: 'POST',
    url: `/api/deliverables/${deliv.id}/approve`,
    headers: { authorization: `Bearer ${tokenClient}` },
    payload: { comment: 'Approved for launch' },
  });
  assert(approveDeliv.statusCode === 200, '12. Deliverable submission and client approval lifecycle');

  // 13. Storage Upload & Authorized Stream Download
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const multipartBody = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="projectId"',
    '',
    project.id,
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="phase19-launch-spec.pdf"',
    'Content-Type: application/pdf',
    '',
    'Phase 19 Launch Verification & Security Specification',
    `--${boundary}--`,
  ].join('\r\n');

  const uploadRes = await app.inject({
    method: 'POST',
    url: '/api/attachments/upload',
    headers: {
      authorization: `Bearer ${tokenAdmin}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    payload: multipartBody,
  });
  const attData = uploadRes.json().data;

  const downloadRes = await app.inject({
    method: 'GET',
    url: `/api/attachments/${attData.id}/download`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  assert(downloadRes.statusCode === 200, '13. Secure storage attachment upload & authorized stream retrieval');

  // 14. Multi-Tenant Storage Isolation Safeguard
  const signupOutsider = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p19_outsider_${timestamp}@example.com`, password: 'Password123!', name: 'P19 Outsider' },
  });
  const tokenOutsider = signupOutsider.json().data.token;

  const forbiddenDownload = await app.inject({
    method: 'GET',
    url: `/api/attachments/${attData.id}/download`,
    headers: { authorization: `Bearer ${tokenOutsider}` },
  });
  assert(forbiddenDownload.statusCode === 403, '14. Multi-tenant file isolation blocks unauthorized outsider (403 Forbidden)');

  // 15. Role-Based Permission Restriction
  const forbiddenOrgEdit = await app.inject({
    method: 'PATCH',
    url: `/api/organizations/${org.id}`,
    headers: { authorization: `Bearer ${tokenClient}` },
    payload: { name: 'Unauthorized Name Change' },
  });
  assert(forbiddenOrgEdit.statusCode === 403, '15. Role-based permission restriction (Client blocked from org edit)');

  // 16. Standardized 404 & Error Structure
  const notFoundRes = await app.inject({
    method: 'GET',
    url: '/api/non-existent-p19-route',
  });
  assert(notFoundRes.statusCode === 404 && notFoundRes.json().error.code === 'NOT_FOUND', '16. Standardized error structure for non-existent API routes');

  // 17. Notification Retrieval
  const notifsRes = await app.inject({
    method: 'GET',
    url: '/api/notifications',
    headers: { authorization: `Bearer ${tokenClient}` },
  });
  assert(notifsRes.statusCode === 200, '17. Notification synchronization feed retrieval');

  // 18. Project Completion Readiness Check
  const completionRes = await app.inject({
    method: 'GET',
    url: `/api/projects/${project.id}/completion-status`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  assert(completionRes.statusCode === 200, '18. Project completion readiness evaluation check');

  console.log('----------------------------------------------------');
  console.log(`  PASSED: ${passed} / ${total} tests`);
  console.log('----------------------------------------------------');

  await app.close();
  if (passed !== total) {
    process.exit(1);
  }
}

runPhase19Tests().catch((err) => {
  console.error('Fatal error running Phase 19 tests:', err);
  process.exit(1);
});
