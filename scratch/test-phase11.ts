import { buildApp } from '../apps/api/src/app';
import { getDb } from '../apps/api/src/config/database';
import {
  users,
  organizations,
  projects,
  sessions,
  projectMembers,
  organizationMembers,
} from '../apps/api/src/db/schema';

async function runPhase11Tests() {
  console.log('====================================================');
  console.log('   INTENTFLOW PHASE 11 INTEGRATION VERIFICATION    ');
  console.log('====================================================\n');

  const app = buildApp();
  await app.ready();

  const db = getDb();

  // Cleanup database cleanly
  await db.delete(projectMembers);
  await db.delete(organizationMembers);
  await db.delete(projects);
  await db.delete(organizations);
  await db.delete(sessions);
  await db.delete(users);

  const createUser = async (name: string, email: string) => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: { name, email, password: 'Password123!' },
    });
    const body = JSON.parse(res.payload);
    return { token: body.data.token as string, userId: body.data.user.id as string };
  };

  const createOrg = async (token: string, name: string, slug: string) => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/organizations',
      headers: { authorization: `Bearer ${token}` },
      payload: { name, slug },
    });
    return JSON.parse(res.payload).data.id as string;
  };

  const addUserToOrg = async (userId: string, orgId: string, role: string) => {
    await db.insert(organizationMembers).values({
      organizationId: orgId,
      userId,
      role: role as any,
    }).onConflictDoNothing();
  };

  const createProject = async (token: string, orgId: string, name: string) => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: { organizationId: orgId, name },
    });
    return JSON.parse(res.payload).data.id as string;
  };

  console.log('1. Setting up Org A, Org B, and users for 8 role scenarios...');

  // Scenario Users:
  // 1. Org Admin (Alice)
  const adminA = await createUser('Alice Admin', 'alice@orga.com');
  const orgAId = await createOrg(adminA.token, 'Acme Org A', 'acme-a');

  // 2. Project Manager (Mark)
  const managerA = await createUser('Mark Manager', 'mark@orga.com');
  await addUserToOrg(managerA.userId, orgAId, 'developer');

  // 3. Project Developer (Dan)
  const devA = await createUser('Dan Developer', 'dan@orga.com');
  await addUserToOrg(devA.userId, orgAId, 'developer');

  // 4. Project Client (Carol)
  const clientA = await createUser('Carol Client', 'carol@orga.com');
  await addUserToOrg(clientA.userId, orgAId, 'client');

  // 5. Project Viewer (Victor)
  const viewerA = await createUser('Victor Viewer', 'victor@orga.com');
  await addUserToOrg(viewerA.userId, orgAId, 'developer');

  // 6. Unassigned Org Member (Uma)
  const unassignedA = await createUser('Uma Unassigned', 'uma@orga.com');
  await addUserToOrg(unassignedA.userId, orgAId, 'developer');

  // 7. User from another Org (Bob)
  const adminB = await createUser('Bob OrgB', 'bob@orgb.com');
  const orgBId = await createOrg(adminB.token, 'Acme Org B', 'acme-b');

  // Create Project A
  const projAId = await createProject(adminA.token, orgAId, 'Project Alpha');

  // Assign project roles
  await app.inject({
    method: 'POST',
    url: `/api/projects/${projAId}/members`,
    headers: { authorization: `Bearer ${adminA.token}` },
    payload: { userId: managerA.userId, projectRole: 'manager' },
  });

  await app.inject({
    method: 'POST',
    url: `/api/projects/${projAId}/members`,
    headers: { authorization: `Bearer ${adminA.token}` },
    payload: { userId: devA.userId, projectRole: 'developer' },
  });

  await app.inject({
    method: 'POST',
    url: `/api/projects/${projAId}/members`,
    headers: { authorization: `Bearer ${adminA.token}` },
    payload: { userId: clientA.userId, projectRole: 'client' },
  });

  await app.inject({
    method: 'POST',
    url: `/api/projects/${projAId}/members`,
    headers: { authorization: `Bearer ${adminA.token}` },
    payload: { userId: viewerA.userId, projectRole: 'viewer' },
  });

  console.log('\n---------------- TESTING 8 WORKSPACE SCENARIOS ----------------\n');

  // Scenario 1: Org Admin Access
  console.log('Scenario 1: Org Admin Access');
  const s1Res = await app.inject({
    method: 'GET',
    url: `/api/projects/${projAId}`,
    headers: { authorization: `Bearer ${adminA.token}` },
  });
  console.log('  Status:', s1Res.statusCode);
  if (s1Res.statusCode !== 200) throw new Error(`Scenario 1 Failed: ${s1Res.statusCode}`);
  console.log('  PASS ✓');

  // Scenario 2: Project Manager Access
  console.log('\nScenario 2: Project Manager Access');
  const s2Res = await app.inject({
    method: 'GET',
    url: `/api/projects/${projAId}/members`,
    headers: { authorization: `Bearer ${managerA.token}` },
  });
  console.log('  Status:', s2Res.statusCode);
  if (s2Res.statusCode !== 200) throw new Error(`Scenario 2 Failed: ${s2Res.statusCode}`);
  console.log('  PASS ✓');

  // Scenario 3: Project Developer Access
  console.log('\nScenario 3: Project Developer Access');
  const s3Res = await app.inject({
    method: 'GET',
    url: `/api/projects/${projAId}/work`,
    headers: { authorization: `Bearer ${devA.token}` },
  });
  console.log('  Status:', s3Res.statusCode);
  if (s3Res.statusCode !== 200) throw new Error(`Scenario 3 Failed: ${s3Res.statusCode}`);
  console.log('  PASS ✓');

  // Scenario 4: Project Client Access
  console.log('\nScenario 4: Project Client Access');
  const s4Res = await app.inject({
    method: 'GET',
    url: `/api/projects/${projAId}/deliverables`,
    headers: { authorization: `Bearer ${clientA.token}` },
  });
  console.log('  Status:', s4Res.statusCode);
  if (s4Res.statusCode !== 200) throw new Error(`Scenario 4 Failed: ${s4Res.statusCode}`);
  console.log('  PASS ✓');

  // Scenario 5: Project Viewer Access
  console.log('\nScenario 5: Project Viewer Access (View permitted, edit denied)');
  const s5ViewRes = await app.inject({
    method: 'GET',
    url: `/api/projects/${projAId}/members`,
    headers: { authorization: `Bearer ${viewerA.token}` },
  });
  console.log('  Viewer View Status:', s5ViewRes.statusCode);
  if (s5ViewRes.statusCode !== 200) throw new Error(`Scenario 5 View Failed: ${s5ViewRes.statusCode}`);

  const s5EditRes = await app.inject({
    method: 'POST',
    url: `/api/projects/${projAId}/members`,
    headers: { authorization: `Bearer ${viewerA.token}` },
    payload: { userId: unassignedA.userId, projectRole: 'developer' },
  });
  console.log('  Viewer Edit Status:', s5EditRes.statusCode);
  if (s5EditRes.statusCode !== 403) throw new Error(`Scenario 5 Edit Failed: Expected 403, got ${s5EditRes.statusCode}`);
  console.log('  PASS ✓');

  // Scenario 6: Unassigned Org Member Access
  console.log('\nScenario 6: Unassigned Org Member Access (Project View denied)');
  const s6Res = await app.inject({
    method: 'GET',
    url: `/api/projects/${projAId}`,
    headers: { authorization: `Bearer ${unassignedA.token}` },
  });
  console.log('  Status:', s6Res.statusCode);
  if (s6Res.statusCode !== 403) throw new Error(`Scenario 6 Failed: Expected 403, got ${s6Res.statusCode}`);
  console.log('  PASS ✓');

  // Scenario 7: User from another Organization Access
  console.log('\nScenario 7: User from another Org Access');
  const s7Res = await app.inject({
    method: 'GET',
    url: `/api/projects/${projAId}`,
    headers: { authorization: `Bearer ${adminB.token}` },
  });
  console.log('  Status:', s7Res.statusCode);
  if (s7Res.statusCode !== 403) throw new Error(`Scenario 7 Failed: Expected 403, got ${s7Res.statusCode}`);
  console.log('  PASS ✓');

  // Scenario 8: Unauthenticated User Access
  console.log('\nScenario 8: Unauthenticated User Access');
  const s8Res = await app.inject({
    method: 'GET',
    url: `/api/projects/${projAId}`,
  });
  console.log('  Status:', s8Res.statusCode);
  if (s8Res.statusCode !== 401) throw new Error(`Scenario 8 Failed: Expected 401, got ${s8Res.statusCode}`);
  console.log('  PASS ✓');

  console.log('\n====================================================');
  console.log('   ALL 8 PHASE 11 WORKSPACE SCENARIOS PASSED! 🎉    ');
  console.log('====================================================\n');

  await app.close();
  process.exit(0);
}

runPhase11Tests().catch((err) => {
  console.error('\n❌ INTEGRATION TEST FAILURE:', err);
  process.exit(1);
});
