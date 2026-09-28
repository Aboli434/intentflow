# IntentFlow Production Deployment Guide

This guide provides step-by-step instructions for deploying the **IntentFlow** web client, Fastify API, PostgreSQL database, and object storage in a production environment.

---

## Architecture Overview

```
                                  +-------------------+
                                  |   Vercel (Web)    |
                                  | Next.js App Client|
                                  +---------+---------+
                                            |
                                 HTTPS / WebSocket
                                            |
                                            v
+-----------------------+         +-------------------+         +-----------------------+
|  Resend / SendGrid    | <-------|   Render (API)    | ------->|   AWS S3 / Supabase   |
|  Transactional Email  |         | Node.js / Fastify |         |    Object Storage     |
+-----------------------+         +---------+---------+         +-----------------------+
                                            |
                                      PostgreSQL DDL
                                            |
                                            v
                                  +-------------------+
                                  | Neon / Supabase DB|
                                  |    PostgreSQL     |
                                  +-------------------+
```

---

## Step 1: Provision Production PostgreSQL Database
1. Provision a managed PostgreSQL instance (e.g. Neon, AWS RDS, Supabase PostgreSQL, or Render PostgreSQL).
2. Obtain your production database connection string (`postgresql://<user>:<password>@<host>:5432/<dbname>?sslmode=require`).

---

## Step 2: Configure Environment Variables
Create production environment configurations for the API server and Web application.

### API Environment (`apps/api/.env`)
```env
NODE_ENV=production
PORT=4000
HOST=0.0.0.0
CORS_ORIGIN=https://app.intentflow.io
DATABASE_URL=postgresql://user:password@prod-db-host:5432/intentflow_db?sslmode=require
JWT_SECRET=prod_super_secure_jwt_secret_token_key_2026_x99
FRONTEND_URL=https://app.intentflow.io
API_BASE_URL=https://api.intentflow.io

EMAIL_PROVIDER=resend
RESEND_API_KEY=re_prod_123456789
EMAIL_FROM=IntentFlow <no-reply@intentflow.io>

SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=AC_prod_account_sid
TWILIO_AUTH_TOKEN=prod_auth_token
TWILIO_PHONE_NUMBER=+15005550006

STORAGE_PROVIDER=s3
S3_BUCKET=prod-intentflow-attachments
S3_REGION=us-east-1
S3_ACCESS_KEY=prod_aws_access_key
S3_SECRET_KEY=prod_aws_secret_key
```

### Web Environment (`apps/web/.env.production`)
```env
NEXT_PUBLIC_API_URL=https://api.intentflow.io
NEXT_PUBLIC_WS_URL=wss://api.intentflow.io
```

---

## Step 3: Database Migrations
Before launching the API service, execute production database migrations using Drizzle ORM:

```bash
pnpm --filter @intentflow/api db:migrate
```

Alternatively, the Fastify API automatically executes `runDatabaseMigrations()` on initial boot.

---

## Step 4: Deploy API Service (Render / AWS ECS / Railway)
1. **Build Command**: `pnpm --filter @intentflow/api build`
2. **Start Command**: `pnpm --filter @intentflow/api start`
3. **Health Check Endpoint**: `/health` (Liveness)
4. **Readiness Endpoint**: `/ready` (Dependency Readiness)

---

## Step 5: Deploy Web Client (Vercel)
1. Connect repository to Vercel.
2. Set Root Directory to `apps/web`.
3. Set Framework Preset to **Next.js**.
4. Configure environment variables: `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL`.
5. Deploy client application.

---

## Step 6: Post-Deployment Smoke Verification
Run automated readiness checks:
```bash
# Verify API Liveness
curl https://api.intentflow.io/health

# Verify Dependency Readiness
curl https://api.intentflow.io/ready
```
Expected `/ready` output:
```json
{
  "ready": true,
  "service": "intentflow-api",
  "database": "connected",
  "storage": "s3",
  "email": "resend",
  "sms": "twilio",
  "timestamp": "2026-09-28T11:00:00.000Z"
}
```
