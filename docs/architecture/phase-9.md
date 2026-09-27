# Phase 9 — Multi-Channel Team Invitations & Member Management

## 1. Overview & Architecture

Phase 9 upgrades Organization Settings into a comprehensive **Team Management system**. Organization admins can invite new members via **Email** or **Mobile Number (SMS)** with E.164-standard phone number normalization (defaulting to India `+91`).

The invitation lifecycle is decoupled from external delivery channels via a **Delivery Provider Abstraction** (`InvitationDeliveryService`). Stubs for `EmailInvitationProvider` and `SmsInvitationProvider` log queue events safely without leaking sensitive tokens into production logs.

---

## 2. Key Components

### 2.1 Database Schema (`organization_invitations`)
- `id`: UUID primary key
- `organization_id`: Target organization reference
- `email`: Nullable email string
- `phone`: Nullable normalized E.164 phone string
- `invitation_method`: `'email' | 'sms'`
- `role`: `'client' | 'developer' | 'admin'`
- `token`: 64-character hex cryptographically secure token
- `invited_by`: User ID of issuing admin
- `status`: `'pending' | 'accepted' | 'expired' | 'cancelled'`
- `expires_at`: Expiration timestamp (Default: 7 days)
- `accepted_at`: Acceptance timestamp
- `created_at` / `updated_at`: Audit timestamps

### 2.2 Domain & Validation
- `@intentflow/types`: Policy actions (`org:invitation_view`, `org:invitation_create`, `org:invitation_cancel`, `org:invitation_resend`, `org:member_remove`, `org:member_edit`), WebSocket events, Notification types.
- `@intentflow/validation`: `createInvitationSchema` (multi-channel refine validation with E.164 phone rules), `updateMemberRoleSchema`.

### 2.3 Delivery Provider Abstraction
- `InvitationDeliveryProvider` interface:
  ```ts
  interface InvitationDeliveryProvider {
    sendInvitation(input: {
      destination: string;
      invitationUrl: string;
      organizationName: string;
      role: string;
    }): Promise<void>;
  }
  ```
- Pluggable stubs (`EmailInvitationProvider` & `SmsInvitationProvider`) log queues without token exposure.

### 2.4 API Routes
- `POST /api/organizations/:organizationId/invitations`: Create multi-channel invitation (Admin only).
- `GET /api/organizations/:organizationId/invitations`: List pending invitations (Admin only).
- `GET /api/invitations/:token`: Public preview of invitation details.
- `POST /api/invitations/:token/accept`: Accept invitation and create organization membership.
- `POST /api/organization-invitations/:invitationId/cancel`: Cancel invitation (Admin only).
- `POST /api/organization-invitations/:invitationId/resend`: Resend invitation with renewed token & 7-day extended expiry (Admin only).
- `PATCH /api/organizations/:organizationId/members/:memberId`: Update member role (Admin only, last-admin protected).
- `DELETE /api/organizations/:organizationId/members/:memberId`: Remove member (Admin only, last-admin protected).

---

## 3. Web & Mobile Applications

### Web Application (`/settings` & `/invite/[token]`)
- **Settings Page (`/settings`)**: Rebuilt Team Management layout with tabs/segmented control for Email and Mobile invitations, role selector with descriptions, pending invitations list with mask formatting for phone numbers (`+91 ••••••3210`), Resend/Cancel actions, and Member Role management.
- **Invitation Acceptance (`/invite/[token]`)**: Dedicated flow displaying organization name, invited contact, assigned role, and single-click acceptance. Redirects unauthenticated users to create account/sign-in.

### Mobile Application (`/settings`)
- Updated Organization Settings & Team Management UI with channel toggle, phone format validation, pending invitation management, role change modal, and remove member actions.

---

## 4. Security & Tenant Isolation

- **Admin-Only Permissions**: Enforced via centralized policy evaluation engine (`permissions.ts`) for all invitation creation, cancellation, resending, role modification, and member removal.
- **Last Admin Protection**: Prevents removing or downgrading the final admin of an organization.
- **Token Security**: 64-character hex tokens are never returned in public invitation creation responses, member lists, or logs.
- **Tenant Isolation**: Cross-organization invitation operations or membership management are denied with `403 Forbidden`.

---

## 5. Integration Verification

All 21 scenarios in `scratch/test-phase9.ts` verified:
1. Admin creates email invitation
2. Admin creates mobile invitation
3. Developer invitation blocked (403)
4. Client invitation blocked (403)
5. Duplicate active invitation blocked (409)
6. Inviting existing member blocked (409)
7. Invalid email rejected (422)
8. Invalid phone rejected (422)
9. Secure token generated (64-char hex)
10. Expired invitation rejected (410)
11. Cancel invitation (status -> cancelled)
12. Resend invitation (renew token & expiry)
13. Invitation acceptance creates membership
14. Double acceptance blocked (409)
15. Cross-org invitation cancel blocked (403)
16. Non-admin member removal blocked (403)
17. Last admin removal blocked (400 LAST_ADMIN)
18. Admin changes member role (200)
19. Activity records verified
20. Notifications dispatched
21. Tenant isolation verified
