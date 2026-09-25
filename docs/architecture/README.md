# IntentFlow Architecture & Technical Documentation

This document outlines the engineering architecture for **IntentFlow**, a web + mobile collaboration platform for clients and developers.

---

## 1. Monorepo Structure

IntentFlow uses a monorepo powered by **pnpm workspaces** and **Turborepo**.

```
intentflow/
├── apps/
│   ├── web/        # Next.js App Router client web application
│   ├── mobile/     # Expo / React Native mobile client application
│   └── api/        # Fastify Node.js backend API
├── packages/
│   ├── types/      # Shared TypeScript type definitions
│   ├── validation/ # Shared Zod validation schemas
│   └── config/     # Shared non-secret configuration constants
├── docs/
│   ├── product/    # Product requirements and specifications
│   ├── ux/         # User experience design guidelines and flows
│   └── architecture/# Technical architecture documentation (this file)
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.json
├── .gitignore
└── README.md
```

---

## 2. Purpose of Each Application

- **Web Application (`apps/web`)**: Next.js (App Router, Tailwind CSS, TypeScript) web portal for clients and developers.
- **Mobile Application (`apps/mobile`)**: Expo React Native application (Expo Router, TypeScript) offering native iOS and Android experience.
- **Backend API (`apps/api`)**: Fastify Node.js server written in TypeScript. Handles business logic, domain processing, and database interactions.

---

## 3. Purpose of Shared Packages

- **`@intentflow/types` (`packages/types`)**: Centralized repository for shared domain models, status enums, and API response interfaces.
- **`@intentflow/validation` (`packages/validation`)**: Standardized Zod schemas for runtime request/response validation shared between frontend and backend.
- **`@intentflow/config` (`packages/config`)**: Shared non-secret constants (ports, endpoints, app metadata).

---

## 4. API Architecture

The Fastify backend uses a modular domain-driven layout under `apps/api/src/modules/`:

- `auth/` — Authentication & JWT handling
- `users/` — User management
- `organizations/` — Tenant & organization hierarchy
- `projects/` — Project lifecycle management
- `conversations/` — Client-developer natural communication streams
- `messages/` — Granular message records
- `intents/` — AI interpretation layer
- `work/` — Structured work items & tasks
- `reviews/` — Approval & signoff workflows
- `files/` — Document & media storage
- `notifications/` — Real-time & async notifications
- `activity/` — Audit trails & activity logs

The API exposes a health monitoring endpoint at `GET /health`.

---

## 5. Database Setup

- **ORM**: Drizzle ORM
- **Migration Engine**: Drizzle Kit
- **Driver**: Postgres.js (`postgres`)
- **Database**: PostgreSQL

Database connection configuration is defined in `apps/api/src/config/database.ts` and managed via `drizzle.config.ts`. If local PostgreSQL is unavailable during initial boot, health checks gracefully report database status without crashing the API server.

---

## 6. Local Development Commands

Run from project root:

```bash
# Install dependencies
pnpm install

# Start all applications in parallel
pnpm dev

# Build all applications and shared packages
pnpm build

# Lint code across all workspaces
pnpm lint

# Run strict TypeScript type checking
pnpm typecheck
```

---

## 7. Environment Variables

Environment variables are specified in `.env.example` at the root directory:

- `DATABASE_URL`: PostgreSQL connection string.
- `PORT`: API server port (default `4000`).
- `HOST`: Host bind address (default `0.0.0.0`).
- `CORS_ORIGIN`: Allowed origins for CORS (default `*` in dev).
- `NEXT_PUBLIC_API_URL`: Web application target API URL (default `http://localhost:4000`).
- `EXPO_PUBLIC_API_URL`: Mobile application target API URL (default `http://localhost:4000`).

---

## 8. How Web Communicates with API

The Next.js client (`apps/web`) communicates directly with the Fastify backend via HTTP/REST requests.

In Phase 1, `apps/web/src/lib/api-client.ts` executes standard HTTP requests to `GET ${NEXT_PUBLIC_API_URL}/health` to verify server connectivity and displays live connection states (loading, connected, unavailable).

---

## 9. How Mobile Communicates with API

The Expo React Native app (`apps/mobile`) communicates with the API over standard HTTP fetch calls targetting `${EXPO_PUBLIC_API_URL}/health`.

It presents a minimal foundation screen (`apps/mobile/app/index.tsx`) rendering real-time connectivity status.
