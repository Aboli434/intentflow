# Phase 10 — Project Assignment & Team Workspace Architecture

## 1. Overview & Goal

Phase 10 transitions IntentFlow from organization-level membership (`Organization -> Members`) to project-level team assignment (`Organization -> Projects -> Assigned Project Team`).

In IntentFlow Phase 10:
- A project has explicit team membership stored in `project_members`.
- Project roles are explicitly defined: `client`, `developer`, `manager`, `viewer`.
- Organization roles do **NOT** automatically grant project-level authority (`Org Admin != Project Client`, `Org Developer != Project Developer`).
- Project workspace data and features are exposed exclusively to authorized project team members.
- Immutable audit trail is maintained in `project_member_activity` and `project_activity`.

---

## 2. Database Schema

### 2.1 `project_members` Table
- `id`: UUID primary key
- `project_id`: Foreign key -> `projects.id`
- `user_id`: Foreign key -> `users.id`
- `role`: Enum `('client', 'developer', 'manager', 'viewer')`
- `assigned_by`: Foreign key -> `users.id`
- `created_at`: Timestamp
- `updated_at`: Timestamp
- Constraints & Indexes:
  - `unique(project_id, user_id)`
  - Indexes on `project_id`, `user_id`, `role`

### 2.2 `project_member_activity` Table (Immutable Audit Trail)
- `id`: UUID primary key
- `project_id`: UUID
- `user_id`: UUID (Target member)
- `actor_id`: UUID (User performing action)
- `action`: `'member_assigned' | 'member_role_changed' | 'member_removed'`
- `metadata`: JSONB (`{ projectRole, oldRole, newRole, previousRole }`)
- `created_at`: Timestamp

---

## 3. Authorization Engine & Permission Policies

Centralized authorization is enforced in `apps/api/src/lib/permissions.ts`.

### Policy Actions Added:
- `project_member:view`: View project team members. Allowed to Project Members and Organization Admins.
- `project_member:assign`: Assign user to project team. Allowed to Organization Admins and Project Managers (`projectRole === 'manager'`).
- `project_member:edit`: Change project member role. Allowed to Organization Admins and Project Managers.
- `project_member:remove`: Remove project member. Allowed to Organization Admins and Project Managers.
- `project_workspace:view`: View workspace content for project.
- `project_workspace:manage`: Manage project configuration and team.

### Last Client Protection Rule:
A project must retain at least one assigned `client`. Any attempt to remove or downgrade the last client returns `400 LAST_CLIENT`.

---

## 4. API Endpoints

All endpoints are registered under `/api/projects`:

- `GET /api/projects/:projectId/members`: List project team members with organization and project roles.
- `GET /api/projects/:projectId/available-members`: List unassigned organization members eligible for project assignment.
- `POST /api/projects/:projectId/members`: Assign organization member to project with role validation, immutable activity recording, notification creation, and WebSocket event broadcast.
- `PATCH /api/projects/:projectId/members/:memberId`: Update project member role with last-client protection.
- `DELETE /api/projects/:projectId/members/:memberId`: Remove project member with last-client protection.

---

## 5. Real-Time Infrastructure & Audit Trail

### 5.1 Notifications (`NotificationService`)
- Types: `project_member_assigned`, `project_member_role_changed`, `project_member_removed`.
- Self-notifications are automatically suppressed.
- Notifications are stored in PostgreSQL and delivered via WebSockets.

### 5.2 Real-Time WebSocket Events
- `project.member_assigned`: Broadcasted to project sockets when a new member joins.
- `project.member_role_changed`: Broadcasted when a member's role changes.
- `project.member_removed`: Broadcasted when a member is removed.

### 5.3 Activity Service Sanitization
Activity events log user names and roles without exposing private developer notes, internal system flags, or AI metadata.

---

## 6. Web & Mobile UI

### 6.1 Web UI (`apps/web`)
- Workspace Tab: `👥 Team` added to project workspace page (`Conversations`, `Work`, `Deliverables`, `Completion`, `👥 Team`, `Activity`, `Overview`).
- Components (`apps/web/src/components/project-team/`):
  - `ProjectTeamView.tsx`: Main team workspace view with member count, search filter, and assign member trigger.
  - `ProjectMemberCard.tsx`: Dark slate card with avatar/initials, org role, project role badge, assignment date, role change selector, and removal confirmation modal.
  - `AssignMemberDialog.tsx`: Dialog with org member search/select and `ProjectRoleSelector`.
  - `ProjectRoleSelector.tsx`: Role picker with descriptions for Client, Developer, Manager, and Viewer.

### 6.2 Mobile UI (`apps/mobile`)
- Screen: `apps/mobile/app/(app)/team.tsx`
- Features: View team members, role badges, modal dialog for assigning unassigned organization members, role editing modal, and remove member confirmation alert.

---

## 7. Integration Tests & Verification

Script: `scratch/test-phase10.ts`

### 16 Test Cases Verified:
1. Admin assigns developer -> `201`
2. Manager assigns developer -> `201`
3. Developer without manager role attempts assignment -> `403`
4. Client attempts assignment -> `403`
5. Duplicate assignment -> `409`
6. Change project role -> `200`
7. Remove project member -> `200`
8. Attempt to remove final client -> `400`
9. Cross-organization assignment -> `403`
10. Cross-organization member listing -> `403`
11. Notification created
12. Activity event created
13. WebSocket event emitted
14. Available-members endpoint excludes assigned users
15. Client can view team but cannot manage team
16. Viewer can view team but cannot manage team

---

## 8. Build & Regression Checks

- `scratch/test-phase10.ts`: 16/16 Passed
- `pnpm typecheck`: 0 errors (9 packages)
- `pnpm lint`: 0 errors
- `pnpm build`: Successful production build across all packages
