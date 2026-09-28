# IntentFlow Phase 17 — Production Readiness QA & Verification Checklist

## 1. Environment & Configuration Audit
- [x] `.env.example` updated with complete Email, SMS, Storage, and Base URL keys.
- [x] Zod environment schema (`apps/api/src/config/env.ts`) parses optional production keys safely.
- [x] Startup logger (`validateProductionEnvStatus`) logs active storage provider and production gateways on server boot.
- [x] Local development works seamlessly without requiring live third-party credentials.

---

## 2. Multi-Channel Invitation Delivery Flow
- [x] Email invitation provider supports Resend, SendGrid, custom SMTP, and local development HTML template logger.
- [x] SMS invitation provider supports Twilio with international E.164 phone normalization (`normalizePhoneNumber`).
- [x] Duplicate active pending invitation check returns `409 DUPLICATE_INVITATION`.
- [x] Expired invitation acceptance returns human-readable `410 EXPIRED` error banner.
- [x] Resend invitation endpoint (`/resend`) regenerates token, resets expiration timer, and dispatches new message.
- [x] Cancellation endpoint (`/cancel`) updates status to `'cancelled'`.
- [x] Public invite acceptance page (`/invite/[token]`) displays role, inviter, contact details, and acceptance CTAs without exposing raw tokens.

---

## 3. Storage Abstraction & Attachment Security
- [x] `StorageService` dynamically selects `LocalStorageProvider`, `S3StorageProvider`, or `SupabaseStorageProvider` based on `STORAGE_PROVIDER`.
- [x] File upload validates 25MB max size limit and rejects forbidden executable extensions (`.exe`, `.sh`, `.bat`, etc.).
- [x] Filenames sanitized using `sanitizeFileName()` to prevent path traversal characters.
- [x] Attachment download streams file content after enforcing strict project membership and organization tenant isolation.
- [x] Cross-tenant access attempt returns `403 Forbidden`.
- [x] Reusable `AttachmentList` UI primitive created in `apps/web/src/components/ui/AttachmentList.tsx`.

---

## 4. Conversations & Real-Time Reliability
- [x] `connectConversationWebSocket` maintains single connection per workspace with connection state badges (`connecting`, `connected`, `reconnecting`, `offline`).
- [x] Listener cleanup on component unmount prevents socket memory leaks.
- [x] Exponential backoff reconnects automatically up to 6 retries with REST HTTP fallback.
- [x] Mobile thread switcher (`showMobileChat`) allows seamless navigation between thread list and active chat pane.
- [x] Keyboard-safe composer height prevents layout clipping on mobile viewports.

---

## 5. Viewport & Mobile Responsiveness Audit
- [x] **320px / 360px / 375px / 390px / 414px (Mobile)**: Tested with card reflow, scrollable tab bars, minimum 44px touch targets, and 0 horizontal page overflow.
- [x] **768px (Tablet)**: Balanced two-column grid layouts with collapsable drawer panels.
- [x] **1024px / 1280px / 1440px (Desktop)**: Unified dark SaaS visual theme (`#0B0F19` background, `#111827` primary surface, `#6366F1` indigo accent) with high-density workspace overview cards.

---

## 6. Verification Commands Log
- [x] `npx tsx scratch/test-phase17.ts` — **19 / 19 Tests PASSED (100%)**
- [x] `npx tsx scratch/test-phase16.ts` — **19 / 19 Tests PASSED (100%)**
- [x] `pnpm typecheck` — **0 Errors across 9 Turbo tasks**
- [x] `pnpm lint` — **0 Errors**
- [x] `pnpm build` — **All Turbo build tasks completed successfully**
