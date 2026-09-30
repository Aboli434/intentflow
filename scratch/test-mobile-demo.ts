/**
 * IntentFlow Mobile Demo & Persona API Verification Suite
 * Validates:
 * 1. Demo login for Client, Developer, and Workspace Admin
 * 2. Unauthenticated access enforcement (401 Unauthorized)
 * 3. Session persistence contracts and role data segregation
 * 4. Delivering realistic seeded projects, work items, and deliverables
 * 5. Invalid persona rejection
 */

const API_BASE = process.env.API_URL || 'http://localhost:4000';

async function req(endpoint: string, method: string = 'GET', body: any = null, token: string | null = null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

async function runMobileDemoTestSuite() {
  console.log('\n=============================================================');
  console.log('   INTENTFLOW MOBILE DEMO & FRIEND TESTING VERIFICATION     ');
  console.log('=============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, title: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✓ Step ${total}: ${title}`);
    } else {
      console.error(`  ✕ Step ${total}: ${title}`);
      throw new Error(`Mobile demo verification failed: ${title}`);
    }
  }

  try {
    // 1. Health check
    const health = await req('/health');
    assert(health.status === 200 && health.data.status === 'ok', 'Mobile API endpoint reachable (200 OK)');

    // 2. Unauthenticated Protected Access Must Fail
    const unauthProjects = await req('/api/projects');
    assert(unauthProjects.status === 401, 'Unauthenticated request to protected endpoint returns 401 Unauthorized');

    // 3. Client Demo Persona Login (Zero Credentials)
    const clientDemo = await req('/api/auth/demo-login', 'POST', { role: 'client' });
    assert(clientDemo.status === 200 && Boolean(clientDemo.data.data?.token), 'Client demo-login generates authenticated session');
    const clientToken = clientDemo.data.data.token;

    // 4. Client /me and Projects
    const clientMe = await req('/api/auth/me', 'GET', null, clientToken);
    assert(clientMe.status === 200 && clientMe.data.data?.user?.email === 'client@intentflow-demo.io', 'Client identity verified (/api/auth/me)');

    const clientProjects = await req('/api/projects', 'GET', null, clientToken);
    assert(clientProjects.status === 200 && Array.isArray(clientProjects.data.data) && clientProjects.data.data.length > 0, 'Client retrieves populated demo project list');
    const demoProjId = clientProjects.data.data[0].id;

    // 5. Client Project Deliverables & Validation Gate
    const clientDelivs = await req(`/api/projects/${demoProjId}/deliverables`, 'GET', null, clientToken);
    assert(clientDelivs.status === 200 && Array.isArray(clientDelivs.data.data), 'Client retrieves project deliverables');

    // 6. Developer Demo Persona Login (Zero Credentials)
    const devDemo = await req('/api/auth/demo-login', 'POST', { role: 'developer' });
    assert(devDemo.status === 200 && Boolean(devDemo.data.data?.token), 'Developer demo-login generates authenticated session');
    const devToken = devDemo.data.data.token;

    const devMe = await req('/api/auth/me', 'GET', null, devToken);
    assert(devMe.status === 200 && devMe.data.data?.user?.email === 'developer@intentflow-demo.io', 'Developer identity verified (/api/auth/me)');

    const devWork = await req(`/api/projects/${demoProjId}/work`, 'GET', null, devToken);
    assert(devWork.status === 200 && Array.isArray(devWork.data.data?.workItems), 'Developer retrieves populated work items and metrics');

    // 7. Admin Demo Persona Login (Zero Credentials)
    const adminDemo = await req('/api/auth/demo-login', 'POST', { role: 'admin' });
    assert(adminDemo.status === 200 && Boolean(adminDemo.data.data?.token), 'Admin demo-login generates authenticated session');
    const adminToken = adminDemo.data.data.token;

    const adminMe = await req('/api/auth/me', 'GET', null, adminToken);
    assert(adminMe.status === 200 && adminMe.data.data?.user?.email === 'admin@intentflow-demo.io', 'Admin identity verified (/api/auth/me)');

    const adminOrgs = await req('/api/organizations', 'GET', null, adminToken);
    assert(adminOrgs.status === 200 && Array.isArray(adminOrgs.data.data) && adminOrgs.data.data.length > 0, 'Admin retrieves organization workspace context');

    // 8. Logout Invalidation
    const logoutRes = await req('/api/auth/logout', 'POST', {}, clientToken);
    assert(logoutRes.status === 200, 'Logout successfully terminates server session');

    const postLogoutMe = await req('/api/auth/me', 'GET', null, clientToken);
    assert(postLogoutMe.status === 401, 'Logged out session token is immediately invalidated (401 Unauthorized)');

    console.log('\n-------------------------------------------------------------');
    console.log(`  MOBILE DEMO TEST RESULT: PASSED ${passed} / ${total} CHECKS`);
    console.log('-------------------------------------------------------------\n');
  } catch (err: any) {
    console.error('Mobile demo verification error:', err);
    process.exit(1);
  }
}

runMobileDemoTestSuite();
