# IntentFlow Architecture & Technical Documentation

This document outlines the engineering architecture for **IntentFlow**, a web + mobile collaboration platform for clients and developers.

---

## Phase Status Summary

- **Phase 1 — Engineering Foundation**: Completed
- **Phase 2 — Authentication, Organizations & Projects**: Completed
- **Phase 3 — Conversations & Messaging**: Completed
- **Phase 4 — Intent Intelligence & Human Review**: Completed
- **Phase 5 — Confirmed Intent → Structured Work & Execution**: Completed
- **Phase 6 — Notifications, Activity & Progress Intelligence**: Completed
- **Phase 7 — Client Portal, Approvals & Delivery**: Completed
- **Phase 8 — Project Closure, Handoff & Completion**: Completed
- **Phase 9 — Multi-Channel Team Invitations & Member Management**: Completed

Detailed specifications and decision records:
- Phase 2: [`phase-2.md`](./phase-2.md)
- Phase 3: [`phase-3.md`](./phase-3.md)
- Phase 4: [`phase-4.md`](./phase-4.md)
- Phase 5: [`phase-5.md`](./phase-5.md)
- Phase 6: [`phase-6.md`](./phase-6.md)
- Phase 7: [`phase-7.md`](./phase-7.md)
- Phase 8: [`phase-8.md`](./phase-8.md)
- Phase 9: [`phase-9.md`](./phase-9.md)

---

## 1. Monorepo Structure

IntentFlow uses a monorepo powered by **pnpm workspaces** and **Turborepo**.

```
intentflow/
├── apps/
│   ├── web/        # Next.js App Router client web application (Port 3000)
│   ├── mobile/     # Expo / React Native mobile client application
│   └── api/        # Fastify Node.js backend API (Port 4000)
├── packages/
│   ├── types/      # Shared TypeScript type definitions (@intentflow/types)
│   ├── validation/ # Shared Zod validation schemas (@intentflow/validation)
│   └── config/     # Shared non-secret configuration constants (@intentflow/config)
├── docs/
│   ├── product/    # Product requirements and specifications
│   ├── ux/         # User experience design guidelines and flows
│   └── architecture/# Technical architecture documentation
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.json
├── .gitignore
└── README.md
```

---

## 2. API Endpoints Overview

### Auth API (`/api/auth`)
- `POST /api/auth/signup` — Register new user account (supports `invitationToken`)
- `POST /api/auth/login` — Authenticate user & issue session token
- `POST /api/auth/logout` — Invalidate active session token
- `GET /api/auth/me` — Return authenticated user & organization memberships

### Organizations API (`/api/organizations`)
- `POST /api/organizations` — Create workspace organization (User becomes Admin)
- `GET /api/organizations` — List user's organizations
- `GET /api/organizations/:organizationId` — Get organization details
- `PATCH /api/organizations/:organizationId` — Update organization (Admin only)
- `GET /api/organizations/:organizationId/members` — List organization members
- `DELETE /api/organizations/:organizationId/members/:memberId` — Remove member (Admin only)
- `POST /api/organizations/:organizationId/invitations` — Invite user by email (Admin only)

### Invitations API (`/api/invitations`)
- `GET /api/invitations/:token` — Preview invitation status & details
- `POST /api/invitations/:token/accept` — Accept invitation for authenticated user

### Projects API (`/api/projects`)
- `POST /api/projects` — Create project within organization
- `GET /api/projects` — List accessible projects for current user
- `GET /api/projects/:projectId` — Project details & assigned member list
- `PATCH /api/projects/:projectId` — Update project status/details
- `POST /api/projects/:projectId/members` — Add project member
- `DELETE /api/projects/:projectId/members/:memberId` — Remove project member

