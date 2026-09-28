# IntentFlow Production Launch Checklist

Follow this concise, step-by-step checklist to deploy IntentFlow to production.

---

## 1. Database & Infrastructure Provisioning
- [ ] **Provision PostgreSQL Database**: Deploy a managed PostgreSQL instance (Supabase, AWS RDS, or Render Postgres).
- [ ] **Run Database Migrations**: Execute `pnpm db:migrate` against target `DATABASE_URL`.
- [ ] **Audit Migration Status**: Verify zero schema drifts with `pnpm db:check`.
- [ ] **Provision Object Storage**: Create an S3 bucket or Supabase Storage bucket (`intentflow-attachments`).

---

## 2. Environment Variables Configuration

### Backend API (`apps/api`)
- [ ] `NODE_ENV=production`
- [ ] `PORT=4000`
- [ ] `DATABASE_URL` (PostgreSQL connection URI with SSL)
- [ ] `JWT_SECRET` (Strong cryptographic random string)
- [ ] `CORS_ORIGIN` (Production web app domain, e.g. `https://intentflow.app`)
- [ ] `EMAIL_PROVIDER=resend` (or `sendgrid` / `smtp`)
- [ ] `RESEND_API_KEY`
- [ ] `SMS_PROVIDER=twilio`
- [ ] `TWILIO_ACCOUNT_SID`
- [ ] `TWILIO_AUTH_TOKEN`
- [ ] `TWILIO_PHONE_NUMBER`
- [ ] `STORAGE_PROVIDER=s3` (or `supabase`)
- [ ] `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`

### Web Client (`apps/web`)
- [ ] `NEXT_PUBLIC_API_URL` (e.g. `https://api.intentflow.app`)
- [ ] `NEXT_PUBLIC_WS_URL` (e.g. `wss://api.intentflow.app`)

---

## 3. Platform Deployments

### Backend Deployment (Render / Railway)
- [ ] Build Command: `pnpm run build`
- [ ] Start Command: `pnpm run start`
- [ ] Liveness Check: `GET /health`
- [ ] Readiness Check: `GET /ready`

### Frontend Deployment (Vercel)
- [ ] Build Command: `pnpm run build`
- [ ] Output Directory: Next.js default (`.next`)
- [ ] Root Directory: `./` (Monorepo root, package scope `@intentflow/web`)

---

## 4. Post-Deployment Verification
- [ ] **Liveness Verification**: Confirm `GET https://api.intentflow.app/health` returns `status: "ok"`.
- [ ] **Readiness Verification**: Confirm `GET https://api.intentflow.app/ready` returns `ready: true` and `database: "connected"`.
- [ ] **User Registration**: Register test admin user on web UI.
- [ ] **Organization & Project**: Create workspace organization and assigned project.
- [ ] **Multi-Channel Invitations**: Send test email/SMS invitation and accept.
- [ ] **File Security**: Upload attachment and verify unauthorized download returns HTTP 403.
