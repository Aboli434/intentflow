# IntentFlow Architecture & Technical Documentation — Phase 7

## Phase 7: Client Portal, Approvals & Delivery

This document specifies the technical architecture, domain model, database schema, authorization policies, and integration details for **Phase 7 — Client Portal, Approvals & Delivery**.

---

## 1. Executive Summary

Phase 7 introduces the client-facing delivery and review workflow into IntentFlow. It bridges developer execution with formal client review:

$$\text{Developer Execution} \longrightarrow \text{Work Completed / Deliverable Prepared} \longrightarrow \text{Client Review} \longrightarrow \text{Client Approval OR Revision Request} \longrightarrow \text{Developer Action} \longrightarrow \text{Final Approval} \longrightarrow \text{Project Milestone / Delivery Completed}$$

### Human-in-the-Loop Principle
AI in IntentFlow remains strictly advisory. AI cannot:
- Approve or reject deliverables
- Approve client requests
- Mark deliverables as client-approved
- Close projects autonomously

---

## 2. Core Domain Concepts

1. **Deliverables**: Collections of work items, descriptions, and attachments submitted to clients for review.
2. **Client Reviews**: Formal feedback recorded by clients (`pending`, `approved`, `changes_requested`).
3. **Revision Requests**: Traceable change requests raised by clients, with an independent lifecycle (`open`, `in_progress`, `resolved`, `cancelled`).
4. **Project Milestones**: Stage-gate containers grouping deliverables into high-level project milestones (`upcoming`, `in_progress`, `review`, `completed`, `blocked`).

---

## 3. Database Schema

Seven new PostgreSQL tables were introduced via Drizzle ORM migration `0006_confused_the_liberteens.sql`:

- `deliverables`: Stores deliverable metadata, status (`draft`, `ready_for_review`, `in_review`, `changes_requested`, `approved`, `archived`), author, approval timestamps, and approver user ID.
- `deliverable_work_items`: Links deliverables to work items with a `unique(deliverableId, workItemId)` constraint.
- `deliverable_attachments`: Links deliverables to uploaded project attachments.
- `client_reviews`: Records client review comments, client user ID, and review status.
- `revision_requests`: Tracks revision details requested by clients, current status, resolution timestamp, and resolving developer user ID.
- `project_milestones`: Manages stage milestone titles, target due dates, status, and ordering position.
- `milestone_deliverables`: Join table connecting project milestones to deliverables.

---

## 4. Centralized Authorization Model

Policies added to `apps/api/src/lib/permissions.ts`:

- `deliverable:view`, `deliverable:create`, `deliverable:edit`
- `deliverable:submit_review`
- `deliverable:approve` (REQUIRES `projectRole === 'client'`)
- `deliverable:request_changes` (REQUIRES `projectRole === 'client'`)
- `review:view`, `review:create`
- `revision:view`, `revision:create`, `revision:manage`
- `milestone:view`, `milestone:create`, `milestone:edit`, `milestone:complete`

### Critical Authorization Rule
`orgRole !== client approval authority`

An Organization Admin without a `client` role assigned at the project level (`projectRole === 'client'`) **cannot** approve deliverables or request changes on behalf of the client.

---

## 5. API Endpoints

### Deliverables API (`/api`)
- `POST /api/projects/:projectId/deliverables` — Create deliverable (Developer/Admin)
- `GET /api/projects/:projectId/deliverables` — List project deliverables
- `GET /api/deliverables/:deliverableId` — Get deliverable details with sanitized client fields if requested by client
- `PATCH /api/deliverables/:deliverableId` — Update deliverable metadata (Developer/Admin)
- `POST /api/deliverables/:deliverableId/submit-review` — Submit deliverable for client review (Developer/Admin)
- `POST /api/deliverables/:deliverableId/approve` — Approve deliverable (Client only)
- `POST /api/deliverables/:deliverableId/request-changes` — Request revisions with required comment (Client only)
- `GET /api/deliverables/:deliverableId/reviews` — Fetch review history
- `GET /api/deliverables/:deliverableId/revisions` — Fetch revision requests
- `PATCH /api/revisions/:revisionId/status` — Update revision request status (`in_progress`, `resolved`) (Developer/Admin)

### Milestones API (`/api`)
- `POST /api/projects/:projectId/milestones` — Create milestone (Developer/Admin)
- `GET /api/projects/:projectId/milestones` — List project milestones
- `GET /api/milestones/:milestoneId` — Fetch milestone details with linked deliverables
- `PATCH /api/milestones/:milestoneId` — Update milestone details (Developer/Admin)
- `POST /api/milestones/:milestoneId/status` — Update milestone execution status (Developer/Admin)
- `POST /api/milestones/:milestoneId/deliverables` — Link deliverable to milestone (Developer/Admin)
- `DELETE /api/milestones/:milestoneId/deliverables/:deliverableId` — Unlink deliverable from milestone (Developer/Admin)

---

## 6. Real-Time Events & Notifications

### WebSocket Events
- `deliverable.created`, `deliverable.updated`, `deliverable.submitted`, `deliverable.approved`, `deliverable.changes_requested`
- `revision.created`, `revision.updated`
- `milestone.created`, `milestone.updated`, `milestone.completed`

### Notification Types
- `deliverable_ready`: Dispatched to project clients when submitted for review
- `deliverable_approved`: Dispatched to project developers on client approval
- `deliverable_changes_requested`: Dispatched to project developers on revision request
- `revision_started` & `revision_resolved`: Dispatched to project clients
- `milestone_completed`: Dispatched to all project members

---

## 7. Client & Developer Web/Mobile UI

### Web Application (`apps/web`)
- Workspace Tab added to `/projects/[projectId]`: `📦 Deliverables & Approval`
- `DeliverablesView.tsx`: Displays deliverable cards, status badges, milestone progress, and client/developer actions.
- `ClientReviewPanel.tsx`: Interactive review panel for clients with `Approve` and `Request Changes` modals.
- `DeliverableEditor.tsx`: Creation & editing modal for developers to select work items, attach files, link milestones, and submit for review.
- `MilestoneTimeline.tsx`: Interactive timeline visualizing milestone stages and attached deliverables.

### Mobile Application (`apps/mobile`)
- `apps/mobile/app/(app)/deliverables.tsx`: Mobile client delivery list.
- `apps/mobile/app/(app)/deliverables/[id].tsx`: Mobile deliverable details screen supporting client review actions (Approve, Request Changes) and revision tracking.

---

## 8. Integration Verification Results

Ran `scratch/test-phase7.ts`:
- **13 Integration Tests**: 100% Passed.
- **Tenant Isolation**: Verified cross-organization access returns HTTP 403.
- **Client Role Restriction**: Verified Org Admins without `projectRole === 'client'` receive HTTP 403 on `/approve`.
- **Immutable Project Activity**: Verified all delivery state changes recorded in activity log.
- **Typecheck, Lint & Build**: Passed with zero errors across `@intentflow/api`, `@intentflow/web`, `@intentflow/mobile`, `@intentflow/types`, `@intentflow/validation`.