### Conversations & Messaging API (`/api`)
- `POST /api/projects/:projectId/conversations` — Create conversation thread
- `GET /api/projects/:projectId/conversations` — List project conversations
- `GET /api/conversations/:conversationId` — Get conversation details
- `POST /api/conversations/:conversationId/participants` — Add conversation participant
- `DELETE /api/conversations/:conversationId/participants/:userId` — Remove conversation participant
- `GET /api/conversations/:conversationId/messages` — List conversation messages
- `POST /api/conversations/:conversationId/messages` — Send message
- `POST /api/conversations/:conversationId/read` — Mark conversation as read
- `GET /api/conversations/:conversationId/ws` — Real-time WebSocket connection

### Intent Intelligence API (`/api`)
- `POST /api/conversations/:conversationId/intents/analyze` — Trigger AI intent analysis
- `GET /api/conversations/:conversationId/intents` — List detailed intents for conversation
- `GET /api/intents/:intentId` — Get intent details
- `PATCH /api/intents/:intentId` — Edit intent details (Sets `modifiedByHuman = true`)
- `POST /api/intents/:intentId/confirm` — Confirm intent (Sets `status = 'confirmed'`)
- `POST /api/intents/:intentId/reject` — Reject intent with reason (Sets `status = 'rejected'`)
- `POST /api/intents/:intentId/questions/:questionId/dismiss` — Dismiss missing information question
- `POST /api/intents/:intentId/clarification` — Generate clarification question draft for developer review

### Work Proposals & Execution API (`/api`)
- `POST /api/intents/:intentId/work-proposals/generate` — Generate AI work proposal for confirmed intent
- `GET /api/intents/:intentId/work-proposals` — Fetch work proposals for intent
- `GET /api/work-proposals/:proposalId` — Fetch work proposal detail with proposed items
- `PATCH /api/work-proposals/:proposalId` — Edit proposed items before approval
- `POST /api/work-proposals/:proposalId/approve` — Approve proposal & convert items to work items
- `POST /api/work-proposals/:proposalId/reject` — Reject work proposal
- `POST /api/projects/:projectId/work` — Create manual work item
- `GET /api/projects/:projectId/work` — List project work items & metrics
- `GET /api/work/:workItemId` — Fetch single work item with traceability links
- `PATCH /api/work/:workItemId` — Update title, description, priority, due date
- `POST /api/work/:workItemId/assign` — Assign or unassign developer
- `POST /api/work/:workItemId/status` — Transition work item status
- `GET /api/work/:workItemId/activity` — Fetch work item audit activity log

---

## 3. Database Schema

PostgreSQL tables managed via Drizzle ORM:
- `users`: User identity & password hashes
- `sessions`: Active bearer/cookie session tokens
- `organizations`: Workspace teams
- `organization_members`: User role in organization (`admin`, `developer`, `client`)
- `organization_invitations`: Secure email invitation tokens (7-day expiration)
- `projects`: Workspace projects (`active`, `archived`)
- `project_members`: User role in project (`developer`, `client`)
- `conversations`: Project discussion threads
- `conversation_participants`: Participant tracking & read receipts
- `messages`: Persistent text messages
- `attachments`: File attachments with size & MIME type
- `intents`: Structured intent interpretations (`processing`, `ready_for_review`, `confirmed`, `rejected`, `needs_clarification`)
- `intent_requirements`: Extracted actionable requirements
- `intent_questions`: Missing information questions (`open`, `resolved`, `dismissed`)
- `intent_evidence`: Source message & attachment traceability mapping
- `intent_versions`: Human & AI snapshot version history
- `intent_processing_runs`: AI provider execution & diagnostic run logs
- `work_items`: Production work items (`backlog`, `ready`, `in_progress`, `blocked`, `in_review`, `completed`, `cancelled`)
- `work_item_requirements`: Traceability join linking work items to source requirements
- `work_proposals`: Suggested work proposals (`draft`, `pending_review`, `approved`, `rejected`)
- `work_proposal_items`: Proposed work items with estimated effort (`small`, `medium`, `large`)
- `work_item_activity`: Immutable audit log of work item events
