/**
 * IntentFlow Phase 23 Integration & Business Logic Test Suite
 * Exercises Client, Developer, and Admin persona flows, form validation, authorization,
 * tenant isolation, deliverables change request validation, and project workspace features.
 */

import http from 'http';
import { getDb } from '../apps/api/src/config/database.js';
import { organizationInvitations } from '../apps/api/src/db/schema/index.js';
import { eq } from 'drizzle-orm';


const API_BASE = process.env.API_URL || 'http://localhost:4000';

function makeRequest(
  path: string,
  method: string = 'GET',
  body: any = null,
  token: string | null = null
): Promise<{ status: number; data: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers!['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode || 500, data: parsed, headers: res.headers });
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runPhase23IntegrationSuite() {
  console.log('\n====================================================');
  console.log('   INTENTFLOW PHASE 23 INTEGRATION TEST SUITE       ');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, title: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✓ Test ${total}: ${title}`);
    } else {
      console.error(`  ✕ Test ${total}: ${title}`);
      throw new Error(`Integration test failed: ${title}`);
    }
  }

  try {
    // 1. Health check
    const health = await makeRequest('/health');
    assert(health.status === 200 && health.data.status === 'ok', 'API Health Check returns 200 OK');

    // 2. Developer Signup
    const devEmail = `dev.phase23.${Date.now()}@example.com`;
    const devSignup = await makeRequest('/api/auth/signup', 'POST', {
      email: devEmail,
      password: 'Password123!',
      name: 'Phase23 Developer',
      organizationName: `Phase 23 Dev Org ${Date.now()}`,
    });
    const devPayload = devSignup.data.data || devSignup.data;
    console.log('devSignup Debug:', JSON.stringify(devSignup.data));
    assert(devSignup.status === 201 && Boolean(devPayload.token), 'Developer signup succeeds');
    const devToken = devPayload.token;
    
    // Create Organization for Developer
    const orgRes = await makeRequest(
      '/api/organizations',
      'POST',
      { name: `Phase 23 Dev Org ${Date.now()}` },
      devToken
    );
    console.log('orgRes Debug:', orgRes.status, JSON.stringify(orgRes.data));
    const orgPayload = orgRes.data.data || orgRes.data;
    const orgId = orgPayload.id;

    // 3. Client Invitation
    const clientEmail = `client.phase23.${Date.now()}@example.com`;
    const inviteRes = await makeRequest(
      `/api/organizations/${orgId}/invitations`,
      'POST',
      { method: 'email', email: clientEmail, role: 'client' },
      devToken
    );
    const invitePayload = inviteRes.data.data || inviteRes.data;
    console.log('invitePayload Debug:', JSON.stringify(invitePayload));
    assert(inviteRes.status === 201 && Boolean(invitePayload.id), 'Client email invitation created');

    // Fetch token from database for invitation signup
    const db = getDb();
    const tokenRows = await db
      .select({ token: organizationInvitations.token })
      .from(organizationInvitations)
      .where(eq(organizationInvitations.id, invitePayload.id))
      .limit(1);
    const inviteToken = tokenRows[0].token;

    // 4. Client Signup with Token
    const clientSignup = await makeRequest('/api/auth/signup', 'POST', {
      email: clientEmail,
      password: 'Password123!',
      name: 'Phase23 Client',
      invitationToken: inviteToken,
    });
    const clientPayload = clientSignup.data.data || clientSignup.data;
    assert(clientSignup.status === 201 && Boolean(clientPayload.token), 'Client signup with token succeeds');
    const clientToken = clientPayload.token;

    // 5. Create Project
    const projRes = await makeRequest(
      '/api/projects',
      'POST',
      { organizationId: orgId, name: 'Phase 23 SaaS Overhaul Project', description: 'Testing Phase 23 UX' },
      devToken
    );
    const projPayload = projRes.data.data || projRes.data;
    assert(projRes.status === 201 && Boolean(projPayload.id), 'Project creation succeeds');
    const projId = projPayload.id;

    // 6. Assign Client to Project Team
    const assignClient = await makeRequest(
      `/api/projects/${projId}/members`,
      'POST',
      { userId: clientPayload.user.id, projectRole: 'client' },
      devToken
    );
    assert(assignClient.status === 201, 'Client assigned to project team as client');

    // 7. Work Item Creation
    const workRes = await makeRequest(
      `/api/projects/${projId}/work`,
      'POST',
      { title: 'UX Redesign Task', description: 'Enhance form validation and responsive drawer', priority: 'high' },
      devToken
    );
    const workPayload = workRes.data.data || workRes.data;
    assert(workRes.status === 201 && Boolean(workPayload.id), 'Work item creation succeeds');
    const workId = workPayload.id;

    // 8. Work Status Transition
    const statusRes = await makeRequest(
      `/api/work/${workId}/status`,
      'PATCH',
      { status: 'in_progress' },
      devToken
    );
    const statusPayload = statusRes.data.data || statusRes.data;
    assert(statusRes.status === 200 && statusPayload.status === 'in_progress', 'Work status updated to in_progress');

    // 9. Deliverable Creation
    const delivRes = await makeRequest(
      `/api/projects/${projId}/deliverables`,
      'POST',
      { title: 'Dashboard UI Package', description: 'Redesigned dashboard cards and action items' },
      devToken
    );
    const delivPayload = delivRes.data.data || delivRes.data;
    assert(delivRes.status === 201 && Boolean(delivPayload.id), 'Deliverable package created');
    const delivId = delivPayload.id;

    // 10. Submit Deliverable
    const submitDeliv = await makeRequest(`/api/deliverables/${delivId}/submit`, 'POST', {}, devToken);
    assert(submitDeliv.status === 200, 'Deliverable submitted for review');

    // 11. Client Change Request with < 10 Chars (Should fail validation)
    const invalidChangeReq = await makeRequest(
      `/api/deliverables/${delivId}/request-changes`,
      'POST',
      { comment: 'Short' },
      clientToken
    );
    assert(invalidChangeReq.status === 400 || invalidChangeReq.status === 422, 'Deliverable change request < 10 characters rejected (validation error)');

    // 12. Client Change Request with >= 10 Chars (Should succeed)
    const validChangeReq = await makeRequest(
      `/api/deliverables/${delivId}/request-changes`,
      'POST',
      { comment: 'Please adjust the header contrast and font size to match specifications.' },
      clientToken
    );
    assert(validChangeReq.status === 200, 'Client change request with >= 10 characters succeeds');

    // 13. Re-submit Deliverable
    const resubmitDeliv = await makeRequest(`/api/deliverables/${delivId}/submit`, 'POST', {}, devToken);
    assert(resubmitDeliv.status === 200, 'Deliverable re-submitted after revision');

    // 14. Client Approval
    const approveDeliv = await makeRequest(`/api/deliverables/${delivId}/approve`, 'POST', {}, clientToken);
    const approvePayload = approveDeliv.data.data || approveDeliv.data;
    assert(approveDeliv.status === 200 && approvePayload.status === 'approved', 'Client deliverable approval succeeds');

    // 15. Tenant Isolation Test
    const outsiderSignup = await makeRequest('/api/auth/signup', 'POST', {
      email: `outsider.${Date.now()}@example.com`,
      password: 'Password123!',
      name: 'Outsider User',
      organizationName: `Outsider Org ${Date.now()}`,
    });
    const outsiderPayload = outsiderSignup.data.data || outsiderSignup.data;
    const outsiderAccess = await makeRequest(`/api/projects/${projId}`, 'GET', null, outsiderPayload.token);
    assert(outsiderAccess.status === 403, 'Tenant isolation blocks unauthorized project access (403 Forbidden)');

    console.log('\n----------------------------------------------------');
    console.log(`  INTEGRATION RESULT: PASSED ${passed} / ${total} TESTS`);
    console.log('----------------------------------------------------\n');
  } catch (err: any) {
    console.error('Integration test failure:', err);
    process.exit(1);
  }
}

runPhase23IntegrationSuite();
