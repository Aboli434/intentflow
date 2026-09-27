# Phase 6 — Notifications, Activity & Progress Intelligence Architecture

## 1. Phase Objective

Phase 6 completes the communication loop of IntentFlow by introducing persistent notifications, an immutable project activity timeline, and real-time user progress awareness.

```text
Execution → Relevant Notification → Activity History → Clear Project Progress
```

The core product goals are:
- **Noise Reduction**: Notify only on meaningful events (e.g. new client message, intent confirmed, work assigned, work completed).
- **Client vs Developer Intelligence**: Provide full operational context to developers while presenting a sanitized, high-level progress view to clients.
- **Strict Role-Based Authorization**: Ensure zero cross-tenant leakage or unauthorized access to notifications and activity entries.

---

## 2. Database Schema

### `notifications` Table
Stores targeted notifications for specific users.

- `id`: `text` (Primary Key, UUID)
- `userId`: `text` (Foreign Key -> `users.id`)
- `organizationId`: `text` (Foreign Key -> `organizations.id`)
- `projectId`: `text` (Foreign Key -> `projects.id`, Nullable)
- `type`: `text` (Enum: `message_received`, `intent_ready`, `intent_confirmed`, `clarification_requested`, `work_assigned`, `work_started`, `work_blocked`, `work_review`, `work_completed`, `project_update`)
- `title`: `text`
- `body`: `text`
- `entityType`: `text` (Nullable: `conversation`, `intent`, `work_item`, `work_proposal`)
- `entityId`: `text` (Nullable)
- `readAt`: `timestamp` (Nullable)
- `createdAt`: `timestamp` (Default `now()`)

**Indexes**:
- `notif_user_idx`: `(userId)`
- `notif_read_idx`: `(readAt)`
- `notif_created_idx`: `(createdAt)`
- `notif_project_idx`: `(projectId)`

### `project_activity` Table
Stores immutable project audit trails.

- `id`: `text` (Primary Key, UUID)
- `projectId`: `text` (Foreign Key -> `projects.id`)
- `actorId`: `text` (Foreign Key -> `users.id`, Nullable)
- `type`: `text` (e.g., `intent_confirmed`, `work_assigned`, `work_completed`, `message_sent`)
- `entityType`: `text`
- `entityId`: `text` (Nullable)
- `metadata`: `jsonb` (Nullable)
- `createdAt`: `timestamp` (Default `now()`)

---

## 3. Notification Architecture

The notification architecture is implemented in `apps/api/src/services/notifications/notification.service.ts`:

1. **Deterministic Dispatch Rules**:
   - `notifyOnMessageSent`: Notifies assigned project developers when a client sends a message, or clients when a developer sends a message. Prevents self-notifications.
   - `notifyOnIntentConfirmed`: Sends client-safe notification to project clients when an intent is confirmed.
   - `notifyOnClarificationRequested`: Prompts project clients when developer/system requests requirement details.
   - `notifyOnWorkProposalReady`: Notifies developers when AI finishes generating a work proposal.
   - `notifyOnWorkAssigned`: Alerts assigned developer when a work item is assigned.
   - `notifyOnWorkStatusChanged`: Sends progress updates to clients and developers on work state transitions.

2. **Persistence + Dual Real-Time Delivery**:
   - Every notification is persisted to PostgreSQL first.
   - If WebSocket connection is active, `broadcastToUser(userId, event)` streams `notification.created` directly to the client socket.
   - If WebSockets are offline, notifications remain persisted in PostgreSQL and fetchable via REST API.

---

## 4. Activity Architecture

The project activity system is managed via `apps/api/src/services/activity/activity.service.ts`:

1. **Centralized Recording**: `activityService.recordActivity(...)` handles all timeline insertions.
2. **Immutability**: Activity records cannot be modified or deleted via API endpoints.
3. **Role-Based Sanitization**: `getProjectActivity` automatically scrubs developer-only activity types (`intent_analyzed`, `work_proposal_generated`) and internal AI metrics (`confidence`, `provider`, `model`) when requested by a client user.

---

## 5. Permission Model

Permission checks are integrated into `apps/api/src/lib/permissions.ts`:

- `notification:view`: Any user can view their own notifications (`eq(notifications.userId, userId)`).
- `notification:mark_read`: Users can only mark their own notifications as read (enforced via database query).
- `activity:view`: Requires organization admin role or assigned project membership (`dev` or `client`). Cross-org access returns `403 Forbidden`.

---

## 6. API Endpoints

### Notifications
- `GET /api/notifications` — Retrieve paginated notifications for authenticated user.
- `GET /api/notifications/unread-count` — Get unread notification count (`{ count: N }`).
- `POST /api/notifications/:notificationId/read` — Mark single notification as read.
- `POST /api/notifications/read-all` — Mark all user notifications as read.

### Activity
- `GET /api/projects/:projectId/activity` — Get project activity timeline (sanitized for client role).

---

## 7. Web Experience

Implemented in `apps/web`:
- `NotificationBell.tsx`: Interactive bell icon in shell header with unread badge counter, popover list, relative timestamps, and one-click mark read / mark all read.
- `ProjectActivityTimeline.tsx`: New `📜 Activity Log` tab on `/projects/[projectId]` rendering chronological project timeline with actor names, formatted event tags, and relative timestamps.

---

## 8. Mobile Experience

Implemented in `apps/mobile`:
- `app/(app)/notifications.tsx`: Native notifications screen with unread indicators, pull-to-refresh, mark all as read, and tab entry point.

---

## 9. Real-Time Events

WebSocket payload structures:
- `notification.created`: `{ type: "notification.created", notification: Notification }`
- `notification.read`: `{ type: "notification.read", notificationId: string }`

---

## 10. Security Considerations

- **IDOR Protection**: Direct resource access checks enforce `userId` matching.
- **Tenant Isolation**: Notification endpoints query strictly by `userId` and `organizationId`.
- **Client Information Isolation**: Internal AI confidence scores and developer notes are scrubbed before sending payload to client roles.

---

## 11. Testing Results

All Phase 6 capabilities verified via `scratch/test-phase6.ts`:
- ✅ Notification creation on client/developer messages & work item transitions
- ✅ Notification retrieval & unread count tracking
- ✅ Single read & mark-all-read operations
- ✅ IDOR protection (404 on cross-user modification)
- ✅ Tenant notification isolation
- ✅ Immutable project activity timeline recording & client-safe role filtering
- ✅ Unauthorized cross-org project activity rejection (403 Forbidden)

---

## 12. Future Boundary

Out of scope for Phase 6:
- Push notifications / APNs / FCM
- Email / SMS / Slack / WhatsApp delivery
- Autonomous AI notification creation
