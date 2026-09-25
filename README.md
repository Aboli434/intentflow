# IntentFlow

> Web + Mobile collaboration platform for clients and developers.

Natural client communication → IntentFlow interpretation → Developer confirmation → Structured work → Delivery & Approval.

---

## Current Status: Phase 2 — Authentication, Organizations & Projects

IntentFlow has completed **Phase 2 — Authentication, Organizations & Projects**.
All user authentication, organization management, invitation flows, project scoping, and role authorization are fully persisted to PostgreSQL via Drizzle ORM.

---

## 🚀 Tech Stack

- **Monorepo**: pnpm Workspaces, Turborepo
- **Web App**: Next.js (App Router), React, TypeScript, Tailwind CSS
- **Mobile App**: Expo, React Native, TypeScript, Expo Router
- **Backend API**: Node.js, Fastify, TypeScript
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
│   └── architecture/ # Technical architecture guides & Phase 2 docs
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

---

## 🗺️ Roadmap & Implementation Phases

- **Phase 1 — Engineering Foundation** *(Completed)*
- **Phase 2 — Authentication, Organizations & Projects** *(Completed)*
- **Phase 3 — Conversations & Messaging** *(Next)*
- **Phase 4 — Structured Work & Review Pipelines**
- **Phase 5 — Full Polish, Notifications & Analytics**
