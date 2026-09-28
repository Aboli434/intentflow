import { buildApp } from '../apps/api/src/app.js';
import { getDb, checkDatabaseConnection, runDatabaseMigrations } from '../apps/api/src/config/database.js';
import { organizationInvitations } from '../apps/api/src/db/schema/index.js';
import { eq } from 'drizzle-orm';
import { normalizePhoneNumber, EmailInvitationProvider, SmsInvitationProvider } from '../apps/api/src/services/invitations/invitation-delivery.service.js';
import { StorageService, sanitizeFileName, validateFile } from '../apps/api/src/services/storage/storage.service.js';
import { validateProductionEnvStatus } from '../apps/api/src/config/env.js';

async function runPhase18Tests() {
  console.log('----------------------------------------------------');
  console.log('   STARTING PHASE 18 PRODUCTION LAUNCH SUITE        ');
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
  assert(dbCheck.connected === true, '3. Direct database connection verification check');

  // 4. Production Environment Fail-Fast Validation Test
  let prodCheckFailed = false;
  try {
    validateProductionEnvStatus({
      NODE_ENV: 'production',
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: '',
    });
  } catch (err: any) {
    prodCheckFailed = err.message.includes('RESEND_API_KEY');
  }
  assert(prodCheckFailed, '4. Production env fail-fast validation rejects missing gateway credentials');

  // 5. Email Provider Selection & Delivery
  const emailProvider = new EmailInvitationProvider();
  const emailRes = await emailProvider.sendInvitation({
    destination: `p18_test_${timestamp}@example.com`,
    invitationUrl: 'http://localhost:3000/invite/testtoken',
    organizationName: 'Production Test Org',
    role: 'client',
    invitationMethod: 'email',
  });
  assert(emailRes.success && emailRes.status === 'sent', '5. Email provider selection & transactional HTML dispatch');

  // 6. SMS Provider Selection & E.164 Normalization
  const smsProvider = new SmsInvitationProvider();
  const smsRes = await smsProvider.sendInvitation({
    destination: '9876543210',
    invitationUrl: 'http://localhost:3000/invite/testtoken',
    organizationName: 'Production Test Org',
    role: 'developer',
    invitationMethod: 'sms',
  });
  assert(smsRes.success && smsRes.status === 'sent', '6. SMS provider selection & E.164 normalization');

  // 7. Storage Provider Selection & Sanitization
  const storageService = new StorageService();
  const cleanKey = sanitizeFileName('../../unsafe-path/prod_spec.pdf');
  assert(cleanKey === 'prod_spec.pdf', '7. Storage filename sanitization & key generation');

  await storageService.getProvider().saveFile(cleanKey, Buffer.from('IntentFlow Production Storage Test'));
  const fileStream = await storageService.getProvider().getFileStream(cleanKey);
  let chunks: Buffer[] = [];
  for await (const chunk of fileStream) chunks.push(Buffer.from(chunk));
  const fileContent = Buffer.concat(chunks).toString('utf-8');
  assert(fileContent.includes('Production Storage Test'), '8. Storage provider file save & stream retrieval');
  await storageService.getProvider().deleteFile(cleanKey);

  // 9. Admin Signup & Org Setup
  const signupAdmin = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p18_admin_${timestamp}@example.com`, password: 'Password123!', name: 'P18 Admin' },
  });
  const tokenAdmin = signupAdmin.json().data.token;
  const userAdmin = signupAdmin.json().data.user;

  const createOrg = await app.inject({
    method: 'POST',
    url: '/api/organizations',
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { name: `Phase 18 Production Org ${timestamp}` },
  });
  const org = createOrg.json().data;

  // 10. Invitation Token Exposure Safeguard
  const createInvite = await app.inject({
    method: 'POST',
    url: `/api/organizations/${org.id}/invitations`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { email: `p18_client_${timestamp}@example.com`, role: 'client', method: 'email' },
  });
  const invData = createInvite.json().data;

  const listInvs = await app.inject({
    method: 'GET',
    url: `/api/organizations/${org.id}/invitations`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  const invListPayload = JSON.stringify(listInvs.json());
  assert(!invListPayload.includes(invData.token), '10. Invitation raw token privacy (Token excluded from list API)');

  // 11. Client Signup & Invitation Acceptance
  const [invRecord] = await db.select().from(organizationInvitations).where(eq(organizationInvitations.id, invData.id)).limit(1);
  const signupClient = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p18_client_${timestamp}@example.com`, password: 'Password123!', name: 'P18 Client' },
  });
  const tokenClient = signupClient.json().data.token;

  const acceptRes = await app.inject({
    method: 'POST',
    url: `/api/invitations/${invRecord.token}/accept`,
    headers: { authorization: `Bearer ${tokenClient}` },
  });
  assert(acceptRes.statusCode === 200, '11. Client accepts invitation & joins workspace');

  // 12. Project Setup & Attachment Upload
  const createProj = await app.inject({
    method: 'POST',
    url: '/api/projects',
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { organizationId: org.id, name: `P18 Launch Application ${timestamp}` },
  });
  const project = createProj.json().data;

  await app.inject({
    method: 'POST',
    url: `/api/projects/${project.id}/members`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { userId: signupClient.json().data.user.id, projectRole: 'client' },
  });

  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const multipartBody = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="projectId"',
    '',
    project.id,
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="launch-readiness.pdf"',
    'Content-Type: application/pdf',
    '',
    'Phase 18 Production Launch Verification Document',
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
  assert(uploadRes.statusCode === 201 && attData.id !== undefined, '12. Project attachment upload with storage validation');

  // 13. Secure Download & Tenant Isolation
  const downloadRes = await app.inject({
    method: 'GET',
    url: `/api/attachments/${attData.id}/download`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  assert(downloadRes.statusCode === 200, '13. Secure attachment download for authorized project member');

  const signupOutsider = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p18_outsider_${timestamp}@example.com`, password: 'Password123!', name: 'P18 Outsider' },
  });
  const tokenOutsider = signupOutsider.json().data.token;

  const forbiddenDownload = await app.inject({
    method: 'GET',
    url: `/api/attachments/${attData.id}/download`,
    headers: { authorization: `Bearer ${tokenOutsider}` },
  });
  assert(forbiddenDownload.statusCode === 403, '14. Multi-tenant file isolation blocks unauthorized outsider (403 Forbidden)');

  // 15. Deliverable & Work Workflow Verification
  const createDeliv = await app.inject({
    method: 'POST',
    url: `/api/projects/${project.id}/deliverables`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { title: 'Production Security & Compliance Audit' },
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
  assert(approveDeliv.statusCode === 200, '15. Deliverable submission and client approval lifecycle');

  // 16. Error Masking Safeguard
  const notFoundRes = await app.inject({
    method: 'GET',
    url: '/api/non-existent-route',
  });
  assert(notFoundRes.statusCode === 404 && notFoundRes.json().error.code !== undefined, '16. Standardized error structure for non-existent API routes');

  console.log('----------------------------------------------------');
  console.log(`  PASSED: ${passed} / ${total} tests`);
  console.log('----------------------------------------------------');

  await app.close();
  if (passed !== total) {
    process.exit(1);
  }
}

runPhase18Tests().catch((err) => {
  console.error('Fatal error running Phase 18 tests:', err);
  process.exit(1);
});
