# IntentFlow Architecture & Technical Documentation

This document outlines the engineering architecture for **IntentFlow**, a web + mobile collaboration platform for clients and developers.

---

## Phase Status Summary

- **Phase 1 — Engineering Foundation**: Completed
- **Phase 2 — Authentication, Organizations & Projects**: Completed

Detailed Phase 2 specification and decision records: see [`phase-2.md`](./phase-2.md).

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

## 2. API Endpoints Overview (Phase 2)

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
