# IntentFlow — Production Architecture Documentation

## Overview
IntentFlow is architected as a high-performance, multi-tenant B2B client collaboration SaaS platform. It bridges unstructured client communication and engineering task execution through AI intent intelligence with human-in-the-loop verification.

---

## 1. System Topology Diagram

```text
                                 ┌─────────────────────────────────┐
                                 │         Client Browser          │
                                 │  Desktop (1440px) / Mobile (375)│
                                 └───────────────┬─────────────────┘
                                                 │
                                                 │ HTTPS / WSS
                                                 ▼
                                 ┌─────────────────────────────────┐
                                 │         Vercel Edge CDN         │
                                 │      Next.js 15 Web App         │
                                 │     (Static Pages + Client)     │
                                 └───────────────┬─────────────────┘
                                                 │
                                                 │ REST API & WebSocket
                                                 │ Authorization: Bearer JWT
                                                 ▼
                                 ┌─────────────────────────────────┐
                                 │     Render / Railway Container  │
                                 │        Fastify v5 API           │
                                 │  (Node.js 22 LTS, TypeScript)   │
                                 └───────────────┬─────────────────┘
                                                 │
                   ┌─────────────────────────────┼─────────────────────────────┐
                   │                             │                             │
                   ▼                             ▼                             ▼
       ┌───────────────────────┐     ┌───────────────────────┐     ┌───────────────────────┐
       │      PostgreSQL       │     │   AWS S3 / Supabase   │     │ Notification Services │
       │  (Supabase / Neon)    │     │    Object Storage     │     │ Resend (Email)        │
       │  38 Normalized Tables │     │  Encrypted File Store │     │ Twilio (SMS Alerts)   │
       │  Drizzle ORM Engine   │     │  Attachment Isolation │     │ OpenAI (GPT-4o)       │
       └───────────────────────┘     └───────────────────────┘     └───────────────────────┘
```

---

## 2. Component Breakdown

### Frontend (Next.js 15)
- **Deployment**: Vercel Edge Network
- **Rendering Strategy**: Static Site Generation (SSG) for marketing, demo, and authentication routes; Client-Side Data Fetching for authenticated project workspaces.
- **Routing**: Next.js App Router (`/`, `/demo`, `/login`, `/signup`, `/dashboard`, `/projects`, `/projects/[projectId]`, `/settings`, `/notifications`).
- **State & UI**: React 19, Vanilla CSS design tokens with custom HSL dark mode, accessible modals (`ConfirmModal`), non-blocking toast notifications.

### Backend (Fastify v5)
- **Deployment**: Render or Railway Containerized Node service
- **Framework**: Fastify v5 with native TypeScript support, schema-based serialization, `@fastify/cors`, `@fastify/helmet`, and `@fastify/cookie`.
- **Authentication**: JWT-based session tokens with role claims (`admin`, `developer`, `client`), verified via Fastify pre-handler hooks.
- **Diagnostics**: Unauthenticated `/health` (liveness probe) and `/ready` (database connectivity probe) endpoints for container orchestration.

### Database (PostgreSQL + Drizzle ORM)
- **Engine**: PostgreSQL 15+
- **Schema Management**: Drizzle ORM with declarative schema files in `apps/api/src/db/schema/index.ts`.
- **Migrations**: Automated forward-only migrations via `pnpm --filter @intentflow/api db:migrate`.
- **Tenant Isolation**: Multi-tenant data segregation keyed by `organizationId` and validated against `projectMembers`.

### Storage Subsystem
- **Abstraction Layer**: Multi-provider storage engine (`apps/api/src/services/storage.ts`) supporting:
  1. `s3`: AWS S3 or S3-compatible endpoints (Cloudflare R2, MinIO).
  2. `supabase`: Supabase Storage bucket.
  3. `local`: Local disk fallback strictly restricted to development environments.
- **Security**: Direct file streaming via authorized API routes (`GET /api/attachments/:id/download`) to prevent unauthorized public file leaks.

---

## 3. The AI Intent Workflow Architecture

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 1. CONVERSATION INGESTION                                              │
 │    Client posts message: "Please redesign the mobile checkout button"  │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 2. CONTEXT EXTRACTION & AI PROMPT ASSEMBLY                             │
 │    Assembles thread history, project metadata, and scope constraints    │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 3. LLM PARSING (OpenAI GPT-4o / Heuristic Engine)                      │
 │    - Functional requirements extraction                                │
 │    - Confidence score (0.00 – 1.00)                                   │
 │    - Clarifying questions drafted if ambiguity > threshold             │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 4. DRAFT STATE (Status: 'needs_review')                                │
 │    Stored in DB; completely hidden from execution work board           │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 5. HUMAN-IN-THE-LOOP VERIFICATION                                      │
 │    Developer inspects interpretation, modifies or confirms requirement  │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 6. CONVERTED TO WORK ITEM & DELIVERABLE                                │
 │    Status transitions to 'confirmed' -> Work item created on board      │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Multi-Tenant Authorization & Security Matrix

| User Role | Organizations | Projects | Conversations | Intent Review | Work Management | Deliverables |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Admin** | Full Management, Invitations, Settings | Create, Manage, Delete | Read, Write | Read, Confirm | Create, Assign, Edit | Manage, Signoff |
| **Developer**| View Org Members | Assigned Projects Only | Read, Write | Review, Confirm | Create, Update Status | Draft, Submit |
| **Client** | Read Profile Only | Assigned Projects Only | Read, Write | View Confirmed Only | Read-Only | Review, Approve, Request Revisions |
| **Outsider**| Blocked (403) | Blocked (403) | Blocked (403) | Blocked (403) | Blocked (403) | Blocked (403) |
