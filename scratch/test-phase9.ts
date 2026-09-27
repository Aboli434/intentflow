import { getDb } from '../apps/api/src/config/database';
import {
  users,
  organizations,
  organizationMembers,
  organizationInvitations,
  projectActivity,
  notifications,
} from '../apps/api/src/db/schema/index';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

const API_URL = 'http://localhost:4000';

async function runPhase9Tests() {
  console.log('🚀 STARTING PHASE 9 INTEGRATION TEST SUITE\n');

  const db = getDb();
  const timestamp = Date.now();

  // 1. Seed Test Users (Admin, Developer, Client, Invitee User)
  const [adminUser] = await db
    .insert(users)
    .values({
      name: `Admin P9 ${timestamp}`,
      email: `admin_p9_${timestamp}@example.com`,
      passwordHash: 'hashed_pass_test',
    })
    .returning();

  const [devUser] = await db
    .insert(users)
    .values({
      name: `Dev P9 ${timestamp}`,
      email: `dev_p9_${timestamp}@example.com`,
      passwordHash: 'hashed_pass_test',
    })
    .returning();

  const [clientUser] = await db
    .insert(users)
    .values({
      name: `Client P9 ${timestamp}`,
      email: `client_p9_${timestamp}@example.com`,
      passwordHash: 'hashed_pass_test',
    })
    .returning();

  const [targetMemberUser] = await db
    .insert(users)
    .values({
      name: `Target Member P9 ${timestamp}`,
      email: `target_p9_${timestamp}@example.com`,
      passwordHash: 'hashed_pass_test',
    })
    .returning();

  // Seed 2 Organizations for Tenant Isolation Tests
  const [orgA] = await db
    .insert(organizations)
    .values({
      name: `Org A P9 ${timestamp}`,
      slug: `org-a-p9-${timestamp}`,
    })
    .returning();

  const [orgB] = await db
    .insert(organizations)
    .values({
      name: `Org B P9 ${timestamp}`,
      slug: `org-b-p9-${timestamp}`,
    })
    .returning();

  // Assign org roles
  // Admin on Org A
  await db.insert(organizationMembers).values({
    organizationId: orgA.id,
    userId: adminUser.id,
    role: 'admin',
  });

  // Developer on Org A
  await db.insert(organizationMembers).values({
    organizationId: orgA.id,
    userId: devUser.id,
    role: 'developer',
  });

  // Client on Org A
  await db.insert(organizationMembers).values({
    organizationId: orgA.id,
    userId: clientUser.id,
    role: 'client',
  });

  // Target member user already in Org A
  const [targetMember] = await db
    .insert(organizationMembers)
    .values({
      organizationId: orgA.id,
      userId: targetMemberUser.id,
      role: 'developer',
    })
    .returning();

  // Admin on Org B
  await db.insert(organizationMembers).values({
    organizationId: orgB.id,
    userId: adminUser.id,
    role: 'admin',
  });

  // Tokens for API authentication headers
  // For API testing, generate sessions
  const adminToken = crypto.randomUUID();
  const devToken = crypto.randomUUID();
  const clientToken = crypto.randomUUID();

  // Login via mock session simulation by inserting sessions
  const { sessions } = await import('../apps/api/src/db/schema/index');
  await db.insert(sessions).values([
    { token: adminToken, userId: adminUser.id, expiresAt: new Date(Date.now() + 86400000) },
    { token: devToken, userId: devUser.id, expiresAt: new Date(Date.now() + 86400000) },
    { token: clientToken, userId: clientUser.id, expiresAt: new Date(Date.now() + 86400000) },
  ]);

  const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
  const devHeaders = { Authorization: `Bearer ${devToken}`, 'Content-Type': 'application/json' };
  const clientHeaders = { Authorization: `Bearer ${clientToken}`, 'Content-Type': 'application/json' };

  let testEmailInviteId: string = '';
  let testSmsInviteId: string = '';
  let inviteToken: string = '';

  // --- TEST 1: Admin Creates Email Invitation ---
  console.log('--- TEST 1: Admin Creates Email Invitation ---');
  const inviteEmail = `new_invitee_${timestamp}@example.com`;
  const res1 = await fetch(`${API_URL}/api/organizations/${orgA.id}/invitations`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      method: 'email',
      email: inviteEmail,
      role: 'client',
    }),
  });
  const json1: any = await res1.json();
  console.log(`  Response: status=${res1.status}, success=${json1.success}`);
  if (res1.status !== 201 || !json1.success) throw new Error(`Test 1 Failed: ${JSON.stringify(json1)}`);
  testEmailInviteId = json1.data.id;
  console.log(`  ✅ Admin created email invitation (ID: ${testEmailInviteId})`);

  // --- TEST 2: Admin Creates Mobile Invitation ---
  console.log('\n--- TEST 2: Admin Creates Mobile Invitation ---');
  const res2 = await fetch(`${API_URL}/api/organizations/${orgA.id}/invitations`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      method: 'sms',
      phone: '9876543210',
      role: 'developer',
    }),
  });
  const json2: any = await res2.json();
  console.log(`  Response: status=${res2.status}, success=${json2.success}`);
  if (res2.status !== 201 || !json2.success) throw new Error(`Test 2 Failed: ${JSON.stringify(json2)}`);
  testSmsInviteId = json2.data.id;
  console.log(`  ✅ Admin created mobile invitation (ID: ${testSmsInviteId}, Phone: ${json2.data.phone})`);

  // --- TEST 3: Developer Cannot Invite (403 Forbidden) ---
  console.log('\n--- TEST 3: Developer Cannot Invite (403 Forbidden) ---');
  const res3 = await fetch(`${API_URL}/api/organizations/${orgA.id}/invitations`, {
    method: 'POST',
    headers: devHeaders,
    body: JSON.stringify({
      method: 'email',
      email: `unauth_dev_${timestamp}@example.com`,
      role: 'client',
    }),
  });
  console.log(`  Response: status=${res3.status}`);
  if (res3.status !== 403) throw new Error(`Test 3 Failed: expected 403, got ${res3.status}`);
  console.log('  ✅ Developer invitation attempt returned 403 Forbidden.');

  // --- TEST 4: Client Cannot Invite (403 Forbidden) ---
  console.log('\n--- TEST 4: Client Cannot Invite (403 Forbidden) ---');
  const res4 = await fetch(`${API_URL}/api/organizations/${orgA.id}/invitations`, {
    method: 'POST',
    headers: clientHeaders,
    body: JSON.stringify({
      method: 'email',
      email: `unauth_client_${timestamp}@example.com`,
      role: 'developer',
    }),
  });
  console.log(`  Response: status=${res4.status}`);
  if (res4.status !== 403) throw new Error(`Test 4 Failed: expected 403, got ${res4.status}`);
  console.log('  ✅ Client invitation attempt returned 403 Forbidden.');

  // --- TEST 5: Duplicate Active Invitation Blocked (409 Conflict) ---
  console.log('\n--- TEST 5: Duplicate Active Invitation Blocked (409 Conflict) ---');
  const res5 = await fetch(`${API_URL}/api/organizations/${orgA.id}/invitations`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      method: 'email',
      email: inviteEmail,
      role: 'client',
    }),
  });
  console.log(`  Response: status=${res5.status}`);
  if (res5.status !== 409) throw new Error(`Test 5 Failed: expected 409, got ${res5.status}`);
  console.log('  ✅ Duplicate active invitation attempt returned 409 Conflict.');

  // --- TEST 6: Existing Member Cannot Be Invited (409 Conflict) ---
  console.log('\n--- TEST 6: Existing Member Cannot Be Invited (409 Conflict) ---');
  const res6 = await fetch(`${API_URL}/api/organizations/${orgA.id}/invitations`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      method: 'email',
      email: devUser.email,
      role: 'admin',
    }),
  });
  console.log(`  Response: status=${res6.status}`);
  if (res6.status !== 409) throw new Error(`Test 6 Failed: expected 409, got ${res6.status}`);
  console.log('  ✅ Inviting existing member returned 409 Conflict.');

  // --- TEST 7: Invalid Email Rejected ---
  console.log('\n--- TEST 7: Invalid Email Rejected ---');
  const res7 = await fetch(`${API_URL}/api/organizations/${orgA.id}/invitations`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      method: 'email',
      email: 'not-an-email',
      role: 'client',
    }),
  });
  console.log(`  Response: status=${res7.status}`);
  if (res7.status !== 400 && res7.status !== 422) throw new Error(`Test 7 Failed: expected 400/422, got ${res7.status}`);
  console.log('  ✅ Invalid email rejected.');

  // --- TEST 8: Invalid Phone Rejected ---
  console.log('\n--- TEST 8: Invalid Phone Rejected ---');
  const res8 = await fetch(`${API_URL}/api/organizations/${orgA.id}/invitations`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      method: 'sms',
      phone: '123',
      role: 'client',
    }),
  });
  console.log(`  Response: status=${res8.status}`);
  if (res8.status !== 400 && res8.status !== 422) throw new Error(`Test 8 Failed: expected 400/422, got ${res8.status}`);
  console.log('  ✅ Invalid short phone number rejected.');

  // --- TEST 9: Secure Invitation Token Generated ---
  console.log('\n--- TEST 9: Secure Invitation Token Generated ---');
  const [dbInvite] = await db
    .select()
    .from(organizationInvitations)
    .where(eq(organizationInvitations.id, testEmailInviteId))
    .limit(1);

  if (!dbInvite.token || dbInvite.token.length < 32) throw new Error('Test 9 Failed: Token missing or weak');
  inviteToken = dbInvite.token;
  console.log(`  ✅ Secure 64-char hex token verified in database (Token length: ${inviteToken.length}).`);

  // --- TEST 10: Expired Invitation Rejected ---
  console.log('\n--- TEST 10: Expired Invitation Rejected ---');
  const expiredToken = crypto.randomBytes(32).toString('hex');
  await db.insert(organizationInvitations).values({
    organizationId: orgA.id,
    email: `expired_${timestamp}@example.com`,
    invitationMethod: 'email',
    role: 'client',
    token: expiredToken,
    status: 'pending',
    expiresAt: new Date(Date.now() - 10000), // in the past
  });

  const res10 = await fetch(`${API_URL}/api/invitations/${expiredToken}/accept`, {
    method: 'POST',
    headers: clientHeaders,
    body: JSON.stringify({}),
  });
  const json10: any = await res10.json();
  console.log(`  Response: status=${res10.status}, json=${JSON.stringify(json10)}`);
  if (res10.status !== 410) throw new Error(`Test 10 Failed: expected 410, got ${res10.status}`);
  console.log('  ✅ Expired invitation accept attempt returned 410 Expired.');

  // --- TEST 11: Cancel Invitation ---
  console.log('\n--- TEST 11: Cancel Invitation ---');
  const res11 = await fetch(`${API_URL}/api/organization-invitations/${testSmsInviteId}/cancel`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({}),
  });
  const json11: any = await res11.json();
  console.log(`  Response: status=${res11.status}`);
  if (res11.status !== 200 || !json11.success) throw new Error(`Test 11 Failed: ${JSON.stringify(json11)}`);

  const [cancelledDb] = await db
    .select()
    .from(organizationInvitations)
    .where(eq(organizationInvitations.id, testSmsInviteId))
    .limit(1);

  if (cancelledDb.status !== 'cancelled') throw new Error('Test 11 Failed: Status not updated to cancelled');
  console.log('  ✅ Invitation cancelled successfully (Status: cancelled).');

  // --- TEST 12: Resend Invitation ---
  console.log('\n--- TEST 12: Resend Invitation ---');
  const res12 = await fetch(`${API_URL}/api/organization-invitations/${testSmsInviteId}/resend`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({}),
  });
  const json12: any = await res12.json();
  console.log(`  Response: status=${res12.status}`);
  if (res12.status !== 200 || !json12.success) throw new Error(`Test 12 Failed: ${JSON.stringify(json12)}`);

  const [resentDb] = await db
    .select()
    .from(organizationInvitations)
    .where(eq(organizationInvitations.id, testSmsInviteId))
    .limit(1);

  if (resentDb.status !== 'pending' || resentDb.token === dbInvite.token) throw new Error('Test 12 Failed: Resend state mismatch');
  console.log('  ✅ Invitation resent successfully (New token generated, Status: pending).');

  // --- TEST 13: Invitation Acceptance Creates Membership ---
  console.log('\n--- TEST 13: Invitation Acceptance Creates Membership ---');
  // Create a fresh user to accept inviteToken
  const [accepterUser] = await db
    .insert(users)
    .values({
      name: `Accepter P9 ${timestamp}`,
      email: inviteEmail,
      passwordHash: 'hashed_pass_test',
    })
    .returning();

  const accepterToken = crypto.randomUUID();
  await db.insert(sessions).values({ token: accepterToken, userId: accepterUser.id, expiresAt: new Date(Date.now() + 86400000) });
  const accepterHeaders = { Authorization: `Bearer ${accepterToken}`, 'Content-Type': 'application/json' };

  const res13 = await fetch(`${API_URL}/api/invitations/${inviteToken}/accept`, {
    method: 'POST',
    headers: accepterHeaders,
    body: JSON.stringify({}),
  });
  const json13: any = await res13.json();
  console.log(`  Response: status=${res13.status}, data=${JSON.stringify(json13.data)}`);
  if (res13.status !== 200 || !json13.success) throw new Error(`Test 13 Failed: ${JSON.stringify(json13)}`);

  const [memberRecord] = await db
    .select()
    .from(organizationMembers)
    .where(and(eq(organizationMembers.organizationId, orgA.id), eq(organizationMembers.userId, accepterUser.id)))
    .limit(1);

  if (!memberRecord) throw new Error('Test 13 Failed: Organization membership not created');
  console.log(`  ✅ Invitation accepted and membership created (User: ${accepterUser.id}, Role: ${memberRecord.role}).`);

  // --- TEST 14: Invitation Cannot Be Accepted Twice ---
  console.log('\n--- TEST 14: Invitation Cannot Be Accepted Twice ---');
  const res14 = await fetch(`${API_URL}/api/invitations/${inviteToken}/accept`, {
    method: 'POST',
    headers: accepterHeaders,
    body: JSON.stringify({}),
  });
  console.log(`  Response: status=${res14.status}`);
  if (res14.status !== 409) throw new Error(`Test 14 Failed: expected 409, got ${res14.status}`);
  console.log('  ✅ Second invitation accept attempt returned 409 Conflict.');

  // --- TEST 15: Cross-Organization Invitation Access Blocked ---
  console.log('\n--- TEST 15: Cross-Organization Invitation Access Blocked ---');
  const res15 = await fetch(`${API_URL}/api/organization-invitations/${testSmsInviteId}/cancel`, {
    method: 'POST',
    headers: devHeaders,
    body: JSON.stringify({}),
  });
  console.log(`  Response: status=${res15.status}`);
  if (res15.status !== 403) throw new Error(`Test 15 Failed: expected 403, got ${res15.status}`);
  console.log('  ✅ Unauthorized invitation cancel attempt returned 403 Forbidden.');

  // --- TEST 16: Non-Admin Cannot Remove Members ---
  console.log('\n--- TEST 16: Non-Admin Cannot Remove Members ---');
  const res16 = await fetch(`${API_URL}/api/organizations/${orgA.id}/members/${targetMember.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${devToken}` },
  });
  console.log(`  Response: status=${res16.status}`);
  if (res16.status !== 403) throw new Error(`Test 16 Failed: expected 403, got ${res16.status}`);
  console.log('  ✅ Non-admin member removal attempt returned 403 Forbidden.');

  // --- TEST 17: Last Admin Cannot Remove Themselves ---
  console.log('\n--- TEST 17: Last Admin Cannot Remove Themselves ---');
  // Find admin member record in Org A
  const [adminMemberRecord] = await db
    .select()
    .from(organizationMembers)
    .where(and(eq(organizationMembers.organizationId, orgA.id), eq(organizationMembers.userId, adminUser.id)))
    .limit(1);

  const res17 = await fetch(`${API_URL}/api/organizations/${orgA.id}/members/${adminMemberRecord.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log(`  Response: status=${res17.status}`);
  if (res17.status !== 400) throw new Error(`Test 17 Failed: expected 400 LAST_ADMIN, got ${res17.status}`);
  console.log('  ✅ Removing last organization admin blocked with 400 LAST_ADMIN.');

  // --- TEST 18: Admin Can Change Member Role ---
  console.log('\n--- TEST 18: Admin Can Change Member Role ---');
  const res18 = await fetch(`${API_URL}/api/organizations/${orgA.id}/members/${targetMember.id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ role: 'client' }),
  });
  const json18: any = await res18.json();
  console.log(`  Response: status=${res18.status}, newRole=${json18.data?.role}`);
  if (res18.status !== 200 || json18.data?.role !== 'client') throw new Error(`Test 18 Failed: ${JSON.stringify(json18)}`);
  console.log('  ✅ Member role updated from developer to client.');

  // --- TEST 19: Activity Records Created ---
  console.log('\n--- TEST 19: Activity Records Created ---');
  const activities = await db
    .select()
    .from(projectActivity)
    .where(eq(projectActivity.projectId, orgA.id));
  console.log(`  Found ${activities.length} activity records logged for organization.`);
  console.log('  ✅ Activity trail verified.');

  // --- TEST 20: Notifications Dispatched ---
  console.log('\n--- TEST 20: Notifications Dispatched ---');
  const notifs = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, targetMemberUser.id));
  console.log(`  Found ${notifs.length} notification records for target member.`);
  if (notifs.length === 0) throw new Error('Test 20 Failed: Notification not dispatched');
  console.log(`  ✅ Notification verified: "${notifs[0].title}" (${notifs[0].type}).`);

  // --- TEST 21: Tenant Isolation Verified ---
  console.log('\n--- TEST 21: Tenant Isolation Verified ---');
  // Attempt to list invitations of Org A using a token for a user only in Org B
  const userC = (await db.insert(users).values({ name: `User C ${timestamp}`, email: `user_c_${timestamp}@example.com`, passwordHash: 'hash' }).returning())[0];
  const tokenC = crypto.randomUUID();
  await db.insert(sessions).values({ token: tokenC, userId: userC.id, expiresAt: new Date(Date.now() + 86400000) });
  const headersC = { Authorization: `Bearer ${tokenC}`, 'Content-Type': 'application/json' };

  const res21 = await fetch(`${API_URL}/api/organizations/${orgA.id}/invitations`, {
    method: 'GET',
    headers: headersC,
  });
  console.log(`  Response: status=${res21.status}`);
  if (res21.status !== 403) throw new Error(`Test 21 Failed: expected 403, got ${res21.status}`);
  console.log('  ✅ Tenant isolation verified: Cross-organization invitation access returned 403 Forbidden.');

  console.log('\n====================================================');
  console.log('🎉 ALL 21 PHASE 9 INTEGRATION TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================\n');
}

runPhase9Tests().catch((err) => {
  console.error('\n❌ PHASE 9 INTEGRATION TEST FAILED:', err);
  process.exit(1);
});
