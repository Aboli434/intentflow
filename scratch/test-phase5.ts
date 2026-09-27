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
  messages,
  intents,
  intentRequirements,
  workProposals,
  workProposalItems,
  workItems,
  workItemRequirements,
  workItemActivity,
  sessions,
} from '../apps/api/src/db/schema/index.js';
import { eq } from 'drizzle-orm';
import { generateToken } from '../apps/api/src/lib/auth.js';
import { WorkProposalService } from '../apps/api/src/services/ai/work-proposal.service.js';
import { WorkItemService } from '../apps/api/src/services/work/work-item.service.js';

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

async function runPhase5Tests() {
  console.log('====================================================');
  console.log('--- STARTING PHASE 5 VERIFICATION SUITE ---');
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
  const devEmail = `dev.phase5.${testRunId}@intentflow.io`;
  const clientEmail = `client.phase5.${testRunId}@intentflow.io`;
  const strangerEmail = `stranger.phase5.${testRunId}@intentflow.io`;

  // Create test users
  const [devUser] = await db
    .insert(users)
    .values({
      email: devEmail,
      name: 'Phase 5 Developer',
      passwordHash: 'hash_phase5_dev',
    })
    .returning();

  const [clientUser] = await db
    .insert(users)
    .values({
      email: clientEmail,
      name: 'Phase 5 Client User',
      passwordHash: 'hash_phase5_client',
    })
    .returning();

  const [strangerUser] = await db
    .insert(users)
    .values({
      email: strangerEmail,
      name: 'Stranger Danger User',
      passwordHash: 'hash_phase5_stranger',
    })
    .returning();

  const devToken = await createTestSession(devUser.id);
  const clientToken = await createTestSession(clientUser.id);
  const strangerToken = await createTestSession(strangerUser.id);

  // Create Organization & Project
  const [org] = await db
    .insert(organizations)
    .values({
      name: `Phase5 Org ${testRunId}`,
      slug: `phase5-org-${testRunId}`,
    })
    .returning();

  await db.insert(organizationMembers).values([
    { organizationId: org.id, userId: devUser.id, role: 'developer' },
    { organizationId: org.id, userId: clientUser.id, role: 'client' },
  ]);

  const [project] = await db
    .insert(projects)
    .values({
      organizationId: org.id,
      name: 'WhatsApp Integration Project',
      description: 'Add direct WhatsApp messaging functionality to client website',
      status: 'active',
      createdBy: devUser.id,
    })
    .returning();

  await db.insert(projectMembers).values([
    { projectId: project.id, userId: devUser.id, role: 'developer' },
    { projectId: project.id, userId: clientUser.id, role: 'client' },
  ]);

  // Create Conversation & Message
  const [conv] = await db
    .insert(conversations)
    .values({
      projectId: project.id,
      title: 'WhatsApp Contact Button Request',
      createdBy: clientUser.id,
    })
    .returning();

  const [msg] = await db
    .insert(messages)
    .values({
      conversationId: conv.id,
      senderId: clientUser.id,
      body: 'Please add a floating WhatsApp contact button on our homepage so visitors can message us directly.',
    })
    .returning();

  // Create Confirmed Intent & Requirements
  const [confirmedIntent] = await db
    .insert(intents)
    .values({
      projectId: project.id,
      conversationId: conv.id,
      createdBy: devUser.id,
      status: 'confirmed',
      origin: 'ai',
      modifiedByHuman: true,
      title: 'Implement Floating WhatsApp Contact Button',
      summary: 'Add floating WhatsApp contact widget on homepage linking directly to support number.',
      confidence: 0.95,
      sourceMessageId: msg.id,
      reviewedBy: devUser.id,
      reviewedAt: new Date(),
    })
    .returning();

  const [req1] = await db
    .insert(intentRequirements)
    .values({
      intentId: confirmedIntent.id,
      text: 'Add floating WhatsApp contact button widget to bottom-right corner',
      confidence: 0.95,
      position: 1,
    })
    .returning();

  const [req2] = await db
    .insert(intentRequirements)
    .values({
      intentId: confirmedIntent.id,
      text: 'Configure destination phone number for WhatsApp chat routing',
      confidence: 0.9,
      position: 2,
    })
    .returning();

  console.log('✅ Setup data created successfully.');

  // ==========================================
  // TEST 1: AI WORK PROPOSAL GENERATION
  // ==========================================
  console.log('\n--- TEST 1: Generate AI Work Proposal ---');
  const genRes = await app.inject({
    method: 'POST',
    url: `/api/intents/${confirmedIntent.id}/work-proposals/generate`,
    headers: {
      authorization: `Bearer ${devToken}`,
      'x-organization-id': org.id,
    },
  });

  if (genRes.statusCode !== 200) {
    console.error('❌ Proposal generation failed:', genRes.body);
    process.exit(1);
  }

  const proposal = JSON.parse(genRes.body).data;
  console.log(`✅ Proposal generated: ID=${proposal.id}, Status=${proposal.status}, Items=${proposal.items.length}`);
  if (proposal.status !== 'pending_review' || proposal.items.length === 0) {
    console.error('❌ Invalid proposal payload returned:', proposal);
    process.exit(1);
  }

  // ==========================================
  // TEST 2: WORK PROPOSAL EDIT & APPROVAL
  // ==========================================
  console.log('\n--- TEST 2: Edit & Approve Work Proposal ---');

  const modifiedItems = [
    {
      id: proposal.items[0].id,
      title: 'Add floating WhatsApp widget',
      description: 'Implement floating button in bottom right corner with smooth hover animation',
      priority: 'high',
      estimatedEffort: 'small',
      sourceRequirementId: req1.id,
      suggestedRole: 'developer',
    },
    {
      id: proposal.items.length > 1 ? proposal.items[1].id : undefined,
      title: 'Configure WhatsApp destination number & analytics tracking',
      description: 'Route click events to analytics and connect destination phone number',
      priority: 'high',
      estimatedEffort: 'small',
      sourceRequirementId: req2.id,
      suggestedRole: 'developer',
    },
  ];

  const approveRes = await app.inject({
    method: 'POST',
    url: `/api/work-proposals/${proposal.id}/approve`,
    headers: {
      authorization: `Bearer ${devToken}`,
      'x-organization-id': org.id,
    },
    payload: {
      items: modifiedItems,
    },
  });

  if (approveRes.statusCode !== 200) {
    console.error('❌ Proposal approval failed:', approveRes.body);
    process.exit(1);
  }

  const approvalData = JSON.parse(approveRes.body).data;
  const createdWorkItems = approvalData.workItems;
  console.log(`✅ Proposal approved! ${createdWorkItems.length} work items created.`);
  if (createdWorkItems.length !== 2) {
    console.error('❌ Expected 2 work items from approval:', createdWorkItems);
    process.exit(1);
  }

  // ==========================================
  // TEST 3: TRACEABILITY CHAIN VERIFICATION
  // ==========================================
  console.log('\n--- TEST 3: Traceability Chain (Work Item -> Requirement -> Intent -> Message) ---');
  const targetWorkItemId = createdWorkItems[0].id;
  const detailRes = await app.inject({
    method: 'GET',
    url: `/api/work/${targetWorkItemId}`,
    headers: {
      authorization: `Bearer ${devToken}`,
      'x-organization-id': org.id,
    },
  });

  if (detailRes.statusCode !== 200) {
    console.error('❌ Failed to fetch work item details:', detailRes.body);
    process.exit(1);
  }

  const workDetail = JSON.parse(detailRes.body).data;
  console.log('Work Item Details:', {
    id: workDetail.id,
    title: workDetail.title,
    intentTitle: workDetail.intentTitle,
    conversationId: workDetail.conversationId,
    sourceMessageId: workDetail.sourceMessageId,
    requirementsCount: workDetail.requirements?.length,
  });

  if (!workDetail.intentTitle || !workDetail.sourceMessageId || workDetail.requirements.length === 0) {
    console.error('❌ Traceability chain broken in work detail:', workDetail);
    process.exit(1);
  }
  console.log('✅ End-to-end traceability verified successfully!');

  // ==========================================
  // TEST 4: ASSIGNMENT & STATUS LIFECYCLE
  // ==========================================
  console.log('\n--- TEST 4: Work Item Assignment & Status Transition Lifecycle ---');

  // Assign developer
  const assignRes = await app.inject({
    method: 'POST',
    url: `/api/work/${targetWorkItemId}/assign`,
    headers: {
      authorization: `Bearer ${devToken}`,
      'x-organization-id': org.id,
    },
    payload: { assignedTo: devUser.id },
  });

  if (assignRes.statusCode !== 200 || JSON.parse(assignRes.body).data.assignedTo !== devUser.id) {
    console.error('❌ Assignment failed:', assignRes.body);
    process.exit(1);
  }
  console.log('✅ Assigned work item to developer.');

  // Status transition: ready -> in_progress -> completed
  const statusRes1 = await app.inject({
    method: 'POST',
    url: `/api/work/${targetWorkItemId}/status`,
    headers: {
      authorization: `Bearer ${devToken}`,
      'x-organization-id': org.id,
    },
    payload: { status: 'in_progress' },
  });

  if (statusRes1.statusCode !== 200 || JSON.parse(statusRes1.body).data.status !== 'in_progress') {
    console.error('❌ Status transition to in_progress failed:', statusRes1.body);
    process.exit(1);
  }
  console.log('✅ Transitioned status to in_progress.');

  const statusRes2 = await app.inject({
    method: 'POST',
    url: `/api/work/${targetWorkItemId}/status`,
    headers: {
      authorization: `Bearer ${devToken}`,
      'x-organization-id': org.id,
    },
    payload: { status: 'completed' },
  });

  if (statusRes2.statusCode !== 200 || JSON.parse(statusRes2.body).data.status !== 'completed') {
    console.error('❌ Status transition to completed failed:', statusRes2.body);
    process.exit(1);
  }
  console.log('✅ Transitioned status to completed.');

  // Fetch Activity Log
  const activityRes = await app.inject({
    method: 'GET',
    url: `/api/work/${targetWorkItemId}/activity`,
    headers: {
      authorization: `Bearer ${devToken}`,
      'x-organization-id': org.id,
    },
  });

  const activities = JSON.parse(activityRes.body).data;
  console.log(`✅ Audit activity entries recorded: ${activities.length}`);
  if (activities.length < 3) {
    console.error('❌ Missing activity audit entries:', activities);
    process.exit(1);
  }

  // ==========================================
  // TEST 5: AUTHORIZATION & PERMISSION ENFORCEMENT
  // ==========================================
  console.log('\n--- TEST 5: Authorization Enforcement (Client & Stranger restrictions) ---');

  // Client CAN view work
  const clientViewRes = await app.inject({
    method: 'GET',
    url: `/api/projects/${project.id}/work`,
    headers: {
      authorization: `Bearer ${clientToken}`,
      'x-organization-id': org.id,
    },
  });

  if (clientViewRes.statusCode !== 200) {
    console.error('❌ Client should be allowed to view work progress:', clientViewRes.body);
    process.exit(1);
  }
  console.log('✅ Client permitted to view work progress.');

  // Client CANNOT generate work proposal
  const clientGenRes = await app.inject({
    method: 'POST',
    url: `/api/intents/${confirmedIntent.id}/work-proposals/generate`,
    headers: {
      authorization: `Bearer ${clientToken}`,
      'x-organization-id': org.id,
    },
  });

  if (clientGenRes.statusCode !== 403) {
    console.error('❌ Client should be DENIED proposal generation (expected 403):', clientGenRes.body);
    process.exit(1);
  }
  console.log('✅ Client denied proposal generation (403 Forbidden).');

  // Client CANNOT approve proposal
  const clientApproveRes = await app.inject({
    method: 'POST',
    url: `/api/work-proposals/${proposal.id}/approve`,
    headers: {
      authorization: `Bearer ${clientToken}`,
      'x-organization-id': org.id,
    },
    payload: {},
  });

  if (clientApproveRes.statusCode !== 403) {
    console.error('❌ Client should be DENIED proposal approval (expected 403):', clientApproveRes.body);
    process.exit(1);
  }
  console.log('✅ Client denied proposal approval (403 Forbidden).');

  // Stranger user (not in org/project) CANNOT access work items
  const strangerRes = await app.inject({
    method: 'GET',
    url: `/api/projects/${project.id}/work`,
    headers: {
      authorization: `Bearer ${strangerToken}`,
      'x-organization-id': org.id,
    },
  });

  if (strangerRes.statusCode !== 403) {
    console.error('❌ Stranger user should be DENIED access (expected 403):', strangerRes.body);
    process.exit(1);
  }
  console.log('✅ Unauthorized user denied access (403 Forbidden).');

  // ==========================================
  // TEST 6: MANUAL WORK ITEM CREATION & METRICS
  // ==========================================
  console.log('\n--- TEST 6: Manual Work Creation & Metrics ---');
  const manualCreateRes = await app.inject({
    method: 'POST',
    url: `/api/projects/${project.id}/work`,
    headers: {
      authorization: `Bearer ${devToken}`,
      'x-organization-id': org.id,
    },
    payload: {
      title: 'Configure production DNS records',
      description: 'Add A record for root domain pointing to production cluster',
      priority: 'urgent',
      status: 'ready',
    },
  });

  if (manualCreateRes.statusCode !== 201) {
    console.error('❌ Manual work item creation failed:', manualCreateRes.body);
    process.exit(1);
  }
  console.log('✅ Manual work item created by developer.');

  // Fetch project work items & metrics
  const projectWorkRes = await app.inject({
    method: 'GET',
    url: `/api/projects/${project.id}/work`,
    headers: {
      authorization: `Bearer ${devToken}`,
      'x-organization-id': org.id,
    },
  });

  const projectWorkData = JSON.parse(projectWorkRes.body).data;
  console.log('Project Work Metrics:', projectWorkData.metrics);
  if (projectWorkData.workItems.length !== 3 || projectWorkData.metrics.total !== 3) {
    console.error('❌ Work metrics count mismatch:', projectWorkData);
    process.exit(1);
  }
  console.log('✅ Project work items count & metrics verified.');

  console.log('\n====================================================');
  console.log('🎉 ALL PHASE 5 INTEGRATION TESTS PASSED PERFECTLY!');
  console.log('====================================================');
}

runPhase5Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test suite crashed with unhandled exception:', err);
    process.exit(1);
  });
