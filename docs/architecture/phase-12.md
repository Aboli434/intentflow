# IntentFlow Architecture — Phase 12

## Overview

Phase 12 transforms IntentFlow into a complete B2B SaaS application by introducing:
1. **Global Notification Center**: Desktop popover menu and mobile navigation via `/notifications`.
2. **Notification Ownership & Security**: Strict user and tenant isolation across notification queries and mark-read actions.
3. **Role-Aware Dashboard UX**: Role-tailored action prioritization card (`ActionRequiredCard`) and summary metrics.
4. **Enhanced Audit Activity Timeline**: Friendly event descriptions, date buckets ("Today", "Yesterday", date), and category filters.
5. **Real-Time Notification Delivery**: Integrated WebSocket updates and duplicate event suppression.

---

## Architecture & Data Flow

### 1. Notification Routing & Ownership
- Notifications are stored in the `notifications` table linked to `userId`, `organizationId`, and optional `projectId`.
- Navigation mapping utility `getNotificationTargetUrl` routes each notification type directly to the relevant workspace tab:
  - `project_member_*` → `/projects/:id?tab=team`
  - `closure_*`, `handoff_*`, `project_completed` → `/projects/:id?tab=completion`
  - `deliverable_*`, `revision_*`, `milestone_*` → `/projects/:id?tab=deliverables`
  - `message_received` → `/projects/:id?tab=conversations`
  - `work_*`, `intent_*`, `clarification_*` → `/projects/:id?tab=work`
  - `organization_*` → `/settings`

### 2. Role-Aware Dashboard & Action Required System
- Dashboard inspects the user's project and organization roles (`client`, `developer`, `manager`, `admin`).
- `ActionRequiredCard` prioritizes pending items (deliverables awaiting client approval, revision requests for developers, unassigned items for managers, and org setup for admins).

### 3. Activity Timeline Experience
- `ProjectActivityTimeline` categorizes activities into `Work`, `Deliverables`, `Team`, `Conversations`, `Completion`, and `System`.
- Raw event strings are transformed into clean human-readable statements.
- Internal developer metadata (such as AI prompts or internal confidence scores) is sanitized for `client` users.

---

## API Endpoints

- `GET /api/notifications` — Fetch user notifications with unread filter and pagination.
- `GET /api/notifications/unread-count` — Get unread count.
- `POST /api/notifications/:notificationId/read` & `PATCH /api/notifications/:notificationId/read` — Mark notification as read (enforces `userId` ownership).
- `POST /api/notifications/read-all` — Mark all unread notifications for user as read.
- `GET /api/projects/:projectId/activity` — Fetch project activity timeline (sanitized by role).

---

## Mobile Application Integration

- Screen `/notifications`: Displays category filter pills (`All | Unread | Projects | Organization`), unread count badge, mark-all-read action, and deep-link navigation into project workspace tabs.
- Screen `/`: Dashboard displaying notification bell header button, role-aware Action Required banner, and project cards.

---

## Verification & Testing Results

- **`npx tsx scratch/test-phase12.ts`**: PASS (14/14 tests passed)
- **`pnpm typecheck`**: PASS (0 errors across 9 packages)
- **`pnpm lint`**: PASS (0 errors across 9 packages)
- **`pnpm build`**: PASS (5/5 packages built successfully)
