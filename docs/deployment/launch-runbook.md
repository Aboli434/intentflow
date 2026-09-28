# IntentFlow Production Launch Runbook

This document provides exact, copy-pasteable CLI commands to execute the complete deployment, migration, demo seeding, and smoke testing pipeline for IntentFlow.

---

## 1. Dependencies & Monorepo Build Setup

```bash
# Install exact locked dependencies
pnpm install --frozen-lockfile

# Validate TypeScript type compliance across all packages
pnpm typecheck

# Validate code formatting & linting rules
pnpm lint

# Build production bundles across apps/web, apps/api, and workspace packages
pnpm build
```

---

## 2. Production Database Migration & Demo Seeding

```bash
# Run Drizzle SQL schema migrations against target DATABASE_URL
pnpm --filter @intentflow/api db:migrate

# Check migration status & audit schema consistency
pnpm --filter @intentflow/api db:check

# (Optional) Seed deterministic portfolio demo data ("Nexus Digital Agency")
pnpm db:seed
```

---

## 3. Backend API Startup & Health Probes (`apps/api`)

```bash
# Start production API server (Port 4000 or PORT env)
pnpm --filter @intentflow/api start

# Liveness Probe (HTTP 200 OK)
curl -i http://localhost:4000/health

# Readiness Probe (HTTP 200 OK, PostgreSQL Connected)
curl -i http://localhost:4000/ready
```

---

## 4. Web Application Startup (`apps/web`)

```bash
# Start production web client (Port 3000)
pnpm --filter @intentflow/web start
```

---

## 5. Automated Verification & Smoke Testing

```bash
# Execute Phase 20 Launch & Demo Verification Suite
npx tsx scratch/test-phase20.ts

# Execute Full Historical Regression Verification Suites
npx tsx scratch/test-phase16.ts
npx tsx scratch/test-phase17.ts
npx tsx scratch/test-phase18.ts
npx tsx scratch/test-phase19.ts
```
