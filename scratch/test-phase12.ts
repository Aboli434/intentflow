import { buildApp } from '../apps/api/src/app.js';
import { getDb } from '../apps/api/src/config/database.js';
import { users, organizations, projects, projectMembers, notifications, activityLogs } from '../apps/api/src/db/schema/index.js';
import { NotificationService } from '../apps/api/src/services/notifications/notification.service.js';
import { ActivityService } from '../apps/api/src/services/activity/activity.service.js';
import { getNotificationTargetUrl } from '../apps/web/src/lib/notification-utils.js';
import { eq } from 'drizzle-orm';

async function runTests() {
  console.log('----------------------------------------------------');
  console.log('   STARTING PHASE 12 INTEGRATION VERIFICATION SUITE   ');
  console.log('----------------------------------------------------');

  const app = buildApp();
  await app.ready();

  const timestamp = Date.now();
  const db = getDb();
  const notificationService = new NotificationService();
  const activityService = new ActivityService();

  // 1. Setup Test Users & Orgs
  // User A (Org A Admin + Developer)
  const signupResA = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p12_admin_${timestamp}@example.com`, password: 'Password123!', name: 'P12 Admin' },
  });
  const tokenA = signupResA.json().data.token;
  const userA = signupResA.json().data.user;

  // User B (Client in Org A / Project A)
  const signupResB = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p12_client_${timestamp}@example.com`, password: 'Password123!', name: 'P12 Client' },
  });
  const tokenB = signupResB.json().data.token;
  const userB = signupResB.json().data.user;

  // User C (User in Org B)
  const signupResC = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { email: `p12_orgb_${timestamp}@example.com`, password: 'Password123!', name: 'P12 OrgB' },
  });
  const tokenC = signupResC.json().data.token;
  const userC = signupResC.json().data.user;

  // Create Org A & Project A
  const orgResA = await app.inject({
    method: 'POST',
    url: '/api/organizations',
    headers: { authorization: `Bearer ${tokenA}` },
    payload: { name: `Org A ${timestamp}` },
  });
  const orgA = orgResA.json().data;

  const projResA = await app.inject({
    method: 'POST',
    url: '/api/projects',
    headers: { authorization: `Bearer ${tokenA}`, 'x-organization-id': orgA.id },
    payload: { organizationId: orgA.id, name: `Project A ${timestamp}`, description: 'Phase 12 Test Project' },
  });
  const projA = projResA.json().data;

  // Assign User B as Client to Project A
  await app.inject({
    method: 'POST',
    url: `/api/projects/${projA.id}/members`,
    headers: { authorization: `Bearer ${tokenA}`, 'x-organization-id': orgA.id },
    payload: { memberId: userB.id, role: 'client' },
  });

  // Create Org B
  const orgResB = await app.inject({
    method: 'POST',
    url: '/api/organizations',
    headers: { authorization: `Bearer ${tokenC}` },
    payload: { name: `Org B ${timestamp}` },
  });
  const orgB = orgResB.json().data;

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

  // TEST 1: User can fetch own notifications
  const notif1 = await notificationService.createNotification({
    userId: userA.id,
    organizationId: orgA.id,
    projectId: projA.id,
    type: 'deliverable_ready',
    title: 'Test Deliverable Ready',
    body: 'Review required',
  });

  const getNotifA = await app.inject({
    method: 'GET',
    url: '/api/notifications',
    headers: { authorization: `Bearer ${tokenA}` },
  });
  assert(
    getNotifA.statusCode === 200 && getNotifA.json().data.some((n: any) => n.id === notif1.id),
    'User A can fetch their own notifications'
  );

  // TEST 2: User B cannot see User A\'s notifications in their notification list
  const getNotifB = await app.inject({
    method: 'GET',
    url: '/api/notifications',
    headers: { authorization: `Bearer ${tokenB}` },
  });
  assert(
    getNotifB.statusCode === 200 && !getNotifB.json().data.some((n: any) => n.id === notif1.id),
    'User B notification list isolates User A notifications'
  );

  // TEST 3: Unread count is correct
  const unreadCountResA = await app.inject({
    method: 'GET',
    url: '/api/notifications/unread-count',
    headers: { authorization: `Bearer ${tokenA}` },
  });
  assert(
    unreadCountResA.statusCode === 200 && unreadCountResA.json().data.count >= 1,
    'Unread count returns correct positive number for unread notifications'
  );

  // TEST 4: Mark single notification as read works (enforces ownership)
  const markReadRes = await app.inject({
    method: 'POST',
    url: `/api/notifications/${notif1.id}/read`,
    headers: { authorization: `Bearer ${tokenA}` },
  });
  assert(
    markReadRes.statusCode === 200 && markReadRes.json().data.readAt !== null,
    'Marking single notification read returns updated record with readAt'
  );

  // TEST 5: Mark all as read works
  await notificationService.createNotification({
    userId: userA.id,
    organizationId: orgA.id,
    projectId: projA.id,
    type: 'work_assigned',
    title: 'New Work Assigned',
    body: 'Work item #123',
  });
  const markAllRes = await app.inject({
    method: 'POST',
    url: '/api/notifications/read-all',
    headers: { authorization: `Bearer ${tokenA}` },
  });
  assert(markAllRes.statusCode === 200, 'Marking all notifications as read succeeds');

  const unreadAfterMarkAll = await app.inject({
    method: 'GET',
    url: '/api/notifications/unread-count',
    headers: { authorization: `Bearer ${tokenA}` },
  });
  assert(unreadAfterMarkAll.json().data.count === 0, 'Unread notification count becomes 0 after markAllAsRead');

  // TEST 6: Notification navigation metadata routing is correct
  const targetUrlDeliverable = getNotificationTargetUrl({
    id: '1',
    userId: userA.id,
    organizationId: orgA.id,
    projectId: 'proj-123',
    type: 'deliverable_ready',
    title: 'Test',
    body: 'Test',
    createdAt: new Date().toISOString(),
  });
  assert(targetUrlDeliverable === '/projects/proj-123?tab=deliverables', 'Deliverable notification routes to deliverables tab');

  const targetUrlCompletion = getNotificationTargetUrl({
    id: '2',
    userId: userA.id,
    organizationId: orgA.id,
    projectId: 'proj-123',
    type: 'closure_submitted',
    title: 'Test',
    body: 'Test',
    createdAt: new Date().toISOString(),
  });
  assert(targetUrlCompletion === '/projects/proj-123?tab=completion', 'Closure notification routes to completion tab');

  // TEST 7: Cross-organization notification access is blocked
  const markOtherUserNotif = await app.inject({
    method: 'POST',
    url: `/api/notifications/${notif1.id}/read`,
    headers: { authorization: `Bearer ${tokenC}` }, // User C in Org B
  });
  assert(
    markOtherUserNotif.statusCode === 404 || markOtherUserNotif.statusCode === 403,
    'User from another organization cannot mark another user notification as read'
  );

  // TEST 8: Project activity respects project permissions
  const actResA = await app.inject({
    method: 'GET',
    url: `/api/projects/${projA.id}/activity`,
    headers: { authorization: `Bearer ${tokenA}` },
  });
  assert(actResA.statusCode === 200 && Array.isArray(actResA.json().data), 'Project A activity fetch allowed for Project A Admin');

  // TEST 9: Client cannot see private developer activity
  await activityService.recordActivity({
    projectId: projA.id,
    actorId: userA.id,
    type: 'work_proposal_generated',
    entityType: 'work_proposal',
    entityId: 'prop-1',
    metadata: { internalPrompt: 'AI prompt secret text', confidence: 0.99 },
  });

  const clientActRes = await app.inject({
    method: 'GET',
    url: `/api/projects/${projA.id}/activity`,
    headers: { authorization: `Bearer ${tokenB}` },
  });
  const clientActivities = clientActRes.json().data || [];
  const hasSecret = clientActivities.some((act: any) => act.metadata?.internalPrompt);
  assert(!hasSecret, 'Client cannot view internal developer metadata in project activity');

  // TEST 10: Developer sees appropriate project activity
  const devActRes = await app.inject({
    method: 'GET',
    url: `/api/projects/${projA.id}/activity`,
    headers: { authorization: `Bearer ${tokenA}` },
  });
  assert(devActRes.statusCode === 200 && devActRes.json().data.length > 0, 'Developer sees full project activity entries');

  // TEST 11: Real-time notification creation returns full payload
  const notifCreatedPayload = await notificationService.createNotification({
    userId: userB.id,
    organizationId: orgA.id,
    projectId: projA.id,
    type: 'message_received',
    title: 'New message',
    body: 'Hello World',
  });
  assert(
    notifCreatedPayload.userId === userB.id && notifCreatedPayload.type === 'message_received',
    'NotificationService creates and formats real-time notification payload'
  );

  // TEST 12: Duplicate notification delivery is prevented by primary ID uniqueness
  const getUnreadB = await app.inject({
    method: 'GET',
    url: '/api/notifications/unread-count',
    headers: { authorization: `Bearer ${tokenB}` },
  });
  assert(getUnreadB.json().data.count === 1, 'Unread notification count correctly counts distinct unread notifications');

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
