# IntentFlow

> **AI-powered B2B client collaboration platform turning unstructured communication into verified, deliverable work.**

```text
Client Communication ──> AI Interpretation ──> Human Verification ──> Confirmed Intent
                                                                           │
Final Approval <── Deliverable Review <── Work Execution & Tracking <──────┘
```

---

## Product Problem
In client service agencies and software consultancies, project scope frequently derails because client feedback is fragmented across unstructured communication channels (emails, chat messages, call notes). Requirements are easily misinterpreted, revisions lack auditability, and developers waste days building out unconfirmed expectations.

## Solution
IntentFlow bridges the gap between client communication and engineering execution:
1. **AI Intent Intelligence**: Extracts concrete requirements, classifications, and confidence ratings from client conversations.
2. **Human-in-the-Loop Verification**: Requires engineering review and confirmation before anything becomes an actionable work item.
3. **Structured Review Portal**: Delivers transparent milestones where clients can approve deliverables or submit structured change requests with clear feedback.

---

## Core Workflow

```text
1. Client Conversation
   └─ Client posts requirements or feedback in the project conversation thread.
2. AI Extraction
   └─ AI parses message intent, suggests scope items, and detects missing details.
3. Developer Review (Human-in-the-Loop)
   └─ Developer reviews, adjusts, or confirms the proposed intent.
4. Work Item Conversion
   └─ Confirmed intents become trackable tasks with assignees and priority.
5. Deliverable Packaging
   └─ Deliverables with attachments are submitted to the client portal.
6. Formal Client Review
   └─ Client approves or requests revisions (enforcing detailed feedback >= 10 chars).
7. Milestone Closure & Handoff
   └─ Formal signoff with completion checklist and audit timeline.
```

---

## Key Features

- **Interactive Demo Gateway (`/demo`)**: One-click login into dedicated personas (**Admin**, **Developer**, **Client**) with pre-seeded projects and workflows.
- **AI Intent Intelligence**: Automated extraction of functional requirements, ambiguity flags, and developer clarification drafts with heuristic fallback.
- **Human Review Safeguard**: Prevents rogue AI changes; all suggested items require developer confirmation.
- **Collaborative Work Board**: Task tracking with statuses (`todo`, `in_progress`, `blocked`, `completed`), priority levels, and audit logs.
- **Deliverables & Approval Portal**: Granular client reviews with formal approval states, change request submission, and attachment management.
- **Real-Time Notifications & Timeline**: In-app notifications and chronologically ordered project activity feed.
- **Multi-Tenant Security**: Role-based access control (RBAC), organization member boundaries, and strict attachment download isolation.
- **Responsive Web Design**: Clean, accessible UX optimized across viewports (320px, 375px, 414px, 768px, 1024px, 1440px).

---

## Architecture

```text
                      ┌──────────────────────┐
                      │    Next.js 15 Web    │
                      │  (Vercel / Frontend) │
                      └──────────┬───────────┘
                                 │
                                 │ HTTPS / WSS
                                 ▼
                      ┌──────────────────────┐
                      │    Fastify REST API  │
                      │  (Render / Railway)  │
                      └──────────┬───────────┘
                                 │
                  ┌──────────────┼──────────────┐
                  ▼              ▼              ▼
             PostgreSQL     Object Store    Email / SMS
             (Drizzle ORM) (S3 / Supabase) (Resend / Twilio)
```

---

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Vanilla CSS & Tailwind CSS tokens
- **Backend API**: Fastify v5, TypeScript, WebSockets
- **Database & ORM**: PostgreSQL, Drizzle ORM (38 tables, type-safe migrations)
- **Mobile**: Expo, React Native, TypeScript
- **Validation**: Zod (@intentflow/validation)
- **AI Engine**: OpenAI GPT-4o integration with deterministic heuristic fallback
- **Storage**: Multi-provider driver supporting AWS S3, Supabase Storage, and local storage
- **Email & SMS**: Resend, SendGrid, Twilio SMS, and development loggers

---

## AI Architecture & Human-in-the-Loop Philosophy

IntentFlow treats AI as an assistant, never as an unsupervised decision maker:
1. **Context Extraction**: Conversations are packaged into clean prompts containing recent thread context and project scope.
2. **Deterministic Extraction**: The LLM extracts requirements with explicit confidence ratings and flags ambiguities.
3. **Draft State**: Extracted requirements are held in `needs_review` state.
4. **Developer Confirmation**: Only after an authorized team member explicitly confirms the item is it promoted to `confirmed` and converted into actionable work.
5. **Fallback Safety**: If AI services are unreachable, a deterministic heuristic engine extracts requirements from structured messages to prevent pipeline interruption.

---

## Security & Tenant Isolation

- **Role-Based Access Control (RBAC)**: Strict role hierarchy (Admin, Developer, Client) enforced on all Fastify route handlers.
- **Organization & Project Boundaries**: All queries enforce organization and project membership checks. Cross-tenant access attempts return `403 Forbidden`.
- **Attachment Download Protection**: File downloads require authorized project membership and tenant verification.
- **Safe Environment Guardrails**: Production environment fails fast if default JWT secrets, wildcard CORS, or local storage drivers are detected.
- **Sanitized Error Handling**: Server errors return standard JSON responses without leaking SQL queries or internal stack traces.

