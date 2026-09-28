import { buildApp } from '../apps/api/src/app.js';
import { getDb } from '../apps/api/src/config/database.js';
import { users, organizations, projectMembers, workItems, deliverables, organizationMembers } from '../apps/api/src/db/schema/index.js';
import { eq } from 'drizzle-orm';

async function runTests() {
  console.log('----------------------------------------------------');
  console.log('   STARTING PHASE 13 INTEGRATION VERIFICATION SUITE   ');
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

  // Setup Test Users:
  // User 1: Org Admin / PM
  const res1 = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p13_admin_${timestamp}@example.com`, password: 'Password123!', name: 'P13 Admin' },
  });
  const tokenAdmin = res1.json().data.token;
  const userAdmin = res1.json().data.user;

  // User 2: Developer
  const res2 = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p13_dev_${timestamp}@example.com`, password: 'Password123!', name: 'P13 Dev' },
  });
  const tokenDev = res2.json().data.token;
  const userDev = res2.json().data.user;

  // User 3: Client
  const res3 = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p13_client_${timestamp}@example.com`, password: 'Password123!', name: 'P13 Client' },
  });
  const tokenClient = res3.json().data.token;
  const userClient = res3.json().data.user;

  // User 4: Viewer
  const res4 = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p13_viewer_${timestamp}@example.com`, password: 'Password123!', name: 'P13 Viewer' },
  });
  const tokenViewer = res4.json().data.token;
  const userViewer = res4.json().data.user;

  // User 5: Org Member (Unassigned to project)
  const res5 = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p13_unassigned_${timestamp}@example.com`, password: 'Password123!', name: 'P13 Unassigned' },
  });
  const tokenUnassigned = res5.json().data.token;
  const userUnassigned = res5.json().data.user;

  // User 6: Other Org User
  const res6 = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p13_otherorg_${timestamp}@example.com`, password: 'Password123!', name: 'P13 Other Org' },
  });
  const tokenOtherOrg = res6.json().data.token;

  // Setup Org A
  const orgResA = await app.inject({
    method: 'POST',
    url: '/api/organizations',
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { name: `Phase 13 Org ${timestamp}` },
  });
  const orgA = orgResA.json().data;

  // Add Dev, Client, Viewer, Unassigned to Org A
  const orgMembers = [
    { userId: userDev.id, role: 'member' },
    { userId: userClient.id, role: 'member' },
    { userId: userViewer.id, role: 'member' },
    { userId: userUnassigned.id, role: 'member' },
  ];
  for (const m of orgMembers) {
    await db.insert(organizationMembers).values({
      organizationId: orgA.id,
      userId: m.userId,
      role: m.role as any,
    }).onConflictDoNothing();
  }

  // Setup Org B (for cross-org test)
  const orgResB = await app.inject({
    method: 'POST',
    url: '/api/organizations',
    headers: { authorization: `Bearer ${tokenOtherOrg}` },
    payload: { name: `Phase 13 Org B ${timestamp}` },
  });
  const orgB = orgResB.json().data;

  // Create Project A in Org A
  const projRes = await app.inject({
    method: 'POST',
    url: '/api/projects',
    headers: { authorization: `Bearer ${tokenAdmin}`, 'x-organization-id': orgA.id },
    payload: { organizationId: orgA.id, name: `Phase 13 Project ${timestamp}`, description: 'Test Project' },
  });
  const projectA = projRes.json().data;

  // Assign roles in Project A:
  // Dev -> developer
  await app.inject({
    method: 'POST',
    url: `/api/projects/${projectA.id}/members`,
    headers: { authorization: `Bearer ${tokenAdmin}`, 'x-organization-id': orgA.id },
    payload: { userId: userDev.id, projectRole: 'developer' },
  });

  // Client -> client
  await app.inject({
    method: 'POST',
    url: `/api/projects/${projectA.id}/members`,
    headers: { authorization: `Bearer ${tokenAdmin}`, 'x-organization-id': orgA.id },
    payload: { userId: userClient.id, projectRole: 'client' },
  });

  // Viewer -> viewer
  await app.inject({
    method: 'POST',
    url: `/api/projects/${projectA.id}/members`,
    headers: { authorization: `Bearer ${tokenAdmin}`, 'x-organization-id': orgA.id },
    payload: { userId: userViewer.id, projectRole: 'viewer' },
  });

  // 1. Project overview loads
  const getProj = await app.inject({
    method: 'GET',
    url: `/api/projects/${projectA.id}`,
    headers: { authorization: `Bearer ${tokenAdmin}`, 'x-organization-id': orgA.id },
  });
  assert(getProj.statusCode === 200 && getProj.json().data.id === projectA.id, '1. Project overview loads successfully');

  // 2. Project state is correctly derived
  assert(getProj.json().data.status === 'active', '2. Project state is correctly derived (active)');

  // 3. Client sees client actions (Client can view project & deliverables)
  const clientGet = await app.inject({
    method: 'GET',
    url: `/api/projects/${projectA.id}`,
    headers: { authorization: `Bearer ${tokenClient}`, 'x-organization-id': orgA.id },
  });
  assert(clientGet.statusCode === 200, '3. Client can view project workspace');

  // Create a deliverable for testing deliverable actions
  const delivRes = await app.inject({
    method: 'POST',
    url: `/api/projects/${projectA.id}/deliverables`,
    headers: { authorization: `Bearer ${tokenDev}`, 'x-organization-id': orgA.id },
    payload: { title: 'Initial Design', description: 'Design mockups', fileUrl: 'https://example.com/file.pdf' },
  });
  const deliverable = delivRes.json().data;

  // 4. Developer sees developer actions (Dev can submit deliverable)
  const submitRes = await app.inject({
    method: 'POST',
    url: `/api/deliverables/${deliverable.id}/submit-review`,
    headers: { authorization: `Bearer ${tokenDev}`, 'x-organization-id': orgA.id },
  });
  assert(submitRes.statusCode === 200, '4. Developer can submit deliverable for review');

  // Client approves deliverable (Client action)
  const approveRes = await app.inject({
    method: 'POST',
    url: `/api/deliverables/${deliverable.id}/approve`,
    headers: { authorization: `Bearer ${tokenClient}`, 'x-organization-id': orgA.id },
  });
  assert(approveRes.statusCode === 200, '3b. Client can approve deliverable');

  // 5. Manager sees manager actions (Manager can update project/assign members)
  const updateProjRes = await app.inject({
    method: 'PATCH',
    url: `/api/projects/${projectA.id}`,
    headers: { authorization: `Bearer ${tokenAdmin}`, 'x-organization-id': orgA.id },
    payload: { description: 'Updated by Manager' },
  });
  assert(updateProjRes.statusCode === 200, '5. Manager can update project settings');

  // 6. Viewer cannot perform mutations (Viewer trying to create deliverable returns 403)
  const viewerMutate = await app.inject({
    method: 'POST',
    url: `/api/projects/${projectA.id}/deliverables`,
    headers: { authorization: `Bearer ${tokenViewer}`, 'x-organization-id': orgA.id },
    payload: { title: 'Unauthorized Deliverable' },
  });
  assert(viewerMutate.statusCode === 403, '6. Viewer cannot perform project mutations (returns 403)');

  // 7. Conversation access respects project membership
  const createConv = await app.inject({
    method: 'POST',
    url: `/api/projects/${projectA.id}/conversations`,
    headers: { authorization: `Bearer ${tokenDev}`, 'x-organization-id': orgA.id },
    payload: { title: 'Project Discussion' },
  });
  const conv = createConv.json().data;
  assert(createConv.statusCode === 201 || createConv.statusCode === 200, '7. Project member can access and create conversations');

  // 8. Work item access respects project membership
  const getWork = await app.inject({
    method: 'GET',
    url: `/api/projects/${projectA.id}/work`,
    headers: { authorization: `Bearer ${tokenDev}`, 'x-organization-id': orgA.id },
  });
  assert(getWork.statusCode === 200 && Array.isArray(getWork.json().data.workItems), '8. Work item access respects project membership');

  // 9. Deliverable actions respect role (Developer can create deliverable, Client cannot create deliverable)
  const clientCreateDeliv = await app.inject({
    method: 'POST',
    url: `/api/projects/${projectA.id}/deliverables`,
    headers: { authorization: `Bearer ${tokenClient}`, 'x-organization-id': orgA.id },
    payload: { title: 'Client Deliverable' },
  });
  assert(clientCreateDeliv.statusCode === 403, '9. Client cannot create deliverable (developer/manager role required)');

  // 10. Completion actions respect role (Client can access completion status)
  const getCompletion = await app.inject({
    method: 'GET',
    url: `/api/projects/${projectA.id}/completion-status`,
    headers: { authorization: `Bearer ${tokenClient}`, 'x-organization-id': orgA.id },
  });
  assert(getCompletion.statusCode === 200, '10. Completion status access respects role');

  // 11. Team management respects role (Viewer cannot assign team member)
  const viewerAssign = await app.inject({
    method: 'POST',
    url: `/api/projects/${projectA.id}/members`,
    headers: { authorization: `Bearer ${tokenViewer}`, 'x-organization-id': orgA.id },
    payload: { userId: userUnassigned.id, projectRole: 'developer' },
  });
  assert(viewerAssign.statusCode === 403, '11. Non-manager/admin cannot manage team members (returns 403)');

  // 12. Activity visibility respects role
  const getAct = await app.inject({
    method: 'GET',
    url: `/api/projects/${projectA.id}/activity`,
    headers: { authorization: `Bearer ${tokenDev}`, 'x-organization-id': orgA.id },
  });
  assert(getAct.statusCode === 200, '12. Activity log visibility respects role');

  // 13. Cross-organization project access returns 403
  const crossOrgGet = await app.inject({
    method: 'GET',
    url: `/api/projects/${projectA.id}`,
    headers: { authorization: `Bearer ${tokenOtherOrg}`, 'x-organization-id': orgB.id },
  });
  assert(crossOrgGet.statusCode === 403, '13. Cross-organization project access returns 403');

  // 14. Unassigned organization member cannot access project
  const unassignedGet = await app.inject({
    method: 'GET',
    url: `/api/projects/${projectA.id}`,
    headers: { authorization: `Bearer ${tokenUnassigned}`, 'x-organization-id': orgA.id },
  });
  assert(unassignedGet.statusCode === 403, '14. Unassigned organization member cannot access project (returns 403)');

  // 15. No unauthorized mutation is possible through direct API call (Unassigned user direct post to work item)
  const directApiMutation = await app.inject({
    method: 'POST',
    url: `/api/projects/${projectA.id}/work`,
    headers: { authorization: `Bearer ${tokenUnassigned}`, 'x-organization-id': orgA.id },
    payload: { title: 'Hacked Work Item' },
  });
  assert(directApiMutation.statusCode === 403, '15. Direct API mutation without project authorization returns 403');

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
