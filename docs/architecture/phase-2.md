# Phase 2 — Authentication, Organizations & Projects Architecture Documentation

This document covers the technical architecture, data model, security implementation, and verification details for **Phase 2** of IntentFlow.

---

## 1. Authentication Architecture

IntentFlow uses a production-ready, centralized session authentication model. Password hashing is executed via Node's `crypto.scrypt` with a 16-byte random salt.

- **Session Tokens**: 32-byte cryptographic random hex strings stored in the `sessions` table in PostgreSQL.
- **Token Transport**: 
  - Web: HTTP-only secure cookie `session_token` and `Authorization: Bearer <token>` header support.
  - Mobile: `Authorization: Bearer <token>` header support.
- **Session Expiration**: 30-day sliding window.

---

## 2. Users Model

- Table: `users`
- Fields: `id`, `name`, `email` (unique), `passwordHash`, `emailVerified`, `avatarUrl`, `createdAt`, `updatedAt`.
- Passwords are never returned in API payloads.

---

## 3. Organizations Model

- Table: `organizations`
- Fields: `id`, `name`, `slug` (unique), `createdAt`, `updatedAt`.
- Workspaces represent the top-level tenant boundaries for IntentFlow clients and developers.

---

## 4. Organization Memberships & Roles

- Table: `organization_members`
- Unique constraint: `(organization_id, user_id)`.
- Roles: `admin`, `developer`, `client`.
- Roles are organization-specific (a user can be an `admin` in Org A and a `developer` in Org B).

---

## 5. Organization Invitations Flow

- Table: `organization_invitations`
- Fields: `id`, `organizationId`, `email`, `role`, `token` (unique 32-byte hex), `expiresAt` (7 days default), `acceptedAt`, `createdAt`.
- **Invitation Journey**:
  1. Admin invites user via `POST /api/organizations/:organizationId/invitations`.
  2. Public preview via `GET /api/invitations/:token`.
  3. Acceptance via `POST /api/invitations/:token/accept` or passed as `invitationToken` during signup (`POST /api/auth/signup`).
  4. System grants organization membership and marks invitation `acceptedAt`.

---

## 6. Projects & Project Memberships

- Table: `projects` (`id`, `organizationId`, `name`, `description`, `status`: `'active' | 'archived'`, `createdAt`, `updatedAt`).
- Table: `project_members` (`id`, `projectId`, `userId`, `role`: `'developer' | 'client'`, `createdAt`).
- A project belongs to exactly one organization. Members added to a project must belong to the project's organization.

---

## 7. Authorization Rules & Tenant Isolation

- **Organization Scoping**: Users can only read/write organization data for organizations where they hold active membership in `organization_members`.
- **Org Admin Privileges**: Only `admin` members can modify organization settings, invite new members, or remove existing members.
- **Project Access**: 
  - Org `admin` members inherit view/manage access across all projects in their organization.
  - Non-admin members (`developer` / `client`) can only access projects where they are explicitly assigned in `project_members`.
  - Attempts by unauthorized users to access unrelated organizations or projects yield `403 Forbidden`.

---

## 8. Web Application Architecture

Next.js 15 (App Router) pages under `apps/web/src/app/`:
- `/login`: Email & password sign-in form with server-side validation error handling.
- `/signup`: User registration form with automatic invitation token acceptance support.
- `/forgot-password`: Password reset request page.
- `/dashboard`: Protected workspace dashboard displaying user details, workspace selector, organization creation modal, and active projects grid.
- `/projects`: Directory listing of accessible projects.
- `/projects/[projectId]`: Detailed view of a project, including organization metadata and assigned project members.
- `/settings`: Organization settings and team member invitation portal for admins.

---

## 9. Mobile Application Architecture

Expo React Native pages under `apps/mobile/app/`:
- `login.tsx`: Mobile authentication screen.
- `signup.tsx`: Mobile registration screen.
- `(app)/index.tsx`: Main projects screen displaying active projects fetched live from Fastify API.
- `(app)/projects/[id].tsx`: Mobile project details & member roster screen.
- `(app)/profile.tsx`: Account profile and logout screen.

---

## 10. Security Decisions

1. **Parameterization**: Drizzle ORM query builders enforce parameterized queries for complete SQL injection defense.
2. **Password Security**: `scrypt` hashing with unique salt per user prevents rainbow table attacks.
3. **Prevent Admin Lockout**: API explicitly blocks removing the last `admin` member from an organization.
4. **Token Security**: Tokens are generated using `crypto.randomBytes(32).toString('hex')`.

---

## 11. Testing Strategy

Automated integration test suite in [`scratch/test-phase2.ts`](file:///C:/Users/Admin/.gemini/antigravity-ide/brain/964b0b97-a485-4758-8b92-10778db80b89/scratch/test-phase2.ts):
- Health check verification with live PostgreSQL.
- User signup, duplicate email rejection (409).
- User login & session creation.
- Organization creation & admin membership assignment.
- Invitation token generation, preview, and acceptance.
- Project creation & member assignment.
- Authorization boundary checks (403 Forbidden for cross-tenant access).
- Logout & session token invalidation (401 Unauthorized).
