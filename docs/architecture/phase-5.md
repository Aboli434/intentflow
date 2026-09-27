# IntentFlow — Phase 5 Architecture Documentation

## Confirmed Intent → Structured Work → Developer Execution → Progress Tracking

This document details the architectural design, database entities, AI proposal generation, human review workflow, permission policies, and traceability model implemented in **Phase 5** of IntentFlow.

---

## 1. Product Objective & Workflow Boundary

Phase 5 completes the transition from client communication to controlled software execution:

```text
Client Communication
        ↓
Intent Analysis
        ↓
Human Developer Review
        ↓
Confirmed Intent
        ↓
Generate Work Proposal (AI / Local Engine)
        ↓
Developer Reviews Proposal (Approve / Edit / Reject)
        ↓
Work Items Created
        ↓
Developer Assignment & Status Transitions
        ↓
Activity Audit Log
        ↓
Client-Visible Progress Monitoring
```

### Critical Product Boundaries:
- **No Autonomous Agents**: AI never assigns developers, changes work status, marks work complete, deploys code, or sends messages to clients independently.
- **Human Controlled**: Humans review, edit, approve, assign, and complete work.
- **Traceability**: Every work item links directly back to its source requirement, confirmed intent, and original client message.

---

## 2. Database Entities & Schemas

Phase 5 introduced 5 new PostgreSQL tables managed via Drizzle ORM:

### 2.1 `work_items`
- `id` (UUID, Primary Key)
- `projectId` (FK -> `projects.id`)
- `intentId` (FK -> `intents.id`, optional)
- `title` (text)
- `description` (text, optional)
- `status` (`backlog` | `ready` | `in_progress` | `blocked` | `in_review` | `completed` | `cancelled`)
- `priority` (`low` | `medium` | `high` | `urgent`)
- `createdBy` (FK -> `users.id`)
- `assignedTo` (FK -> `users.id`, optional)
- `dueDate` (timestamp, optional)
- `position` (integer)
- `createdAt`, `updatedAt`, `completedAt`

### 2.2 `work_item_requirements`
- `id` (UUID, Primary Key)
- `workItemId` (FK -> `work_items.id`)
- `requirementId` (FK -> `intent_requirements.id`)
- `createdAt`

### 2.3 `work_proposals`
- `id` (UUID, Primary Key)
- `projectId` (FK -> `projects.id`)
- `intentId` (FK -> `intents.id`)
- `createdBy` (FK -> `users.id`, optional)
- `status` (`draft` | `pending_review` | `approved` | `rejected`)
- `generatedBy` (`ai` | `human`)
- `createdAt`, `reviewedAt`, `reviewedBy`

### 2.4 `work_proposal_items`
- `id` (UUID, Primary Key)
- `proposalId` (FK -> `work_proposals.id`)
- `title` (text)
- `description` (text, optional)
- `priority` (`low` | `medium` | `high` | `urgent`)
- `estimatedEffort` (`small` | `medium` | `large`)
- `sourceRequirementId` (FK -> `intent_requirements.id`, optional)
- `suggestedRole` (text)
- `position` (integer)

### 2.5 `work_item_activity`
- `id` (UUID, Primary Key)
- `workItemId` (FK -> `work_items.id`)
- `actorId` (FK -> `users.id`)
- `type` (`created` | `assigned` | `status_changed` | `priority_changed` | `commented` | `blocked` | `unblocked` | `completed`)
- `metadata` (JSONB)
- `createdAt`

---

## 3. Centralized Permission & Policy Model

Phase 5 extended the centralized authorization engine in `apps/api/src/lib/permissions.ts`:

| Policy Action | Organization Admin | Developer | Client |
|---|---|---|---|
| `work:view` | Allowed | Allowed (Project) | Allowed (Client-safe progress) |
| `work:view_activity` | Allowed | Allowed (Project) | Allowed |
| `work:create` | Allowed | Allowed (Project) | Denied (403) |
| `work:edit` | Allowed | Allowed (Project) | Denied (403) |
| `work:assign` | Allowed | Allowed (Project) | Denied (403) |
| `work:change_status` | Allowed | Allowed (Project) | Denied (403) |
| `work:generate_proposal` | Allowed | Allowed (Project) | Denied (403) |
| `work:approve_proposal` | Allowed | Allowed (Project) | Denied (403) |
| `work:complete` | Allowed | Allowed (Project) | Denied (403) |

---

## 4. API Endpoints

### Work Proposals API:
- `POST /api/intents/:intentId/work-proposals/generate` — Generate AI work proposal
- `GET /api/intents/:intentId/work-proposals` — Fetch proposals for intent
- `GET /api/work-proposals/:proposalId` — Fetch proposal detail with items
- `PATCH /api/work-proposals/:proposalId` — Edit proposed items before approval
- `POST /api/work-proposals/:proposalId/approve` — Approve proposal and convert items into production work_items
- `POST /api/work-proposals/:proposalId/reject` — Reject proposal

### Work Items API:
- `POST /api/projects/:projectId/work` — Create manual work item
- `GET /api/projects/:projectId/work` — List work items and execution metrics
- `GET /api/work/:workItemId` — Fetch work item details and traceability links
- `PATCH /api/work/:workItemId` — Update title, description, priority, due date
- `POST /api/work/:workItemId/assign` — Assign or unassign developer
- `POST /api/work/:workItemId/status` — Transition work item status
- `GET /api/work/:workItemId/activity` — Fetch audit activity log

---

## 5. End-to-End Traceability Chain

Every work item maintains full links to upstream entities:

```text
Work Item (work_items)
    ↓
Work Item Requirement (work_item_requirements)
    ↓
Intent Requirement (intent_requirements)
    ↓
Confirmed Intent (intents)
    ↓
Source Client Message (messages)
```

In the Web application UI, opening any work item displays the full traceability chain with a direct link to inspect the original client conversation message.

---

## 6. Real-Time Events

The Fastify WebSocket service broadcasts the following events to project members:

- `work_proposal.ready` — Triggered when AI proposal is generated
- `work_proposal.approved` — Triggered when proposal is approved and work items created
- `work_proposal.rejected` — Triggered when proposal is rejected
- `work.created` — Triggered when a work item is created
- `work.updated` — Triggered when work details update
- `work.assigned` — Triggered when developer assignment changes
- `work.status_changed` — Triggered when work status transitions
- `work.completed` — Triggered when work is marked completed

---

## 7. Build & Integration Verification Results

- **Database Connection**: PostgreSQL connected, schema migration `0004_windy_captain_britain.sql` applied.
- **Monorepo Typecheck**: `pnpm typecheck` passed (9 tasks successful across 6 packages).
- **Monorepo Build**: `pnpm build` passed (all production Next.js and API bundles compiled with 0 errors).
- **Integration Test Suite**: `scratch/test-phase5.ts` passed 100% of test cases:
  1. AI proposal generation
  2. Proposal item editing & approval into `work_items`
  3. Traceability chain verification
  4. Work item assignment & status transition lifecycle
  5. Authorization enforcement (client/stranger restriction checks)
  6. Manual work item creation & metric calculation
