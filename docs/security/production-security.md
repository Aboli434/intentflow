# IntentFlow Production Security Specification

This document details the security architecture, authorization enforcement, token handling, and multi-tenant isolation mechanisms implemented in **IntentFlow**.

---

## 1. Multi-Tenant Isolation & Organization Scoping
- **Tenant Scope Enforcement**: Every database query touching project resources, messages, work items, or deliverables joins `organization_id` and evaluates user membership.
- **Cross-Organization Access Prevention**: If a user attempts to fetch or mutate a resource belonging to an organization where they are not a member, the API rejects the request with `403 Forbidden`.
- **Direct Object Access Guard**: Attachment streaming (`GET /api/attachments/:id/download`) re-verifies project authorization and organization tenant boundaries before writing byte chunks to the response.

---

## 2. Role-Based Access Control (RBAC) Architecture
- **Organization Roles**:
  - `Admin`: Full workspace management, member management, invitation resend/cancellation, role updates.
  - `Developer`: Project execution, intent review, technical discussions.
  - `Client`: Deliverable review, approval, change requests, project closure review & handoff acknowledgement.
  - `Viewer`: Read-only access across authorized surfaces.
- **Policy Engine (`enforcePolicy`)**: Evaluated server-side on every Fastify route handler. Frontend visibility never replaces server-side authorization enforcement.

---

## 3. Token & Secret Privacy
- **Invitation Tokens**:
  - Generated via `crypto.randomBytes(32).toString('hex')`.
  - Tokens are never exposed in public API response logs, member rosters, or WebSocket broadcasts.
  - Expire after 7 days; single-use acceptance flow updates status to `'accepted'`.
- **Structured Logging Privacy**:
  - Server logs strip sensitive fields (`password`, `token`, `secret`, `apiKey`, `authorization`).

---

## 4. File Storage & Upload Security
- **Path Traversal Protection**: All uploaded filenames are sanitized via `sanitizeFileName()` (`replace(/[^a-zA-Z0-9_.-]/g, '_')`).
- **Executable Format Guard**: Rejects dangerous extensions (`.exe`, `.sh`, `.bat`, `.cmd`, `.dll`, `.scr`, `.msi`, `.vbs`).
- **Size Limitation**: Strictly enforces 25MB maximum per file buffer.

---

## 5. Network & Transport Security
- **CORS Configuration**: Production mode enforces strict domain origin validation (`CORS_ORIGIN`). Wildcards (`*`) are prohibited when credentials are true.
- **Security Headers**: Fastify Helmet configures strict transport security (`HSTS`), clickjacking protection (`X-Frame-Options`), and MIME sniffing guards (`X-Content-Type-Options`).
- **WebSocket Session Verification**: WebSocket connections authenticate token validity (`gte(sessions.expiresAt, new Date())`) and project membership prior to socket registration.
