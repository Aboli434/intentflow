# IntentFlow

> **IntentFlow turns messy client communication into structured, verified work.**

```text
Communication ──> AI Interpretation ──> Human Verification ──> Structured Intent
                                                                        │
Handoff <── Completion <── Deliverable Review <── Work Execution <──────┘
```

---

## Current Status: Phase 20 — Real Deployment, Demo Experience & Final Product Polish

IntentFlow has completed **Phase 20 — Real Deployment, Demo Experience & Final Product Polish**.
The platform is fully deployable, observable, hardened, and portfolio-demo ready.

### 🌟 Key Features & Architecture
- **Interactive Portfolio Demo Portal (`/demo`)**: One-click role-based login cards (*Client*, *Developer*, *Admin*) for interactive product demonstrations.
- **Idempotent Demo Database Seed (`pnpm db:seed`)**: Deterministic database seeding for *"Nexus Digital Agency"* featuring real-world conversations, AI intents, kanban work items, and deliverable review flows.
- **AI Intent Intelligence**: Automated message parsing, intent extraction, requirement confidence scoring, missing question detection, and developer clarification drafting.
- **Human Review & Traceability**: Developer confirmation/rejection workflow, version history snapshots, and source message traceability mappings.
- **Structured Work & Execution**: Confirmed intents auto-generate work items with assignees, priority levels, kanban status transitions, and audit logs.
- **Deliverables & Client Approval**: Milestone deliverables, client review flows (`Approve` / `Request Changes`), revision requests, and closure handoffs.
- **Production Infrastructure**: Drizzle ORM SQL database migrations (`pnpm db:migrate`), multi-provider object storage (`S3` / `Supabase`), multi-channel notifications (`Resend` / `SendGrid` / `Twilio SMS`), unauthenticated `/health` & `/ready` diagnostic probes, and structured production logging.
- **Multi-Tenant Security & Isolation**: Strict role-based authorization (Admin, Developer, Client), project membership checks, non-leaking error handlers, and 25MB attachment guards.

---

## 🚀 Tech Stack

- **Monorepo**: pnpm Workspaces, Turborepo
- **Web App**: Next.js 15 (App Router), React, TypeScript, Vanilla CSS (Dark SaaS Theme)
- **Mobile App**: Expo, React Native, TypeScript, Expo Router
- **Backend API**: Fastify, TypeScript, WebSockets
- **AI Intelligence Layer**: OpenAI GPT-4o integration + Local fallback engine
- **Database & Storage**: PostgreSQL, Drizzle ORM, S3 / Supabase Storage
- **Validation & Security**: Zod, Helmet, Signed Cookies, CORS Origin Guards

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
│   ├── architecture/ # Technical architecture guides & Phase 1–20 decision records
│   ├── deployment/   # Production deployment & environment reference guides
│   ├── security/     # Production security audit reports
│   └── qa/           # Smoke test reports & launch checklists
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## 🛠️ Setup Instructions

### 1. Prerequisites
- Node.js >= 18.0.0
- pnpm >= 8.0.0
- PostgreSQL database running on port 5432

### 2. Installation & Database Setup
```bash
pnpm install
cp .env.example .env
pnpm --filter @intentflow/api db:migrate
pnpm db:seed
```

---

## 💻 Development Commands

| Command | Action |
|---|---|
| `pnpm dev` | Start web (3000), API (4000), and mobile dev servers |
| `pnpm build` | Build all packages and applications for production |
| `pnpm lint` | Run ESLint across all apps and workspace packages |
| `pnpm typecheck` | Perform strict TypeScript type checking |
| `pnpm db:seed` | Seed deterministic portfolio demo data (Idempotent) |
| `npx tsx scratch/test-phase20.ts` | Run Phase 20 final launch verification suite |

---

## 🧪 Automated Verification Status

```text
Phase 16 Integration Suite:  19 / 19 PASS (100%)
Phase 17 Integration Suite:  19 / 19 PASS (100%)
Phase 18 Launch Suite:       15 / 15 PASS (100%)
Phase 19 Verification Suite: 18 / 18 PASS (100%)
Phase 20 Final Launch Suite: 20 / 20 PASS (100%)

Monorepo Typecheck: PASS (0 Errors across 6 packages)
Monorepo Linting:   PASS (0 Errors across 6 packages)
Production Build:   PASS (0 Errors across 6 packages)
Mobile App Check:   PASS (0 Errors in apps/mobile)
```


