# Phase 20 Production Readiness & Launch Checklist

## Operational Readiness Gates

- [x] **Monorepo Type Check**: `pnpm typecheck` PASS (0 Errors across 6 workspace packages)
- [x] **Monorepo Linting**: `pnpm lint` PASS (0 Errors across 6 workspace packages)
- [x] **Monorepo Production Build**: `pnpm build` PASS (0 Errors, production Next.js & Fastify bundles compiled)
- [x] **Idempotent Demo Database Seeding**: `pnpm db:seed` PASS (Zero duplicate keys on re-execution)
- [x] **Phase 16 Verification Suite**: `npx tsx scratch/test-phase16.ts` (19/19 PASS)
- [x] **Phase 17 Verification Suite**: `npx tsx scratch/test-phase17.ts` (19/19 PASS)
- [x] **Phase 18 Production Suite**: `npx tsx scratch/test-phase18.ts` (15/15 PASS)
- [x] **Phase 19 Verification Suite**: `npx tsx scratch/test-phase19.ts` (18/18 PASS)
- [x] **Phase 20 Launch Suite**: `npx tsx scratch/test-phase20.ts` (20/20 PASS)

---

## Pre-Flight Checklist Before Public Launch

1. **Provision Production Database**: Deploy high-availability PostgreSQL instance.
2. **Apply Database Migrations**: Execute `pnpm --filter @intentflow/api db:migrate`.
3. **Execute Seed Script**: Run `pnpm db:seed` to initialize the "Nexus Digital Agency" portfolio demo workspace.
4. **Deploy Backend API**: Deploy `apps/api` to Render/Railway. Set environment secrets (`NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `STORAGE_PROVIDER`, `EMAIL_PROVIDER`, `SMS_PROVIDER`).
5. **Deploy Frontend Client**: Deploy `apps/web` to Vercel. Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL`.
6. **Verify Probes**: Perform HTTP requests to `GET /health` and `GET /ready`.
7. **Perform Interactive Demo Check**: Access `/demo` and test role-based logins for Client, Developer, and Admin.
