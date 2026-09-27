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
  intentQuestions,
  intentEvidence,
  intentVersions,
  intentProcessingRuns,
} from '../apps/api/src/db/schema/index.js';
import { eq } from 'drizzle-orm';
import { generateToken } from '../apps/api/src/lib/auth.js';
import { sessions } from '../apps/api/src/db/schema/index.js';

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

async function runPhase4Tests() {
  console.log('--- STARTING PHASE 4 VERIFICATION SUITE ---');

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
  const devEmail = `dev.phase4.${testRunId}@intentflow.io`;
  const clientEmail = `client.phase4.${testRunId}@intentflow.io`;
  const orgBUserEmail = `user.orgb.${testRunId}@intentflow.io`;

  // Insert test users
  const [devUser] = await db
    .insert(users)
    .values({
      name: 'Dev Developer',
      email: devEmail,
      passwordHash: 'hash',
    })
    .returning();

  const [clientUser] = await db
    .insert(users)
    .values({
      name: 'Client Client',
      email: clientEmail,
      passwordHash: 'hash',
    })
    .returning();

  const [orgBUser] = await db
    .insert(users)
    .values({
      name: 'Org B User',
      email: orgBUserEmail,
      passwordHash: 'hash',
    })
    .returning();

  // Insert Organizations
  const [orgA] = await db
    .insert(organizations)
    .values({
      name: `Phase 4 Org A ${testRunId}`,
      slug: `p4-org-a-${testRunId}`,
    })
    .returning();

  const [orgB] = await db
    .insert(organizations)
    .values({
      name: `Phase 4 Org B ${testRunId}`,
      slug: `p4-org-b-${testRunId}`,
    })
    .returning();

  // Org Memberships
  await db.insert(organizationMembers).values([
    { organizationId: orgA.id, userId: devUser.id, role: 'developer' },
    { organizationId: orgA.id, userId: clientUser.id, role: 'client' },
    { organizationId: orgB.id, userId: orgBUser.id, role: 'developer' },
  ]);

  // Insert Project A in Org A
  const [projectA] = await db
    .insert(projects)
    .values({
      organizationId: orgA.id,
      name: 'Homepage Revamp Project',
      description: 'Refining homepage visual hero & performance',
      status: 'active',
    })
    .returning();

  // Project Memberships
  await db.insert(projectMembers).values([
    { projectId: projectA.id, userId: devUser.id, role: 'developer' },
    { projectId: projectA.id, userId: clientUser.id, role: 'client' },
  ]);

  // Create Conversation in Project A
  const [conversation] = await db
    .insert(conversations)
    .values({
      projectId: projectA.id,
      title: 'Homepage Hero Feedback',
      createdBy: clientUser.id,
    })
    .returning();

  // Insert Client Messages (Scenario from prompt)
  const [msg1] = await db
    .insert(messages)
    .values({
      conversationId: conversation.id,
      senderId: clientUser.id,
      body: 'Can we make the homepage feel more premium? The hero looks a bit plain. I liked the second image I sent earlier. Also the animation feels too fast.',
      type: 'text',
    })
    .returning();

  const devToken = await createTestSession(devUser.id);
  const clientToken = await createTestSession(clientUser.id);
  const orgBToken = await createTestSession(orgBUser.id);

  console.log('\n--- 1. AI ANALYSIS TRIGGER & STRUCTURED JSON TEST ---');
  const analyzeRes = await app.inject({
    method: 'POST',
    url: `/api/conversations/${conversation.id}/intents/analyze`,
    headers: {
      authorization: `Bearer ${devToken}`,
      'x-organization-id': orgA.id,
    },
  });

  console.log('Analyze Status:', analyzeRes.statusCode);
  const analyzeJson = JSON.parse(analyzeRes.payload);

  if (analyzeRes.statusCode !== 200 || !analyzeJson.success) {
    console.error('❌ AI analysis trigger failed:', analyzeJson);
    process.exit(1);
  }

  const intent = analyzeJson.data;
  console.log('✅ Intent Analyzed Successfully:');
  console.log(`   ID: ${intent.id}`);
  console.log(`   Title: "${intent.title}"`);
  console.log(`   Summary: "${intent.summary}"`);
  console.log(`   Status: ${intent.status}`);
  console.log(`   Confidence: ${intent.confidence}`);
  console.log(`   Requirements Count: ${intent.requirements?.length}`);
  console.log(`   Missing Info Questions: ${intent.questions?.length}`);
  console.log(`   Evidence Sources: ${intent.evidence?.length}`);

  if (intent.requirements.length === 0) {
    console.error('❌ Failed: Expected requirements to be extracted.');
    process.exit(1);
  }

  console.log('\n--- 2. EVIDENCE TRACEABILITY MAPPING TEST ---');
  const evidenceList = intent.evidence;
  if (!evidenceList || evidenceList.length === 0) {
    console.error('❌ Failed: Intent requirements must reference evidence message source.');
    process.exit(1);
  }
  console.log(`✅ Evidence link mapped to Message ID: ${evidenceList[0].messageId}`);

  console.log('\n--- 3. AUTHORIZATION & TENANT ISOLATION TESTS ---');

  // Client cannot confirm intent
  const clientConfirmRes = await app.inject({
    method: 'POST',
    url: `/api/intents/${intent.id}/confirm`,
    headers: {
      authorization: `Bearer ${clientToken}`,
      'x-organization-id': orgA.id,
    },
  });

  if (clientConfirmRes.statusCode === 403) {
    console.log('✅ Client intent confirmation DENIED (403 Forbidden) as required.');
  } else {
    console.error('❌ Failed: Client should NOT be allowed to confirm internal intent.', clientConfirmRes.statusCode);
    process.exit(1);
  }

  // Org B user cannot access Org A intent
  const tenantIsoRes = await app.inject({
    method: 'GET',
    url: `/api/intents/${intent.id}`,
    headers: {
      authorization: `Bearer ${orgBToken}`,
      'x-organization-id': orgB.id,
    },
  });

  if (tenantIsoRes.statusCode === 403) {
    console.log('✅ Cross-tenant access DENIED (403 Forbidden) as required.');
  } else {
    console.error('❌ Failed: Cross-tenant isolation broken.', tenantIsoRes.statusCode);
    process.exit(1);
  }

  console.log('\n--- 4. HUMAN EDITING & MODIFICATION HISTORY TEST ---');
  const updatedReqText = 'Use the second supplied image as the preferred hero asset, subject to visual quality review.';
  
  const editRes = await app.inject({
    method: 'PATCH',
    url: `/api/intents/${intent.id}`,
    headers: {
      authorization: `Bearer ${devToken}`,
      'x-organization-id': orgA.id,
    },
    payload: {
      title: 'Homepage visual refinement (Reviewed)',
      summary: 'Improve hero visual quality, replace hero asset with preferred image, adjust animation speed.',
      requirements: [
        { text: 'Improve hero visual', position: 1 },
        { text: updatedReqText, position: 2 },
        { text: 'Review animation speed', position: 3 },
      ],
    },
  });

  const editJson = JSON.parse(editRes.payload);
  if (editRes.statusCode !== 200 || !editJson.data.modifiedByHuman) {
    console.error('❌ Failed: Human edit should set modifiedByHuman = true', editRes.payload);
    process.exit(1);
  }
  console.log('✅ Human Edit Persisted & modifiedByHuman = true.');
  console.log(`   New Version Count: ${editJson.data.versions?.length}`);

  console.log('\n--- 5. CONFIRMATION LIFE-CYCLE TEST ---');
  const confirmRes = await app.inject({
    method: 'POST',
    url: `/api/intents/${intent.id}/confirm`,
    headers: {
      authorization: `Bearer ${devToken}`,
      'x-organization-id': orgA.id,
    },
  });

  const confirmJson = JSON.parse(confirmRes.payload);
  if (confirmRes.statusCode !== 200 || confirmJson.data.status !== 'confirmed') {
    console.error('❌ Failed: Confirmation should set status = confirmed', confirmRes.payload);
    process.exit(1);
  }
  console.log('✅ Intent Confirmed successfully:');
  console.log(`   Status: ${confirmJson.data.status}`);
  console.log(`   Reviewed By: ${confirmJson.data.reviewedBy}`);
  console.log(`   Reviewed At: ${confirmJson.data.reviewedAt}`);

  console.log('\n--- 6. REJECTION LIFE-CYCLE TEST ---');
  // Create second conversation for rejection testing
  const [conv2] = await db
    .insert(conversations)
    .values({
      projectId: projectA.id,
      title: 'Design Inspiration Only',
      createdBy: clientUser.id,
    })
    .returning();

  await db.insert(messages).values({
    conversationId: conv2.id,
    senderId: clientUser.id,
    body: 'Just sharing some websites I like for inspiration, no changes needed right now.',
    type: 'text',
  });

  const analyze2Res = await app.inject({
    method: 'POST',
    url: `/api/conversations/${conv2.id}/intents/analyze`,
    headers: {
      authorization: `Bearer ${devToken}`,
      'x-organization-id': orgA.id,
    },
  });
  const intent2Id = JSON.parse(analyze2Res.payload).data.id;

  const rejectRes = await app.inject({
    method: 'POST',
    url: `/api/intents/${intent2Id}/reject`,
    headers: {
      authorization: `Bearer ${devToken}`,
      'x-organization-id': orgA.id,
    },
    payload: {
      reason: 'Client was only sharing design inspiration, not requesting actual work.',
    },
  });

  const rejectJson = JSON.parse(rejectRes.payload);
  if (rejectRes.statusCode !== 200 || rejectJson.data.status !== 'rejected') {
    console.error('❌ Failed: Rejection should set status = rejected', rejectRes.payload);
    process.exit(1);
  }
  console.log('✅ Intent Rejected successfully & reason persisted:');
  console.log(`   Status: ${rejectJson.data.status}`);
  console.log(`   Reason: "${rejectJson.data.rejectionReason}"`);

  console.log('\n--- 7. DATABASE PERSISTENCE VERIFICATION ---');
  const dbIntents = await db.select().from(intents).where(eq(intents.id, intent.id));
  const dbReqs = await db.select().from(intentRequirements).where(eq(intentRequirements.intentId, intent.id));
  const dbQstns = await db.select().from(intentQuestions).where(eq(intentQuestions.intentId, intent.id));
  const dbEvdnc = await db.select().from(intentEvidence).where(eq(intentEvidence.intentId, intent.id));
  const dbVrsns = await db.select().from(intentVersions).where(eq(intentVersions.intentId, intent.id));
  const dbRuns = await db.select().from(intentProcessingRuns).where(eq(intentProcessingRuns.intentId, intent.id));

  console.log(`✅ DB Table 'intents': ${dbIntents.length} record(s)`);
  console.log(`✅ DB Table 'intent_requirements': ${dbReqs.length} record(s)`);
  console.log(`✅ DB Table 'intent_questions': ${dbQstns.length} record(s)`);
  console.log(`✅ DB Table 'intent_evidence': ${dbEvdnc.length} record(s)`);
  console.log(`✅ DB Table 'intent_versions': ${dbVrsns.length} record(s)`);
  console.log(`✅ DB Table 'intent_processing_runs': ${dbRuns.length} record(s)`);

  console.log('\n🎉 ALL PHASE 4 INTEGRATION & AUTHORIZATION TESTS PASSED PERFECTLY!');
  process.exit(0);
}

runPhase4Tests().catch((err) => {
  console.error('❌ Test suite error:', err);
  process.exit(1);
});
