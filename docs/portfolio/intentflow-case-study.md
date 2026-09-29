# IntentFlow — Portfolio Case Study

## Project Overview
- **Product**: IntentFlow — AI-Powered B2B Client Collaboration Platform
- **Role**: Full-Stack Architecture, Design, Implementation & End-to-End QA
- **Stack**: Next.js 15, React 19, TypeScript, Fastify v5, PostgreSQL, Drizzle ORM, WebSockets, Tailwind CSS tokens

---

## 1. The Core Problem
In digital agencies, software development shops, and client services, scope creep and miscommunication are endemic:
- Client requirements often arrive in unstructured, conversational fragments across emails, chat messages, and informal calls.
- Developers either guess intentions or lose hours manually distilling conversation logs into tickets.
- Misaligned deliverables lead to endless revision rounds, frustrated clients, and unbilled developer hours.

---

## 2. Product Solution & Innovation
IntentFlow solves this by treating unstructured conversation as the primary input stream for structured engineering work:
1. **Intelligent Ingestion**: AI listens to client conversations, extracting discrete requirements, identifying ambiguities, and assessing confidence.
2. **Human-in-the-Loop Gate**: AI outputs are never directly converted into production commitments. Developers review, edit, or reject AI proposals in a dedicated review drawer.
3. **Formal Deliverable Portal**: Once work is completed, deliverables are packaged and presented in an interactive portal where clients can approve with one click or request revisions with structured feedback.

---

## 3. Key Engineering Challenges & Solutions

### A. Multi-Tenant Isolation & Role Hierarchy
- **Challenge**: Enabling multiple organizations and clients to collaborate on shared projects without cross-tenant data leaks.
- **Solution**: Developed a multi-tiered authorization middleware in Fastify. Every database query checks organization membership and project assignment. Cross-tenant access attempts are rejected with `403 Forbidden` before database execution.

### B. Safe Human-in-the-Loop AI Architecture
- **Challenge**: LLMs can hallucinate requirements or misinterpret sarcastic client feedback.
- **Solution**: Enforced a state machine where AI proposals enter a `needs_review` state with source message traceability. A developer must explicitly click **Confirm Intent** to unlock work item creation. If the AI engine is unreachable, a deterministic heuristic parser serves as a zero-downtime fallback.

### C. Seamless Multi-Viewport SaaS UX
- **Challenge**: Complex desktop dashboards with kanban boards, split conversation threads, and modal workflows frequently break on small mobile viewports.
- **Solution**: Designed mobile-first layouts with accessible touch targets (>= 44px), body scroll locks on open dialogs, and adaptive single-column views for 320px–414px mobile devices.

### D. Production Deployment Hardening
- **Challenge**: Preventing accidental development defaults (e.g. default JWT keys, wildcard CORS, local storage) from slipping into production.
- **Solution**: Built a fail-fast environment validator that aborts the server startup if production safety invariants are violated.

---

## 4. Technical Architecture Highlights
- **Fastify v5 Microservice**: Ultra-fast REST and WebSocket server with schema-based JSON serialization.
- **PostgreSQL with Drizzle ORM**: 38 normalized relational tables providing type-safe queries and idempotent demo data seeding.
- **Next.js 15 App Router**: Static generation for high-speed marketing/auth pages combined with client-side data fetching for dynamic project workspaces.

---

## 5. Outcome & Verification
- **100% Automated Test Pass Rate**: 178 checks passed across integration, multi-viewport browser, and regression suites.
- **Zero Prerender Failures**: Clean Next.js static compilation across all routes.
- **Zero Unpolished Native Dialogs**: Full modal and toast-driven user feedback loops.
