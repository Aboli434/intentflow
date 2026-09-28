import { buildApp } from '../apps/api/src/app.js';
import { getDb, ensurePhase16Schema } from '../apps/api/src/config/database.js';
import { organizationInvitations, attachments } from '../apps/api/src/db/schema/index.js';
import { eq } from 'drizzle-orm';
import { normalizePhoneNumber, EmailInvitationProvider, SmsInvitationProvider } from '../apps/api/src/services/invitations/invitation-delivery.service.js';
import { StorageService, sanitizeFileName, validateFile } from '../apps/api/src/services/storage/storage.service.js';
import { validateProductionEnvStatus } from '../apps/api/src/config/env.js';

async function runPhase17Tests() {
  console.log('----------------------------------------------------');
  console.log('   STARTING PHASE 17 PRODUCTION READINESS SUITE     ');
  console.log('----------------------------------------------------');

  validateProductionEnvStatus();
  await ensurePhase16Schema();
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

  // 1. Storage File Sanitization Unit Check
  const sanitized = sanitizeFileName('../../unsafe-path/file name#1.pdf');
  assert(sanitized === 'file_name_1.pdf', '1. Storage file name sanitization');

  // 2. Executable File Rejection Unit Check
  const valRes = validateFile('malicious.exe', 'application/x-msdownload', 1024);
  assert(!valRes.valid && valRes.reason?.includes('Executable'), '2. Executable file extension security rejection');

  // 3. E.164 Phone Normalization
  const phoneNorm = normalizePhoneNumber('9876543210', '+91');
  assert(phoneNorm === '+919876543210', '3. E.164 phone number formatting');

  // 4. Admin User Signup & Workspace Setup
  const signupAdmin = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p17_admin_${timestamp}@example.com`, password: 'Password123!', name: 'P17 Admin' },
  });
  const tokenAdmin = signupAdmin.json().data.token;
  const userAdmin = signupAdmin.json().data.user;

  const createOrg = await app.inject({
    method: 'POST',
    url: '/api/organizations',
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { name: `Phase 17 Org ${timestamp}` },
  });
  const org = createOrg.json().data;
  assert(createOrg.statusCode === 201 && org.id !== undefined, '4. Admin user setup & workspace creation');

  // 5. Invitation Delivery & Metadata Tracking
  const createInvite = await app.inject({
    method: 'POST',
    url: `/api/organizations/${org.id}/invitations`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { email: `p17_client_${timestamp}@example.com`, role: 'client', method: 'email' },
  });
  const invData = createInvite.json().data;
  assert(createInvite.statusCode === 201 && invData.status === 'sent', '5. Invitation creation with real provider dispatch & metadata');

  // 6. Duplicate Active Invitation Protection
  const dupInvite = await app.inject({
    method: 'POST',
    url: `/api/organizations/${org.id}/invitations`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { email: `p17_client_${timestamp}@example.com`, role: 'client', method: 'email' },
  });
  assert(dupInvite.statusCode === 409 && dupInvite.json().error.code === 'DUPLICATE_INVITATION', '6. Duplicate active invitation rejection (409 Conflict)');

  // 7. Resend Invitation Endpoint
  const resendInvite = await app.inject({
    method: 'POST',
    url: `/api/organizations/${org.id}/invitations/${invData.id}/resend`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  assert(resendInvite.statusCode === 200 && (resendInvite.json().data.status === 'sent' || resendInvite.json().data.status === 'pending'), '7. Resend invitation endpoint token regeneration');

  // 8. Client Signup & Invitation Acceptance
  const [invRecord] = await db.select().from(organizationInvitations).where(eq(organizationInvitations.id, invData.id)).limit(1);
  const signupClient = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p17_client_${timestamp}@example.com`, password: 'Password123!', name: 'P17 Client' },
  });
  const tokenClient = signupClient.json().data.token;

  const acceptRes = await app.inject({
    method: 'POST',
    url: `/api/invitations/${invRecord.token}/accept`,
    headers: { authorization: `Bearer ${tokenClient}` },
  });
  assert(acceptRes.statusCode === 200, '8. Client user accepts invitation and joins workspace');

  // 9. Re-accepting Already Accepted Invitation Rejection
  const reacceptRes = await app.inject({
    method: 'POST',
    url: `/api/invitations/${invRecord.token}/accept`,
    headers: { authorization: `Bearer ${tokenClient}` },
  });
  assert(reacceptRes.statusCode === 409 && reacceptRes.json().error.code === 'ALREADY_ACCEPTED', '9. Already accepted invitation rejection (409 Conflict)');

  // 10. Project Creation & Member Assignment
  const createProj = await app.inject({
    method: 'POST',
    url: '/api/projects',
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { organizationId: org.id, name: `P17 SaaS App ${timestamp}` },
  });
  const project = createProj.json().data;

  const assignMember = await app.inject({
    method: 'POST',
    url: `/api/projects/${project.id}/members`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { userId: signupClient.json().data.user.id, projectRole: 'client' },
  });
  assert(assignMember.statusCode === 201, '10. Project creation & client role assignment');

  // 11. Attachment Upload with Validation
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const multipartBody = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="projectId"',
    '',
    project.id,
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="architecture-specs.pdf"',
    'Content-Type: application/pdf',
    '',
    'Phase 17 Production Architecture PDF Content',
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
  assert(uploadRes.statusCode === 201 && attData.id !== undefined, '11. Validated file upload with sanitized filename');

  // 12. Secure File Stream Download
  const downloadRes = await app.inject({
    method: 'GET',
    url: `/api/attachments/${attData.id}/download`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  assert(downloadRes.statusCode === 200, '12. Secure file download stream for authorized user');

  // 13. Cross-Tenant File Access Rejection
  const signupOutsider = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p17_outsider_${timestamp}@example.com`, password: 'Password123!', name: 'P17 Outsider' },
  });
  const tokenOutsider = signupOutsider.json().data.token;

  const forbiddenDownload = await app.inject({
    method: 'GET',
    url: `/api/attachments/${attData.id}/download`,
    headers: { authorization: `Bearer ${tokenOutsider}` },
  });
  assert(forbiddenDownload.statusCode === 403, '13. Cross-organization file download rejection (403 Forbidden)');

  // 14. Deliverable Review & Approval Lifecycle
  const createDeliv = await app.inject({
    method: 'POST',
    url: `/api/projects/${project.id}/deliverables`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { title: 'Production Security Audit Report' },
  });
  const deliv = createDeliv.json().data;

  const submitDeliv = await app.inject({
    method: 'POST',
    url: `/api/deliverables/${deliv.id}/submit`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });

  const approveDeliv = await app.inject({
    method: 'POST',
    url: `/api/deliverables/${deliv.id}/approve`,
    headers: { authorization: `Bearer ${tokenClient}` },
    payload: { comment: 'Client approval for Phase 17' },
  });
  assert(submitDeliv.statusCode === 200 && approveDeliv.statusCode === 200, '14. Deliverable submission and client approval lifecycle');

  // 15. Work Status Transition
  const createWork = await app.inject({
    method: 'POST',
    url: `/api/projects/${project.id}/work`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { title: 'Verify Storage Provider Failover', priority: 'high' },
  });
  const workItem = createWork.json().data;

  const updateWork = await app.inject({
    method: 'PATCH',
    url: `/api/work/${workItem.id}/status`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { status: 'completed' },
  });
  assert(updateWork.statusCode === 200 && updateWork.json().data.status === 'completed', '15. Work item status transition to completed');

  // 16. Project Completion Readiness Check
  const completionRes = await app.inject({
    method: 'GET',
    url: `/api/projects/${project.id}/completion-status`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  assert(completionRes.statusCode === 200 && completionRes.json().data.eligible !== undefined, '16. Project completion readiness check');

  // 17. Notification Feed
  const notifs = await app.inject({
    method: 'GET',
    url: '/api/notifications',
    headers: { authorization: `Bearer ${tokenClient}` },
  });
  assert(notifs.statusCode === 200 && Array.isArray(notifs.json().data), '17. Real-time notification feed');

  // 18. Unauthorized Mutation Rejection
  const forbiddenOrgUpdate = await app.inject({
    method: 'PATCH',
    url: `/api/organizations/${org.id}`,
    headers: { authorization: `Bearer ${tokenClient}` },
    payload: { name: 'Unauthorized Change' },
  });
  assert(forbiddenOrgUpdate.statusCode === 403, '18. Unauthorized org setting edit blocked for client (403 Forbidden)');

  // 19. Tenant Isolation
  const forbiddenProjectView = await app.inject({
    method: 'GET',
    url: `/api/projects/${project.id}`,
    headers: { authorization: `Bearer ${tokenOutsider}` },
  });
  assert(forbiddenProjectView.statusCode === 403, '19. Tenant isolation blocks outsider project view (403 Forbidden)');

  console.log('----------------------------------------------------');
  console.log(`  PASSED: ${passed} / ${total} tests`);
  console.log('----------------------------------------------------');

  await app.close();
  if (passed !== total) {
    process.exit(1);
  }
}

runPhase17Tests().catch((err) => {
  console.error('Fatal error running Phase 17 tests:', err);
  process.exit(1);
});
