import { getDb } from '../config/database.js';
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
  workItems,
  deliverables,
  notifications,
  projectActivity,
} from './schema/index.js';
import { eq, and } from 'drizzle-orm';

export async function seedDemoData() {
  console.log('🌱 Starting IntentFlow Portfolio Demo Data Seeding (Idempotent)...');
  const db = getDb();

  // Helper for idempotent user upsert/find
  async function upsertUser(email: string, name: string) {
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) return existing[0];
    const [created] = await db
      .insert(users)
      .values({
        email,
        name,
        passwordHash: '$2a$10$demoPasswordHashSignatureSecretKey2026', // Standard password hash placeholder
      })
      .returning();
    return created;
  }

  // 1. Portfolio Demo Users (Admin, Developer, Client)
  const adminUser = await upsertUser('admin@intentflow-demo.io', 'Alex Rivera (Demo Admin)');
  const devUser = await upsertUser('developer@intentflow-demo.io', 'Sarah Chen (Demo Developer)');
  const clientUser = await upsertUser('client@intentflow-demo.io', 'Michael Vance (Demo Client)');
  console.log('  ✓ Demo Users verified (Admin, Developer, Client)');

  // 2. Demo Organization (Nexus Digital Agency)
  let [demoOrg] = await db.select().from(organizations).where(eq(organizations.slug, 'nexus-digital-agency')).limit(1);
  if (!demoOrg) {
    [demoOrg] = await db
      .insert(organizations)
      .values({
        name: 'Nexus Digital Agency',
        slug: 'nexus-digital-agency',
      })
      .returning();
  }
  console.log('  ✓ Organization "Nexus Digital Agency" verified');

  // 3. Organization Memberships (Idempotent)
  async function ensureOrgMember(userId: string, role: 'admin' | 'developer' | 'client') {
    const existing = await db
      .select()
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, demoOrg.id), eq(organizationMembers.userId, userId)))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(organizationMembers).values({
        organizationId: demoOrg.id,
        userId,
        role,
      });
    }
  }

  await ensureOrgMember(adminUser.id, 'admin');
  await ensureOrgMember(devUser.id, 'developer');
  await ensureOrgMember(clientUser.id, 'client');
  console.log('  ✓ Organization Memberships assigned');

  // 4. Demo Project ("Website Redesign & Launch")
  let [demoProject] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.organizationId, demoOrg.id), eq(projects.name, 'Website Redesign & Launch')))
    .limit(1);

  if (!demoProject) {
    [demoProject] = await db
      .insert(projects)
      .values({
        organizationId: demoOrg.id,
        name: 'Website Redesign & Launch',
        description: 'Complete brand overhaul, client portal integration, and responsive Next.js web platform.',
        status: 'active',
      })
      .returning();
  }

  async function ensureProjectMember(userId: string, role: 'client' | 'developer' | 'manager' | 'viewer') {
    const existing = await db
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, demoProject.id), eq(projectMembers.userId, userId)))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(projectMembers).values({
        projectId: demoProject.id,
        userId,
        role,
      });
    }
  }

  await ensureProjectMember(adminUser.id, 'manager');
  await ensureProjectMember(devUser.id, 'developer');
  await ensureProjectMember(clientUser.id, 'client');
  console.log('  ✓ Demo Project "Website Redesign & Launch" verified');

  // 5. Demo Conversation & Messages
  let [demoConv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.projectId, demoProject.id), eq(conversations.title, 'Website Portal & Attachment Upload Requirements')))
    .limit(1);

  if (!demoConv) {
    [demoConv] = await db
      .insert(conversations)
      .values({
        projectId: demoProject.id,
        title: 'Website Portal & Attachment Upload Requirements',
        createdBy: clientUser.id,
      })
      .returning();

    await db.insert(messages).values([
      {
        conversationId: demoConv.id,
        senderId: clientUser.id,
        body: 'We need secure attachment uploads for our clients with 25MB file limits and strict multi-tenant access control.',
      },
      {
        conversationId: demoConv.id,
        senderId: devUser.id,
        body: 'Understood. We are building AWS S3 and Supabase adapters with filename sanitization and RBAC member verification.',
      },
      {
        conversationId: demoConv.id,
        senderId: clientUser.id,
        body: 'Great. Also make sure the design matches our dark SaaS aesthetic with responsive mobile navigation.',
      },
    ]);
  }
  console.log('  ✓ Sample Conversation & Messages verified');

  // 6. Demo AI Intent & Requirements
  let [demoIntent] = await db.select().from(intents).where(eq(intents.conversationId, demoConv.id)).limit(1);
  if (!demoIntent) {
    [demoIntent] = await db
      .insert(intents)
      .values({
        projectId: demoProject.id,
        conversationId: demoConv.id,
        createdBy: devUser.id,
        title: 'Multi-Tenant Storage Hardening & Responsive UX',
        summary: 'Implement S3/Supabase storage backend with 25MB limits, member authorization, and dark SaaS responsive layout.',
        status: 'confirmed',
        confidence: 0.94,
        modifiedByHuman: true,
      })
      .returning();

    await db.insert(intentRequirements).values([
      {
        intentId: demoIntent.id,
        text: 'Enforce 25MB upload limits, extension sanitization, and project member-only stream access.',
        confidence: 0.95,
        position: 0,
      },
      {
        intentId: demoIntent.id,
        text: 'Ensure dark SaaS visual theme and responsive mobile workspace drawer navigation.',
        confidence: 0.92,
        position: 1,
      },
    ]);
  }
  console.log('  ✓ Sample AI Intent & Requirements verified');

  // 7. Work Items across various statuses (Ready, In Progress, Blocked, Completed)
  async function ensureWorkItem(title: string, description: string, status: any, priority: any, assigneeId: string) {
    const existing = await db
      .select()
      .from(workItems)
      .where(and(eq(workItems.projectId, demoProject.id), eq(workItems.title, title)))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(workItems).values({
        projectId: demoProject.id,
        intentId: demoIntent.id,
        title,
        description,
        status,
        priority,
        assignedTo: assigneeId,
        createdBy: adminUser.id,
      });
    }
  }

  await ensureWorkItem('Configure S3 & Supabase Storage Adapters', 'Implement stream authorization, 25MB size guards, and filename sanitization', 'completed', 'high', devUser.id);
  await ensureWorkItem('Implement Responsive Navigation & Dark Mode', 'Unify workspace sidebars and mobile drawer navigation primitives', 'in_progress', 'high', devUser.id);
  await ensureWorkItem('Integrate Real-Time WebSocket Notifications', 'Connect Fastify WebSocket server to client notification feeds', 'ready', 'medium', devUser.id);
  await ensureWorkItem('Third-Party Billing Integration', 'Blocked on client API key provision and payment gateway webhook registration', 'blocked', 'urgent', devUser.id);
  console.log('  ✓ Work Items across status spectrum verified');

  // 8. Deliverables (One Approved, One Changes Requested)
  async function ensureDeliverable(title: string, description: string, status: string, approvedBy?: string) {
    const existing = await db
      .select()
      .from(deliverables)
      .where(and(eq(deliverables.projectId, demoProject.id), eq(deliverables.title, title)))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(deliverables).values({
        projectId: demoProject.id,
        title,
        description,
        status,
        createdBy: devUser.id,
        approvedBy: approvedBy || null,
      });
    }
  }

  await ensureDeliverable('Website Design System & Component Library', 'Dark SaaS palette, Typography tokens, and responsive layout primitives', 'approved', clientUser.id);
  await ensureDeliverable('Staging Deployment & API Integration Package', 'Staging server deployment and authentication integration bundle', 'changes_requested');
  console.log('  ✓ Deliverables (Approved & Changes Requested) verified');

  // 9. Sample Activity & Notifications
  const existingNotifs = await db.select().from(notifications).where(eq(notifications.organizationId, demoOrg.id)).limit(1);
  if (existingNotifs.length === 0) {
    await db.insert(notifications).values([
      {
        userId: clientUser.id,
        organizationId: demoOrg.id,
        projectId: demoProject.id,
        type: 'deliverable_approved',
        title: 'Deliverable Approved',
        body: 'Website Design System & Component Library has been approved by Michael Vance',
      },
      {
        userId: devUser.id,
        organizationId: demoOrg.id,
        projectId: demoProject.id,
        type: 'deliverable_changes_requested',
        title: 'Changes Requested on Deliverable',
        body: 'Michael Vance requested changes on Staging Deployment & API Integration Package',
      },
    ]);

    await db.insert(projectActivity).values([
      {
        projectId: demoProject.id,
        actorId: clientUser.id,
        type: 'deliverable_approved',
        entityType: 'deliverable',
        metadata: { title: 'Website Design System & Component Library', approver: 'Michael Vance' },
      },
      {
        projectId: demoProject.id,
        actorId: clientUser.id,
        type: 'deliverable_rejected',
        entityType: 'deliverable',
        metadata: { title: 'Staging Deployment & API Integration Package', feedback: 'Please update CORS origin settings' },
      },
    ]);
  }
  console.log('  ✓ Notifications & Activity Timeline verified');

  console.log('✨ Portfolio Demo Data Seeding Completed Idempotently!');
  return { orgId: demoOrg.id, projectId: demoProject.id };
}

if (process.argv[1] && process.argv[1].endsWith('seed-demo.ts')) {
  seedDemoData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Failed to seed demo data:', err);
      process.exit(1);
    });
}
