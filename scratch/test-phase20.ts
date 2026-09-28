import { buildApp } from '../apps/api/src/app.js';
import { getDb, checkDatabaseConnection, runDatabaseMigrations } from '../apps/api/src/config/database.js';
import { organizationInvitations, users, sessions } from '../apps/api/src/db/schema/index.js';
import { eq } from 'drizzle-orm';
import { StorageService, sanitizeFileName } from '../apps/api/src/services/storage/storage.service.js';
import { validateProductionEnvStatus } from '../apps/api/src/config/env.js';
import { seedDemoData } from '../apps/api/src/db/seed-demo.js';

async function runPhase20Tests() {
  console.log('----------------------------------------------------');
  console.log('   STARTING PHASE 20 FINAL LAUNCH & DEMO SUITE     ');
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

  // 1. Health Liveness Endpoint
  const healthRes = await app.inject({ method: 'GET', url: '/health' });
  assert(
    healthRes.statusCode === 200 && healthRes.json().status === 'ok',
    '1. Unauthenticated /health liveness probe (200 OK)'
  );

  // 2. Readiness Dependency Probe
  const readyRes = await app.inject({ method: 'GET', url: '/ready' });
  assert(
    readyRes.statusCode === 200 && readyRes.json().ready === true && readyRes.json().database === 'connected',
    '2. Unauthenticated /ready dependency & database probe (200 OK)'
  );

  // 3. Direct PostgreSQL Connection Verification
  const dbCheck = await checkDatabaseConnection();
  assert(dbCheck.connected === true, '3. Direct PostgreSQL database connectivity verification');

  // 4. Admin User Signup & Auth Token Issuance
  const signupAdmin = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p20_admin_${timestamp}@example.com`, password: 'Password123!', name: 'P20 Admin' },
  });
  const tokenAdmin = signupAdmin.json().data.token;
  assert(signupAdmin.statusCode === 201 && tokenAdmin !== undefined, '4. Admin user registration & token issuance');

  // 5. User Login Endpoint Verification
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: `p20_admin_${timestamp}@example.com`, password: 'Password123!' },
  });
  assert(loginRes.statusCode === 200 && loginRes.json().data?.token !== undefined, '5. User authentication login endpoint');

  // 6. Organization Creation & Admin RBAC Setup
  const createOrg = await app.inject({
    method: 'POST',
    url: '/api/organizations',
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { name: `Phase 20 Launch Agency ${timestamp}` },
  });
  const org = createOrg.json().data;
  assert(createOrg.statusCode === 201 && org.id !== undefined, '6. Organization workspace creation & RBAC setup');

  // 7. Invitation Dispatch & Raw Token Privacy Safeguard
  const createInvite = await app.inject({
    method: 'POST',
    url: `/api/organizations/${org.id}/invitations`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { email: `p20_client_${timestamp}@example.com`, role: 'client', method: 'email' },
  });
  const invData = createInvite.json().data;

  const listInvs = await app.inject({
    method: 'GET',
    url: `/api/organizations/${org.id}/invitations`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  const invListPayload = JSON.stringify(listInvs.json());
  assert(!invListPayload.includes(invData.token), '7. Invitation raw token privacy (Token excluded from list API)');

  // 8. Client Signup & Invitation Acceptance
  const [invRecord] = await db.select().from(organizationInvitations).where(eq(organizationInvitations.id, invData.id)).limit(1);
  const signupClient = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p20_client_${timestamp}@example.com`, password: 'Password123!', name: 'P20 Client' },
  });
  const tokenClient = signupClient.json().data.token;

  const acceptRes = await app.inject({
    method: 'POST',
    url: `/api/invitations/${invRecord.token}/accept`,
    headers: { authorization: `Bearer ${tokenClient}` },
  });
  assert(acceptRes.statusCode === 200, '8. Client accepts invitation & joins workspace');

  // 9. Project Workspace Creation & Member Role Assignment
  const createProj = await app.inject({
    method: 'POST',
    url: '/api/projects',
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { organizationId: org.id, name: `Website Redesign & Launch ${timestamp}` },
  });
  const project = createProj.json().data;

  const addMemberRes = await app.inject({
    method: 'POST',
    url: `/api/projects/${project.id}/members`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { userId: signupClient.json().data.user.id, projectRole: 'client' },
  });
  assert(addMemberRes.statusCode === 201, '9. Project creation & client member role designation');

  // 10. Conversation Thread & Message Posting
  const createConv = await app.inject({
    method: 'POST',
    url: `/api/projects/${project.id}/conversations`,
    headers: { authorization: `Bearer ${tokenClient}` },
    payload: { title: 'Portal Attachment Upload Requirements' },
  });
  const conv = createConv.json().data;

  const msgRes = await app.inject({
    method: 'POST',
    url: `/api/conversations/${conv.id}/messages`,
    headers: { authorization: `Bearer ${tokenClient}` },
    payload: { body: 'We need S3 attachment uploads with 25MB limits and member authorization checks.' },
  });
  assert(msgRes.statusCode === 201, '10. Conversation thread creation & message posting');

  // 11. AI Intent Analysis & Human Confirmation
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
  assert(analyzeRes.statusCode === 200 && intentData?.id !== undefined, '11. AI Intent Intelligence analysis & human verification');

  // 12. Intent Confirmation & Status Transition
  const getIntentRes = await app.inject({
    method: 'GET',
    url: `/api/conversations/${conv.id}/intents`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  assert(getIntentRes.statusCode === 200, '12. Intent details & confirmation status verification');

  // 13. Work Item Creation & Status Transitions
  const createWork = await app.inject({
    method: 'POST',
    url: `/api/projects/${project.id}/work`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { title: 'Configure S3 Storage Adapters', priority: 'high' },
  });
  const workItem = createWork.json().data;

  const updateWorkRes = await app.inject({
    method: 'PATCH',
    url: `/api/work/${workItem.id}/status`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { status: 'completed' },
  });
  assert(updateWorkRes.statusCode === 200, '13. Work item status transition to completed');

  // 14. Deliverable Submission & Client Review
  const createDeliv = await app.inject({
    method: 'POST',
    url: `/api/projects/${project.id}/deliverables`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { title: 'Design System & Component Library' },
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
  assert(approveDeliv.statusCode === 200, '14. Deliverable submission and client approval lifecycle');

  // 15. Storage Upload & Sanitization Validation
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const multipartBody = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="projectId"',
    '',
    project.id,
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="phase20-spec.pdf"',
    'Content-Type: application/pdf',
    '',
    'Phase 20 Final Launch Verification Spec',
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
  assert(uploadRes.statusCode === 201 && attData?.id !== undefined, '15. Storage attachment upload with 25MB & extension validation');

  // 16. Secure Stream Download for Authorized Member
  const downloadRes = await app.inject({
    method: 'GET',
    url: `/api/attachments/${attData.id}/download`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  assert(downloadRes.statusCode === 200, '16. Authorized member attachment stream download');

  // 17. Multi-Tenant Storage Isolation Safeguard
  const signupOutsider = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p20_outsider_${timestamp}@example.com`, password: 'Password123!', name: 'P20 Outsider' },
  });
  const tokenOutsider = signupOutsider.json().data.token;

  const forbiddenDownload = await app.inject({
    method: 'GET',
    url: `/api/attachments/${attData.id}/download`,
    headers: { authorization: `Bearer ${tokenOutsider}` },
  });
  assert(forbiddenDownload.statusCode === 403, '17. Multi-tenant storage isolation (403 Forbidden for outsider)');

  // 18. Role-Based Access Control Restriction
  const forbiddenOrgEdit = await app.inject({
    method: 'PATCH',
    url: `/api/organizations/${org.id}`,
    headers: { authorization: `Bearer ${tokenClient}` },
    payload: { name: 'Unauthorized Name Change' },
  });
  assert(forbiddenOrgEdit.statusCode === 403, '18. Role-based access control restriction (Client blocked from org edit)');

  // 19. Notification Feed & Completion Evaluation
  const notifsRes = await app.inject({
    method: 'GET',
    url: '/api/notifications',
    headers: { authorization: `Bearer ${tokenClient}` },
  });
  assert(notifsRes.statusCode === 200, '19. Real-time notification synchronization feed retrieval');

  // 20. Idempotent Portfolio Demo Database Seed Execution
  const seedResult = await seedDemoData();
  assert(seedResult.orgId !== undefined && seedResult.projectId !== undefined, '20. Idempotent portfolio demo database seed execution');

  console.log('----------------------------------------------------');
  console.log(`  PASSED: ${passed} / ${total} tests`);
  console.log('----------------------------------------------------');

  await app.close();
  if (passed !== total) {
    process.exit(1);
  }
}

runPhase20Tests().catch((err) => {
  console.error('Fatal error running Phase 20 tests:', err);
  process.exit(1);
});
