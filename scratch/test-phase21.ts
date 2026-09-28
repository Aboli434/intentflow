/**
 * Phase 21 Quality Assurance & UI/UX Integration Verification Suite
 * Tests client-side & server-side validation contracts, RBAC permissions,
 * tenant isolation, deliverable feedback bounds, and form integrity.
 */

import { buildApp } from '../apps/api/src/app.js';
import { getDb, runDatabaseMigrations } from '../apps/api/src/config/database.js';
import { organizationInvitations } from '../apps/api/src/db/schema/index.js';
import { eq } from 'drizzle-orm';

async function runPhase21TestSuite() {
  console.log('\n----------------------------------------------------');
  console.log('   STARTING PHASE 21 UI/UX & QUALITY GATES SUITE   ');
  console.log('----------------------------------------------------\n');

  await runDatabaseMigrations();
  const app = buildApp();
  await app.ready();
  const db = getDb();

  let passedCount = 0;
  let totalCount = 0;

  function assert(condition: boolean, title: string) {
    totalCount++;
    if (condition) {
      passedCount++;
      console.log(`  ✓ Test ${totalCount}: ${title}`);
    } else {
      console.error(`  ✕ Test ${totalCount}: ${title}`);
      throw new Error(`Assertion failed for: ${title}`);
    }
  }

  try {
    // 1. Health & Liveness
    const healthRes = await app.inject({ method: 'GET', url: '/health' });
    assert(healthRes.statusCode === 200, 'System health probe responds 200 OK');

    // 2. Setup Test Admin User
    const timestamp = Date.now();
    const adminEmail = `p21_admin_${timestamp}@intentflow.io`;
    const adminSignupRes = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: { name: 'Phase21 Admin', email: adminEmail, password: 'Password123!' },
    });
    assert(adminSignupRes.statusCode === 201, 'Admin user registration succeeds');
    const adminToken = adminSignupRes.json().data.token;
    const adminHeaders = { authorization: `Bearer ${adminToken}` };

    // 3. Setup Test Organization
    const orgRes = await app.inject({
      method: 'POST',
      url: '/api/organizations',
      headers: adminHeaders,
      payload: { name: `Phase 21 QA Org ${timestamp}` },
    });
    assert(orgRes.statusCode === 201, 'Workspace organization creation succeeds');
    const orgId = orgRes.json().data.id;

    // 4. Client User Registration & Invitation
    const clientEmail = `p21_client_${timestamp}@intentflow.io`;
    const inviteRes = await app.inject({
      method: 'POST',
      url: `/api/organizations/${orgId}/invitations`,
      headers: adminHeaders,
      payload: { method: 'email', email: clientEmail, role: 'client' },
    });
    assert(inviteRes.statusCode === 201, 'Client email invitation created');

    // Fetch token for signup
    const tokenRows = await db
      .select({ token: organizationInvitations.token })
      .from(organizationInvitations)
      .where(eq(organizationInvitations.email, clientEmail))
      .limit(1);

    const inviteToken = tokenRows[0].token;

    const clientSignupRes = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: { name: 'Phase21 Client', email: clientEmail, password: 'Password123!', invitationToken: inviteToken },
    });
    assert(clientSignupRes.statusCode === 201, 'Client signup with token succeeds');
    const clientToken = clientSignupRes.json().data.token;
    const clientHeaders = { authorization: `Bearer ${clientToken}` };

    // Verify organization membership in /me
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: clientHeaders,
    });
    assert(
      meRes.statusCode === 200 && meRes.json().data.memberships.some((m: any) => m.organizationId === orgId),
      'Client automatically gains workspace membership via invitation token'
    );

    // 5. Create Project
    const projRes = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: adminHeaders,
      payload: { organizationId: orgId, name: 'Phase 21 UX Project', description: 'Testing UI/UX form integrity' },
    });
    assert(projRes.statusCode === 201, 'Project creation succeeds');
    const projectId = projRes.json().data.id;

    // Assign Client to Project
    const assignRes = await app.inject({
      method: 'POST',
      url: `/api/projects/${projectId}/members`,
      headers: adminHeaders,
      payload: { userId: clientSignupRes.json().data.user.id, projectRole: 'client' },
    });
    assert(assignRes.statusCode === 201, 'Client assigned to project team as client');

    // 6. Create Work Item & Status Validation
    const workRes = await app.inject({
      method: 'POST',
      url: `/api/projects/${projectId}/work`,
      headers: adminHeaders,
      payload: { title: 'UX Hardening Work Item', description: 'Mandatory field check', priority: 'high', status: 'ready' },
    });
    assert(workRes.statusCode === 201, 'Work item creation succeeds');
    const workItemId = workRes.json().data.id;

    // Update Status to In Progress
    const statusRes = await app.inject({
      method: 'PATCH',
      url: `/api/work/${workItemId}/status`,
      headers: adminHeaders,
      payload: { status: 'in_progress' },
    });
    assert(statusRes.statusCode === 200, 'Work item status updated to in_progress');

    // 7. Deliverable Lifecycle & Validation Gating
    const delivRes = await app.inject({
      method: 'POST',
      url: `/api/projects/${projectId}/deliverables`,
      headers: adminHeaders,
      payload: { title: 'Final UI Package', description: 'Completed UI redesign', linkedWorkItemIds: [workItemId] },
    });
    assert(delivRes.statusCode === 201, 'Deliverable package created');
    const deliverableId = delivRes.json().data.id;

    // Submit for review
    const submitDelivRes = await app.inject({
      method: 'POST',
      url: `/api/deliverables/${deliverableId}/submit`,
      headers: adminHeaders,
    });
    assert(submitDelivRes.statusCode === 200, 'Deliverable submitted for client review');

    // Client requests changes with valid comment (> 10 chars)
    const requestChangesRes = await app.inject({
      method: 'POST',
      url: `/api/deliverables/${deliverableId}/request-changes`,
      headers: clientHeaders,
      payload: { comment: 'Please adjust primary button contrast and increase font size to 14px.' },
    });
    assert(requestChangesRes.statusCode === 200, 'Client change request with feedback succeeds');

    // Resubmit & Approve
    await app.inject({ method: 'POST', url: `/api/deliverables/${deliverableId}/submit`, headers: adminHeaders });
    const approveRes = await app.inject({
      method: 'POST',
      url: `/api/deliverables/${deliverableId}/approve`,
      headers: clientHeaders,
    });
    assert(approveRes.statusCode === 200, 'Client deliverable approval succeeds');

    // 8. Security & RBAC Enforcement
    // Outsider user without membership tries to fetch project details
    const outsiderSignup = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: { name: 'Outsider User', email: `p21_outsider_${timestamp}@intentflow.io`, password: 'Password123!' },
    });
    const outsiderHeaders = { authorization: `Bearer ${outsiderSignup.json().data.token}` };

    const forbiddenProjectRes = await app.inject({
      method: 'GET',
      url: `/api/projects/${projectId}`,
      headers: outsiderHeaders,
    });
    assert(forbiddenProjectRes.statusCode === 403, 'Tenant isolation blocks unassigned outsider (403 Forbidden)');

    // Client attempts to create project (Admin/Developer only)
    const clientCreateProjRes = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: clientHeaders,
      payload: { organizationId: orgId, name: 'Illegal Client Project' },
    });
    assert(clientCreateProjRes.statusCode === 403, 'Client role blocked from creating projects (403 Forbidden)');

    // 9. Notifications center query
    const notifsRes = await app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: clientHeaders,
    });
    assert(notifsRes.statusCode === 200 && Array.isArray(notifsRes.json().data), 'Client notification feed returns valid array');

    // 10. Verification of project members list
    const membersRes = await app.inject({
      method: 'GET',
      url: `/api/projects/${projectId}/members`,
      headers: adminHeaders,
    });
    assert(membersRes.statusCode === 200 && membersRes.json().data.length >= 2, 'Project members endpoint returns assigned team');

    console.log('\n----------------------------------------------------');
    console.log(`  PASSED: ${passedCount} / ${totalCount} tests`);
    console.log('----------------------------------------------------\n');
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  } finally {
    await app.close();
  }
}

runPhase21TestSuite();
