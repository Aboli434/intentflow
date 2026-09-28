import { buildApp } from '../apps/api/src/app.js';
import { getDb } from '../apps/api/src/config/database.js';
import { organizationInvitations, attachments } from '../apps/api/src/db/schema/index.js';
import { eq } from 'drizzle-orm';
import { normalizePhoneNumber, EmailInvitationProvider, SmsInvitationProvider } from '../apps/api/src/services/invitations/invitation-delivery.service.js';
import { StorageService } from '../apps/api/src/services/storage/storage.service.js';

import { ensurePhase16Schema } from '../apps/api/src/config/database.js';

async function runPhase16Tests() {
  console.log('----------------------------------------------------');
  console.log('   STARTING PHASE 16 INTEGRATION VERIFICATION SUITE   ');
  console.log('----------------------------------------------------');

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

  // 1. Phone Normalization Unit Check
  const normalized = normalizePhoneNumber('9876543210', '+91');
  assert(normalized === '+919876543210', '1. Phone number normalization to E.164');

  // 2. Email Provider Abstraction Test
  const emailProvider = new EmailInvitationProvider();
  const emailRes = await emailProvider.sendInvitation({
    destination: `p16_test_${timestamp}@example.com`,
    invitationUrl: 'http://localhost:3000/invite/testtoken',
    organizationName: 'Test Org',
    role: 'client',
    invitationMethod: 'email',
  });
  assert(emailRes.success && emailRes.status === 'sent', '2. Email provider abstraction dispatching HTML template');

  // 3. SMS Provider Abstraction Test
  const smsProvider = new SmsInvitationProvider();
  const smsRes = await smsProvider.sendInvitation({
    destination: '+919876543210',
    invitationUrl: 'http://localhost:3000/invite/testtoken',
    organizationName: 'Test Org',
    role: 'developer',
    invitationMethod: 'sms',
  });
  assert(smsRes.success && smsRes.status === 'sent', '3. SMS provider abstraction dispatching SMS message');

  // 4. Setup Admin & Org
  const signupAdmin = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p16_admin_${timestamp}@example.com`, password: 'Password123!', name: 'P16 Admin' },
  });
  const tokenAdmin = signupAdmin.json().data.token;
  const userAdmin = signupAdmin.json().data.user;

  const createOrg = await app.inject({
    method: 'POST',
    url: '/api/organizations',
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { name: `Phase 16 Org ${timestamp}` },
  });
  const org = createOrg.json().data;

  // 5. Invitation Delivery & Metadata Tracking
  const createInvite = await app.inject({
    method: 'POST',
    url: `/api/organizations/${org.id}/invitations`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { email: `p16_client_${timestamp}@example.com`, role: 'client', method: 'email' },
  });
  const invData = createInvite.json().data;
  assert(createInvite.statusCode === 201 && invData.sentAt !== undefined && invData.status === 'sent', '5. Invitation creation with delivery tracking metadata');

  // 6. Resend Invitation Endpoint
  const resendInvite = await app.inject({
    method: 'POST',
    url: `/api/organizations/${org.id}/invitations/${invData.id}/resend`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  assert(resendInvite.statusCode === 200 && resendInvite.json().data.lastDeliveryAttempt !== undefined, '6. Resend invitation endpoint re-dispatching email/SMS');

  // 7. Accept Invitation
  const [invRecord] = await db.select().from(organizationInvitations).where(eq(organizationInvitations.id, invData.id)).limit(1);
  const signupClient = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p16_client_${timestamp}@example.com`, password: 'Password123!', name: 'P16 Client' },
  });
  const tokenClient = signupClient.json().data.token;
  const userClient = signupClient.json().data.user;

  const acceptRes = await app.inject({
    method: 'POST',
    url: `/api/invitations/${invRecord.token}/accept`,
    headers: { authorization: `Bearer ${tokenClient}` },
  });
  assert(acceptRes.statusCode === 200, '7. Client user accepts invitation and joins organization');

  // 8. Create Project & Assign Team Member
  const createProj = await app.inject({
    method: 'POST',
    url: '/api/projects',
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { organizationId: org.id, name: `P16 Production SaaS ${timestamp}` },
  });
  const project = createProj.json().data;

  const assignMember = await app.inject({
    method: 'POST',
    url: `/api/projects/${project.id}/members`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { userId: userClient.id, projectRole: 'client' },
  });
  assert(assignMember.statusCode === 201, '8. Member assignment with project role designation');

  // 9. Storage Service Abstraction Unit Test
  const storageService = new StorageService();
  const testFileKey = `test_${timestamp}.txt`;
  await storageService.getProvider().saveFile(testFileKey, Buffer.from('IntentFlow Storage Abstraction Unit Test'));
  const retrievedStream = await storageService.getProvider().getFileStream(testFileKey);
  let readChunks: Buffer[] = [];
  for await (const chunk of retrievedStream) {
    readChunks.push(Buffer.from(chunk));
  }
  const readContent = Buffer.concat(readChunks).toString('utf-8');
  assert(readContent.includes('IntentFlow Storage Abstraction'), '9. Storage abstraction provider save & stream retrieval');
  await storageService.getProvider().deleteFile(testFileKey);

  // 10. Attachment Upload with Project Authorization
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const multipartBody = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="projectId"',
    '',
    project.id,
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="specifications.pdf"',
    'Content-Type: application/pdf',
    '',
    'PDF content demo for Phase 16',
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
  const attachmentData = uploadRes.json().data;
  assert(uploadRes.statusCode === 201 && attachmentData?.id !== undefined, '10. Attachment file upload with project authorization');

  // 11. Secure Attachment Download & Cross-Org Isolation Rejection
  const downloadRes = await app.inject({
    method: 'GET',
    url: `/api/attachments/${attachmentData.id}/download`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  assert(downloadRes.statusCode === 200, '11a. Secure attachment file download for authorized user');

  const signupOutsider = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p16_outsider_${timestamp}@example.com`, password: 'Password123!', name: 'P16 Outsider' },
  });
  const tokenOutsider = signupOutsider.json().data.token;

  const forbiddenDownload = await app.inject({
    method: 'GET',
    url: `/api/attachments/${attachmentData.id}/download`,
    headers: { authorization: `Bearer ${tokenOutsider}` },
  });
  assert(forbiddenDownload.statusCode === 403, '11b. Cross-organization file download rejection (403 Forbidden)');

  // 12. List Project Attachments
  const listFiles = await app.inject({
    method: 'GET',
    url: `/api/projects/${project.id}/attachments`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  assert(listFiles.statusCode === 200 && listFiles.json().data.length > 0, '12. Project attachments listing');

  // 13. Deliverables Submission & Client Approval Lifecycle
  const createDeliv = await app.inject({
    method: 'POST',
    url: `/api/projects/${project.id}/deliverables`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { title: 'Backend API Specifications', category: 'architecture' },
  });
  const deliv = createDeliv.json().data;

  const submitDeliv = await app.inject({
    method: 'POST',
    url: `/api/deliverables/${deliv.id}/submit`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  assert(submitDeliv.statusCode === 200, '13a. Deliverable submitted for client review');

  const approveDeliv = await app.inject({
    method: 'POST',
    url: `/api/deliverables/${deliv.id}/approve`,
    headers: { authorization: `Bearer ${tokenClient}` },
    payload: { feedback: 'Approved by client' },
  });
  assert(approveDeliv.statusCode === 200, '13b. Client approves submitted deliverable');

  // 14. Work Execution Status Update
  const createWork = await app.inject({
    method: 'POST',
    url: `/api/projects/${project.id}/work`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { title: 'Setup WebSocket Reconnection Logic', priority: 'high' },
  });
  const workItem = createWork.json().data;

  const updateWorkStatus = await app.inject({
    method: 'PATCH',
    url: `/api/work/${workItem.id}/status`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { status: 'completed' },
  });
  assert(updateWorkStatus.statusCode === 200 && updateWorkStatus.json().data.status === 'completed', '14. Work item status transition to completed');

  // 15. Completion Readiness & Checklist
  const completionStatus = await app.inject({
    method: 'GET',
    url: `/api/projects/${project.id}/completion-status`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  assert(completionStatus.statusCode === 200 && completionStatus.json().data.eligible !== undefined, '15. Project completion readiness evaluation');

  // 16. Notification Feed Synchronization
  const notifs = await app.inject({
    method: 'GET',
    url: '/api/notifications',
    headers: { authorization: `Bearer ${tokenClient}` },
  });
  assert(notifs.statusCode === 200 && Array.isArray(notifs.json().data), '16. Real-time notification synchronization feed');

  // 17. Unauthorized Mutation Rejection
  const forbiddenOrgUpdate = await app.inject({
    method: 'PATCH',
    url: `/api/organizations/${org.id}`,
    headers: { authorization: `Bearer ${tokenClient}` },
    payload: { name: 'Hacked Name' },
  });
  assert(forbiddenOrgUpdate.statusCode === 403, '17. Role-based permission restriction (Client prevented from updating org settings)');

  // 18. Cross-Organization Isolation Rejection
  const forbiddenProjectView = await app.inject({
    method: 'GET',
    url: `/api/projects/${project.id}`,
    headers: { authorization: `Bearer ${tokenOutsider}` },
  });
  assert(forbiddenProjectView.statusCode === 403, '18. Cross-organization tenant isolation (Outsider blocked from project)');

  console.log('----------------------------------------------------');
  console.log(`  PASSED: ${passed} / ${total} tests`);
  console.log('----------------------------------------------------');

  await app.close();
  if (passed !== total) {
    process.exit(1);
  }
}

runPhase16Tests().catch((err) => {
  console.error('Fatal error running Phase 16 tests:', err);
  process.exit(1);
});
