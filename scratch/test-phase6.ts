import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config({ path: path.join(process.cwd(), 'apps/api/.env') });

import { buildApp } from '../apps/api/src/app.js';
import { getDb, checkDatabaseConnection } from '../apps/api/src/config/database.js';
import {
  users,
  organizations,
  organizationMembers,
  projects,
  projectMembers,
  conversations,
  conversationParticipants,
  messages,
  notifications,
  projectActivity,
  sessions,
  workItems,
  intents,
} from '../apps/api/src/db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { generateToken } from '../apps/api/src/lib/auth.js';
import { NotificationService } from '../apps/api/src/services/notifications/notification.service.js';
import { ActivityService } from '../apps/api/src/services/activity/activity.service.js';

async function createTestSession(userId: string) {
  const db = getDb();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({
    userId,
    token,
    expiresAt,
  });
  return token;
}

async function runPhase6Tests() {
  console.log('====================================================');
  console.log('--- STARTING PHASE 6 VERIFICATION SUITE ---');
  console.log('====================================================');

  // 1. Verify DB Connection
  const dbHealth = await checkDatabaseConnection();
  if (!dbHealth.connected) {
    console.error('❌ DB connection failed:', dbHealth.error);
    process.exit(1);
  }
  console.log('✅ PostgreSQL database connected.');

  const app = buildApp();
  await app.ready();

  const db = getDb();

  // Test setup data
  const testRunId = Date.now();
  const devEmail = `dev.phase6.${testRunId}@intentflow.io`;
  const clientEmail = `client.phase6.${testRunId}@intentflow.io`;
  const strangerEmail = `stranger.phase6.${testRunId}@intentflow.io`;

  // Create test users
  const [devUser] = await db
    .insert(users)
    .values({
      email: devEmail,
      name: 'Phase 6 Developer',
      passwordHash: 'hash_phase6_dev',
    })
    .returning();

  const [clientUser] = await db
    .insert(users)
    .values({
      email: clientEmail,
      name: 'Phase 6 Client User',
      passwordHash: 'hash_phase6_client',
    })
    .returning();

  const [strangerUser] = await db
    .insert(users)
    .values({
      email: strangerEmail,
      name: 'Stranger User',
      passwordHash: 'hash_phase6_stranger',
    })
    .returning();

  const devToken = await createTestSession(devUser.id);
  const clientToken = await createTestSession(clientUser.id);
  const strangerToken = await createTestSession(strangerUser.id);

  // Create Organization 1 & Project 1
  const [org1] = await db
    .insert(organizations)
    .values({
      name: `Phase 6 Org ${testRunId}`,
      slug: `p6-org-${testRunId}`,
    })
    .returning();

  await db.insert(organizationMembers).values([
    { organizationId: org1.id, userId: devUser.id, role: 'admin' },
    { organizationId: org1.id, userId: clientUser.id, role: 'client' },
  ]);

  const [project1] = await db
    .insert(projects)
    .values({
      organizationId: org1.id,
      name: `P6 Test Project ${testRunId}`,
      key: `P6-${testRunId.toString().slice(-4)}`,
    })
    .returning();

  await db.insert(projectMembers).values([
    { projectId: project1.id, userId: devUser.id, role: 'developer' },
    { projectId: project1.id, userId: clientUser.id, role: 'client' },
  ]);

  // Create Organization 2 for Stranger
  const [org2] = await db
    .insert(organizations)
    .values({
      name: `Phase 6 Stranger Org ${testRunId}`,
      slug: `p6-stranger-${testRunId}`,
    })
    .returning();

  await db.insert(organizationMembers).values({
    organizationId: org2.id,
    userId: strangerUser.id,
    role: 'admin',
  });

  console.log('✅ Test environment, users, organizations, and project created.');

  // TEST 1: Client sends message -> Developer receives notification (Client does NOT receive one)
  console.log('\n--- TEST 1: Message Notification Dispatch & Activity Recording ---');
  
  // Create conversation
  const [conversation] = await db
    .insert(conversations)
    .values({
      projectId: project1.id,
      title: 'Phase 6 Integration Discussion',
      createdBy: clientUser.id,
    })
    .returning();

  // Add dev and client as conversation participants
  await db.insert(conversationParticipants).values([
    { conversationId: conversation.id, userId: clientUser.id },
    { conversationId: conversation.id, userId: devUser.id },
  ]);

  // Client posts message via API
  const msgRes = await app.inject({
    method: 'POST',
    url: `/api/conversations/${conversation.id}/messages`,
    headers: { authorization: `Bearer ${clientToken}` },
    payload: { body: 'Client message: We need real-time status updates.' },
  });
  if (msgRes.statusCode !== 201) {
    console.error('❌ Failed to post client message:', msgRes.body);
    process.exit(1);
  }
  console.log('  Posted client message via HTTP endpoint.');

  // Check Developer notifications
  const devNotifRes1 = await app.inject({
    method: 'GET',
    url: '/api/notifications',
    headers: { authorization: `Bearer ${devToken}` },
  });
  const devNotifs1 = JSON.parse(devNotifRes1.body);
  if (!devNotifs1.data || devNotifs1.data.length === 0) {
    console.error('❌ Developer did not receive message notification:', devNotifRes1.body);
    process.exit(1);
  }
  console.log(`  ✅ Developer received notification: "${devNotifs1.data[0].title}" (${devNotifs1.data[0].type})`);

  // Check Client notifications (should be 0)
  const clientNotifRes1 = await app.inject({
    method: 'GET',
    url: '/api/notifications',
    headers: { authorization: `Bearer ${clientToken}` },
  });
  const clientNotifs1 = JSON.parse(clientNotifRes1.body);
  if (clientNotifs1.data.length !== 0) {
    console.error('❌ Client received unexpected self-notification:', clientNotifRes1.body);
    process.exit(1);
  }
  console.log('  ✅ Client did NOT receive a notification for their own message.');

  // Dev posts message back
  await app.inject({
    method: 'POST',
    url: `/api/conversations/${conversation.id}/messages`,
    headers: { authorization: `Bearer ${devToken}` },
    payload: { body: 'Dev message: Working on notifications now!' },
  });

  // Client should now have 1 notification
  const clientNotifRes2 = await app.inject({
    method: 'GET',
    url: '/api/notifications',
    headers: { authorization: `Bearer ${clientToken}` },
  });
  const clientNotifs2 = JSON.parse(clientNotifRes2.body);
  if (clientNotifs2.data.length !== 1) {
    console.error('❌ Client did not receive developer message notification:', clientNotifRes2.body);
    process.exit(1);
  }
  console.log(`  ✅ Client received developer message notification: "${clientNotifs2.data[0].title}"`);

  // TEST 2: Unread Count & Marking Read
  console.log('\n--- TEST 2: Notification Read State & Unread Counter ---');
  
  // Get unread count for dev
  const devUnreadRes1 = await app.inject({
    method: 'GET',
    url: '/api/notifications/unread-count',
    headers: { authorization: `Bearer ${devToken}` },
  });
  const devUnread1 = JSON.parse(devUnreadRes1.body);
  if (devUnread1.data?.count !== 1) {
    console.error('❌ Expected dev unread count 1, got:', devUnread1);
    process.exit(1);
  }
  console.log(`  ✅ Dev unread count correctly calculated: ${devUnread1.data.count}`);

  // Mark single notification read
  const notifToMark = devNotifs1.data[0].id;
  const markReadRes = await app.inject({
    method: 'POST',
    url: `/api/notifications/${notifToMark}/read`,
    headers: { authorization: `Bearer ${devToken}` },
  });
  if (markReadRes.statusCode !== 200) {
    console.error('❌ Failed to mark notification read:', markReadRes.body);
    process.exit(1);
  }

  const devUnreadRes2 = await app.inject({
    method: 'GET',
    url: '/api/notifications/unread-count',
    headers: { authorization: `Bearer ${devToken}` },
  });
  const devUnread2 = JSON.parse(devUnreadRes2.body);
  if (devUnread2.data?.count !== 0) {
    console.error('❌ Dev unread count should be 0 after read, got:', devUnread2);
    process.exit(1);
  }
  console.log('  ✅ Single notification marked read, unread count updated to 0.');

  // Mark all read for client
  const markAllRes = await app.inject({
    method: 'POST',
    url: '/api/notifications/read-all',
    headers: { authorization: `Bearer ${clientToken}` },
  });
  if (markAllRes.statusCode !== 200) {
    console.error('❌ Failed to mark all read:', markAllRes.body);
    process.exit(1);
  }
  const clientUnreadRes = await app.inject({
    method: 'GET',
    url: '/api/notifications/unread-count',
    headers: { authorization: `Bearer ${clientToken}` },
  });
  if (JSON.parse(clientUnreadRes.body).data?.count !== 0) {
    console.error('❌ Client unread count after read-all is not 0');
    process.exit(1);
  }
  console.log('  ✅ Mark all read functioning properly.');

  // TEST 3: Security & Notification Ownership (IDOR)
  console.log('\n--- TEST 3: Notification Ownership & Security ---');

  // Stranger attempts to mark dev's notification read
  const idorRes = await app.inject({
    method: 'POST',
    url: `/api/notifications/${notifToMark}/read`,
    headers: { authorization: `Bearer ${strangerToken}` },
  });
  if (idorRes.statusCode !== 404) {
    console.error('❌ IDOR vulnerability! Stranger was able to access/mark another user notification, code:', idorRes.statusCode);
    process.exit(1);
  }
  console.log('  ✅ IDOR protection verified: Stranger cannot modify another user notification (404 Not Found).');

  // Stranger fetches notifications -> 0
  const strangerNotifRes = await app.inject({
    method: 'GET',
    url: '/api/notifications',
    headers: { authorization: `Bearer ${strangerToken}` },
  });
  if (JSON.parse(strangerNotifRes.body).data.length !== 0) {
    console.error('❌ Stranger received notifications from unrelated organization');
    process.exit(1);
  }
  console.log('  ✅ Tenant notification isolation verified.');

  // TEST 4: Project Activity Recording & Client-Safety
  console.log('\n--- TEST 4: Immutable Activity Timeline & Client-Safe Filtering ---');

  const activityService = new ActivityService();
  const notificationService = new NotificationService();

  // Record an explicit developer activity (internal) and client-safe activity
  await activityService.recordActivity({
    projectId: project1.id,
    actorId: devUser.id,
    type: 'intent_analyzed',
    entityType: 'intent',
    entityId: 'intent-123',
    metadata: { confidence: 0.98, model: 'gpt-4o', note: 'Internal developer AI analysis' },
  });

  await activityService.recordActivity({
    projectId: project1.id,
    actorId: devUser.id,
    type: 'work_completed',
    entityType: 'work_item',
    entityId: 'wi-456',
    metadata: { title: 'Notification System Implementation' },
  });

  // Developer fetches activity
  const devActivityRes = await app.inject({
    method: 'GET',
    url: `/api/projects/${project1.id}/activity`,
    headers: { authorization: `Bearer ${devToken}` },
  });
  const devActivities = JSON.parse(devActivityRes.body);
  console.log(`  Developer retrieved ${devActivities.data.length} activity items.`);

  // Client fetches activity
  const clientActivityRes = await app.inject({
    method: 'GET',
    url: `/api/projects/${project1.id}/activity`,
    headers: { authorization: `Bearer ${clientToken}` },
  });
  const clientActivities = JSON.parse(clientActivityRes.body);
  console.log(`  Client retrieved ${clientActivities.data.length} client-safe activity items.`);

  // Verify internal developer event 'intent_analyzed' is filtered out for client
  const hasInternalEvent = clientActivities.data.some(
    (act: any) => act.type === 'intent_analyzed' || act.metadata?.confidence !== undefined
  );
  if (hasInternalEvent) {
    console.error('❌ Internal developer metadata/activity leaked to client!', clientActivities);
    process.exit(1);
  }
  console.log('  ✅ Client activity response is completely sanitized (developer-only AI metrics stripped).');

  // Stranger fetches activity -> 403 Forbidden
  const strangerActivityRes = await app.inject({
    method: 'GET',
    url: `/api/projects/${project1.id}/activity`,
    headers: { authorization: `Bearer ${strangerToken}` },
  });
  if (strangerActivityRes.statusCode !== 403) {
    console.error('❌ Unauthorized user accessed project activity! Status code:', strangerActivityRes.statusCode);
    process.exit(1);
  }
  console.log('  ✅ Authorization enforced: Unauthorized cross-org project activity access returned 403 Forbidden.');

  // TEST 5: Direct Notification Service Unit Verification
  console.log('\n--- TEST 5: Work Item Event Notification Hooks ---');
  
  await notificationService.notifyOnWorkAssigned({
    projectId: project1.id,
    workItemId: 'wi-test-1',
    title: 'Notification Bell Component',
    assignedTo: devUser.id,
    actorId: clientUser.id,
  });

  await notificationService.notifyOnWorkStatusChanged({
    projectId: project1.id,
    workItemId: 'wi-test-1',
    title: 'Notification Bell Component',
    oldStatus: 'in_progress',
    newStatus: 'completed',
    actorId: devUser.id,
  });

  // Verify dev & client notifications exist in database
  const allNotifs = await db.select().from(notifications).where(eq(notifications.projectId, project1.id));
  if (allNotifs.length < 3) {
    console.error('❌ Expected persisted notifications in database, found:', allNotifs.length);
    process.exit(1);
  }
  console.log(`  ✅ Database holds ${allNotifs.length} persisted notifications for Project 1.`);

  console.log('\n====================================================');
  console.log('🎉 ALL PHASE 6 INTEGRATION TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================\n');

  await app.close();
  process.exit(0);
}

runPhase6Tests().catch((err) => {
  console.error('❌ Test suite execution failed:', err);
  process.exit(1);
});