---

## Interactive Demo

To test IntentFlow immediately:
1. Start the application locally or navigate to the deployed URL.
2. Visit `/demo`.
3. Select any persona card:
   - **Admin**: Explore organization settings, team invitations, and company-wide analytics.
   - **Developer**: Review AI-generated intents, manage work items, and submit deliverables.
   - **Client**: Engage in conversations, review deliverables, request revisions, and issue final approvals.

---

## Local Development

### Prerequisites
- Node.js 18+
- pnpm 10+
- PostgreSQL database instance

### Quickstart

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Aboli434/intentflow.git
   cd intentflow
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Configure Environment:**
   Create `.env` in the root directory (refer to [docs/deployment/production-environment.md](docs/deployment/production-environment.md)):
   ```env
   NODE_ENV=development
   PORT=4000
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/intentflow_db
   JWT_SECRET=development_secret_key_intentflow
   CORS_ORIGIN=http://localhost:3000
   NEXT_PUBLIC_API_URL=http://localhost:4000
   ```

4. **Run Migrations & Seed Demo Data:**
   ```bash
   pnpm --filter @intentflow/api db:migrate
   pnpm --filter @intentflow/api db:seed
   ```

5. **Start Development Servers:**
   ```bash
   # Starts both Web (port 3000) and API (port 4000)
   pnpm dev
   ```

---

## Environment Variables

| Variable | Scope | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Web | Base URL of the Fastify API (e.g. `https://api.intentflow.io`) |
| `NEXT_PUBLIC_WS_URL` | Web | WebSocket URL for real-time updates |
| `NODE_ENV` | API | Application mode (`development`, `test`, `production`) |
| `PORT` | API | Port for API server (default `4000`) |
| `DATABASE_URL` | API | PostgreSQL connection string |
| `JWT_SECRET` | API | Secret key used for signing session JWT tokens |
| `CORS_ORIGIN` | API | Allowed frontend origin URL (e.g. `https://intentflow.io`) |
| `STORAGE_PROVIDER` | API | Object storage driver (`local`, `s3`, `supabase`) |
| `EMAIL_PROVIDER` | API | Notification provider (`resend`, `sendgrid`, `smtp`, `development`) |
| `SMS_PROVIDER` | API | SMS provider (`twilio`, `development`) |

See [docs/deployment/production-environment.md](docs/deployment/production-environment.md) for full configuration specs.

---

## Testing & Quality Assurance

IntentFlow includes automated integration, browser, and multi-viewport regression test suites:

```bash
# Typecheck entire monorepo
pnpm typecheck

# Lint all packages
pnpm lint

# Production build check (Static prerender & routes compilation)
pnpm build

# Run Phase 23 E2E Integration Suite
npx tsx scratch/test-phase23.ts

# Run Multi-Viewport Browser Verification (320px–1440px)
npx tsx scratch/test-phase23-browser.ts
```

---

## Deployment

- **Web (Next.js)**: Optimized for deployment on **Vercel**. Build command: `pnpm build`, Output: `.next`.
- **API (Fastify)**: Deployable as a Docker container or Node.js service on **Render**, **Railway**, or AWS ECS.
- **Database**: Managed PostgreSQL on **Supabase**, **Neon**, or AWS RDS.
- **Storage**: Amazon S3 bucket or Supabase Storage bucket.

See detailed instructions in [docs/deployment/production-deployment.md](docs/deployment/production-deployment.md).

---

## Project Structure

```
intentflow/
├── apps/
│   ├── web/          # Next.js 15 frontend application
│   ├── api/          # Fastify v5 backend service
│   └── mobile/       # React Native Expo mobile application
├── packages/
│   ├── types/        # Shared TypeScript domain contracts
│   ├── validation/   # Shared Zod validation schemas
│   └── config/       # Shared non-secret configuration constants
├── docs/
│   ├── architecture/ # Architecture diagrams & technical decision records
│   ├── deployment/   # Environment specs, deployment checklists, and guides
│   ├── portfolio/    # Case study and design breakdown
│   └── qa/           # Route matrix, audit logs, and test execution reports
└── scratch/          # Automated regression & multi-viewport browser test suites
```

---

## Engineering Highlights

1. **Deterministic Idempotent Seeding**: The test dataset (`Nexus Digital Agency`) can be seeded repeatedly without creating duplicate rows or foreign-key conflicts.
2. **Strict Validation at Both Tiers**: Client forms provide instantaneous user feedback (e.g., character counters for review comments), while Fastify endpoints enforce server-side Zod validation.
3. **No Native Alert Disruptions**: Audited interactive controls utilize accessible custom modals (`ConfirmModal`) with Esc keyboard dismiss and body scroll locking.
4. **Resilient Static Prerendering**: Production builds compile all public and auth routes with isolated SSR dependencies to avoid bundling issues.

---

## Future Improvements

- Granular role permission customization per organization.
- Integration with external issue trackers (GitHub Issues, Jira).
- Audio transcription for meeting notes into automated intent drafts.
