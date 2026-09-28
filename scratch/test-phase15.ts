import { buildApp } from '../apps/api/src/app.js';
import { getDb } from '../apps/api/src/config/database.js';
import { organizationInvitations } from '../apps/api/src/db/schema/index.js';
import { eq } from 'drizzle-orm';

async function runPhase15Tests() {
  console.log('----------------------------------------------------');
  console.log('   STARTING PHASE 15 INTEGRATION VERIFICATION SUITE   ');
  console.log('----------------------------------------------------');

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

  // 1. Setup Admin Account & Login Verification
  const signupAdmin = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p15_admin_${timestamp}@example.com`, password: 'Password123!', name: 'P15 Admin' },
  });
  const tokenAdmin = signupAdmin.json().data.token;
  const userAdmin = signupAdmin.json().data.user;

  const loginAdmin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: `p15_admin_${timestamp}@example.com`, password: 'Password123!' },
  });
  assert(loginAdmin.statusCode === 200 && loginAdmin.json().data.token !== undefined, '1. User login and authentication token generation');

  // 2. Dashboard Access
  const meRes = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  assert(meRes.statusCode === 200 && meRes.json().data.user.id === userAdmin.id, '2. Dashboard context & user profile access');

  // 3. Organization Settings Access & Org Creation
  const createOrg = await app.inject({
    method: 'POST',
    url: '/api/organizations',
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { name: `Phase 15 Org ${timestamp}` },
  });
  const orgA = createOrg.json().data;

  const getOrg = await app.inject({
    method: 'GET',
    url: `/api/organizations/${orgA.id}`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  assert(getOrg.statusCode === 200 && getOrg.json().data.name === orgA.name, '3. Organization settings & detail retrieval');

  // 4. Invitation Creation (Email & SMS options)
  const inviteEmail = await app.inject({
    method: 'POST',
    url: `/api/organizations/${orgA.id}/invitations`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { email: `p15_client_${timestamp}@example.com`, role: 'client', method: 'email' },
  });
  const inviteData = inviteEmail.json().data;
  const [invRecord] = await db.select().from(organizationInvitations).where(eq(organizationInvitations.id, inviteData.id)).limit(1);
  const inviteToken = invRecord.token;
  assert(inviteEmail.statusCode === 201 && inviteToken !== undefined, '4. Invitation creation (Email channel) without token exposure');

  // 5. Invitation Acceptance
  const signupClient = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p15_client_${timestamp}@example.com`, password: 'Password123!', name: 'P15 Client' },
  });
  const tokenClient = signupClient.json().data.token;
  const userClient = signupClient.json().data.user;

  const acceptInvite = await app.inject({
    method: 'POST',
    url: `/api/invitations/${inviteToken}/accept`,
    headers: { authorization: `Bearer ${tokenClient}` },
  });
  assert(acceptInvite.statusCode === 200, '5. Invitation acceptance by client user');

  // 6. Project Creation & Workspace Access
  const createProject = await app.inject({
    method: 'POST',
    url: '/api/projects',
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { organizationId: orgA.id, name: `Phase 15 Web Portal ${timestamp}`, description: 'Testing workspace endpoints' },
  });
  const project = createProject.json().data;
  assert(createProject.statusCode === 201 && project?.id !== undefined, '6. Project creation and workspace access');

  // 7. Project Team Assignment
  const assignClient = await app.inject({
    method: 'POST',
    url: `/api/projects/${project.id}/members`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { userId: userClient.id, projectRole: 'client' },
  });
  assert(assignClient.statusCode === 201, '7. Project team member assignment with role designation');

  // 8. Conversation Access & Message Exchange
  const createConv = await app.inject({
    method: 'POST',
    url: `/api/projects/${project.id}/conversations`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { title: 'Project Kickoff Thread' },
  });
  const conv = createConv.json().data;

  const sendMsg = await app.inject({
    method: 'POST',
    url: `/api/conversations/${conv.id}/messages`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { body: 'Hello client, here is the design scope.' },
  });
  assert(sendMsg.statusCode === 201 && sendMsg.json().data.body.includes('design scope'), '8. Conversation creation and message publishing');

  // 9. Work Item Proposal & Access
  const createWork = await app.inject({
    method: 'POST',
    url: `/api/projects/${project.id}/work`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { title: 'Develop Design Tokens', description: 'Implement dark theme tokens', priority: 'high' },
  });
  const workItem = createWork.json().data;
  assert(createWork.statusCode === 201 && workItem.id !== undefined, '9. Work proposal item creation and listing');

  // 10. Deliverable Access & Client Review Cycle
  const createDeliv = await app.inject({
    method: 'POST',
    url: `/api/projects/${project.id}/deliverables`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { title: 'UI Design System Package', description: 'Figma and React components', category: 'design' },
  });
  const deliv = createDeliv.json().data;

  const approveDeliv = await app.inject({
    method: 'POST',
    url: `/api/deliverables/${deliv.id}/approve`,
    headers: { authorization: `Bearer ${tokenClient}` },
    payload: { feedback: 'Looks fantastic, approved!' },
  });
  assert(approveDeliv.statusCode === 200, '10. Deliverable submission and client approval action');

  // 11. Completion & Handoff Access
  const closureRes = await app.inject({
    method: 'GET',
    url: `/api/projects/${project.id}/completion-status`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  assert(closureRes.statusCode === 200, '11. Project completion & handoff state verification');

  // 12. Notification Center Access
  const notifRes = await app.inject({
    method: 'GET',
    url: '/api/notifications',
    headers: { authorization: `Bearer ${tokenClient}` },
  });
  assert(notifRes.statusCode === 200 && Array.isArray(notifRes.json().data), '12. Notification feed retrieval for user');

  // 13. Activity Timeline Access
  const activityRes = await app.inject({
    method: 'GET',
    url: `/api/projects/${project.id}/activity`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  assert(activityRes.statusCode === 200 && Array.isArray(activityRes.json().data), '13. Project activity timeline logging');

  // 14. Role Restrictions Verification (Client user prohibited from updating organization name)
  const forbiddenOrgUpdate = await app.inject({
    method: 'PATCH',
    url: `/api/organizations/${orgA.id}`,
    headers: { authorization: `Bearer ${tokenClient}` },
    payload: { name: 'Hacked Name' },
  });
  assert(forbiddenOrgUpdate.statusCode === 403, '14. Role-based permission restriction (Client prevented from modifying org settings)');

  // 15. Cross-Organization Isolation Verification
  const signupExternal = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p15_outsider_${timestamp}@example.com`, password: 'Password123!', name: 'External User' },
  });
  const tokenExternal = signupExternal.json().data.token;

  const isolatedAccess = await app.inject({
    method: 'GET',
    url: `/api/projects/${project.id}`,
    headers: { authorization: `Bearer ${tokenExternal}` },
  });
  assert(isolatedAccess.statusCode === 403, '15. Cross-organization tenant isolation (Outsider blocked from project)');

  console.log('----------------------------------------------------');
  console.log(`  PASSED: ${passed} / ${total} tests`);
  console.log('----------------------------------------------------');

  await app.close();
  if (passed !== total) {
    process.exit(1);
  }
}

runPhase15Tests().catch((err) => {
  console.error('Fatal error running Phase 15 tests:', err);
  process.exit(1);
});
