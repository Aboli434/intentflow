# IntentFlow

> Web + Mobile collaboration platform for clients and developers.

Natural client communication → IntentFlow interpretation → Developer confirmation → Structured work → Delivery & Approval.

---

## Current Status: Phase 9 — Multi-Channel Team Invitations & Member Management

IntentFlow has completed **Phase 9 — Multi-Channel Team Invitations & Member Management**.
All multi-channel invitation methods (Email & Mobile E.164 format), pluggable delivery service abstractions (`InvitationDeliveryService`), public invitation acceptance flows (`/invite/[token]`), pending invitation management (Resend & Cancel), member role changes, last-admin protection, audit timelines, real-time WebSocket events, web & mobile screens, security/tenant-isolation rules, and 21 end-to-end integration tests are fully implemented and verified.

---

## 🚀 Tech Stack

- **Monorepo**: pnpm Workspaces, Turborepo
- **Web App**: Next.js (App Router), React, TypeScript, Tailwind CSS
- **Mobile App**: Expo, React Native, TypeScript, Expo Router
- **Backend API**: Node.js, Fastify, TypeScript, WebSockets
- **AI Intelligence Layer**: OpenAI GPT-4o integration + Local fallback engine
- **Database**: PostgreSQL, Drizzle ORM, Drizzle Kit
- **Validation**: Zod
- **Code Quality**: Strict TypeScript, ESLint, Prettier

---

## 📁 Repository Structure

```
intentflow/
├── apps/
│   ├── web/          # Next.js web application (Port 3000)
│   ├── mobile/       # Expo React Native mobile application
│   └── api/          # Fastify REST API (Port 4000)
├── packages/
│   ├── types/        # Shared TypeScript domain types (@intentflow/types)
│   ├── validation/   # Shared Zod validation schemas (@intentflow/validation)
│   └── config/       # Shared non-secret configuration constants (@intentflow/config)
├── docs/
│   ├── product/      # Product specifications
│   ├── ux/           # UX design documentation
│   └── architecture/ # Technical architecture guides & Phase 1–9 docs
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

---

## 🛠️ Setup Instructions

### 1. Prerequisites
- Node.js >= 18.0.0
- pnpm >= 8.0.0
- PostgreSQL database running on port 5432

### 2. Installation & Database Migration
```bash
pnpm install
cp .env.example .env
pnpm --filter @intentflow/api db:migrate
```

---

## 💻 Development Commands

Execute from root:

| Command | Action |
|---|---|
| `pnpm dev` | Start web (3000), API (4000), and mobile dev servers |
| `pnpm build` | Build all packages and applications |
| `pnpm lint` | Run ESLint across all apps and packages |
| `pnpm typecheck` | Perform strict TypeScript checks |
| `npx tsx scratch/test-phase9.ts` | Run Phase 9 end-to-end integration test suite |

---

## 🗺️ Roadmap & Implementation Phases

- **Phase 1 — Engineering Foundation** *(Completed)*
- **Phase 2 — Authentication, Organizations & Projects** *(Completed)*
- **Phase 3 — Conversations & Messaging** *(Completed)*
- **Phase 4 — Intent Intelligence & Human Review** *(Completed)*
- **Phase 5 — Confirmed Intent → Structured Work & Execution** *(Completed)*
- **Phase 6 — Notifications, Activity & Progress Intelligence** *(Completed)*
- **Phase 7 — Client Portal, Approvals & Delivery** *(Completed)*
- **Phase 8 — Project Closure, Handoff & Completion** *(Completed)*
- **Phase 9 — Multi-Channel Team Invitations & Member Management** *(Completed)*
