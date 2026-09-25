# IntentFlow

> Web + Mobile collaboration platform for clients and developers.

Natural client communication → IntentFlow interpretation → Developer confirmation → Structured work → Delivery & Approval.

---

## Current Status: Phase 1 — Engineering Foundation

IntentFlow is currently in **Phase 1 — Engineering Foundation**. 
This phase focuses exclusively on establishing a clean, production-ready monorepo foundation, establishing cross-app communication, and setting up strict code quality tooling.

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
│   ├── types/        # Shared TypeScript domain types
│   ├── validation/   # Shared Zod validation schemas
│   └── config/       # Shared non-secret configuration constants
├── docs/
│   ├── product/      # Product specifications
│   ├── ux/           # UX design documentation
│   └── architecture/ # Technical architecture guides
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

### 2. Installation
```bash
pnpm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env` if custom database or port configuration is required:
```bash
cp .env.example .env
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

## 🔗 Endpoints & Verification

- **API Health Check**: `GET http://localhost:4000/health`
- **Web Verification Screen**: `http://localhost:3000` (verifies API connection)
- **Mobile Verification Screen**: Run `pnpm --filter @intentflow/mobile dev`

---

## 🗺️ Roadmap & Implementation Phases

- **Phase 1 — Engineering Foundation** *(Current)*
- **Phase 2 — Authentication, Organizations & Projects**
- **Phase 3 — Natural Communication & Intent Engine**
- **Phase 4 — Structured Work & Review Pipelines**
- **Phase 5 — Full Polish, Notifications & Analytics**
