# IntentFlow Architecture — Phase 13: Project Execution, UX Polish & Responsive Workspace

## 1. Overview & Objectives

Phase 13 transforms the IntentFlow project workspace across Web and Mobile into a unified, high-polish, responsive SaaS workspace. Building directly on the backend foundation and role permission engine established in Phases 1–12, Phase 13 focuses on visual clarity, responsive navigation, role-contextual actions, and consistent states (State, Action Required, Skeletons, and Empty States).

The project execution lifecycle follows a unified flow:
```text
Project -> State Banner -> Action Required -> Work Execution -> Deliverables -> Completion -> Handoff
```

Every workspace screen answers 5 fundamental questions:
1. Where am I?
2. What is the current project state?
3. What can I do here?
4. What needs my attention?
5. What happens next?

---

## 2. Core Architecture & UX Components

### 2.1 Workspace Header & Navigation (`ProjectWorkspaceHeader.tsx` & `ProjectWorkspaceTabs.tsx`)
- **Header Restructure**: Redesigned into a 2-row layout separating breadcrumbs, organization title, project name, live status badge (`● ACTIVE`), team member count chip, and accessible notification bell with unread badge.
- **Mobile Responsive Navigation**: Tabs container utilizes `overflow-x-auto scrollbar-none` with minimum 44px tap targets (`min-h-[44px]`). Active tab has high-contrast background (`bg-indigo-600`) to guarantee visibility on narrow viewports without causing horizontal page overflow.

### 2.2 Standardized Project State Banner (`ProjectStatusBanner.tsx`)
- **Derived Status Engine**: Maps internal backend statuses into 7 human-readable project execution states:
  - `ACTIVE`
  - `WORK_IN_PROGRESS`
  - `CLIENT_REVIEW`
  - `CHANGES_REQUESTED`
  - `COMPLETION_REVIEW`
  - `HANDOFF_READY`
  - `COMPLETED`
- **Role-Contextual Next Actions**: Formats state explanation cards with role-tailored CTA buttons (e.g., Client sees "Review Deliverables", Developer sees "View Requested Changes").

### 2.3 Prominent Action Required Center (`ActionRequiredCard.tsx`)
- Derives actual actionable tasks from live database entities (pending deliverable reviews, pending completion sign-offs, blocked work items).
- Eliminates hardcoded fake tasks while giving immediate clarity on items awaiting user attention.

### 2.4 Unified Workspace Viewports & Skeletons
- **Reusable Empty State (`EmptyState.tsx`)**: Replaces blank views across Conversations, Work Items, Deliverables, and Team tabs with explicit icon, title, description, and primary CTA.
- **Skeleton Loader (`WorkspaceSkeleton.tsx`)**: Matches card & layout grids during API fetch execution to avoid dark flash screens.

---

## 3. Work, Deliverables & Completion Refactor

### 3.1 Work Execution View (`WorkView.tsx`)
- Structured filters (`All Work | My Work | Ready | In Progress | Blocked | Completed`).
- Cards display title, status badge, assignee, due date, priority tag, and visual progress bar (`██████░░░░ 60%`).

### 3.2 Deliverables & Approval View (`DeliverablesView.tsx`)
- Top metric banner highlighting total approved deliverables out of count.
- Dynamic filtering by state (`All | Draft | Submitted | Changes Requested | Approved`).
- Strict role enforcement for CTAs (Approve / Request Changes for Client; Edit / Submit for Developer).

### 3.3 Project Completion & Handoff View (`ProjectCompletionView.tsx`)
Structured into 4 visual sections:
1. **Completion Readiness**: Progress circle, percentage score, and state indicator.
2. **Completion Checklist**: Requirement items with status pills and completion toggles.
3. **Client Closure Review**: Formatted closure submission & approval card.
4. **Handoff Package**: Delivered assets, documentation links, and client download options.

---

## 4. Mobile Expo Architecture (`apps/mobile/app/(app)/projects/[id].tsx`)
- Native-optimized tab layout with touchable chips (`minHeight: 44`).
- Quick metrics grid (`WORK`, `DELIVERABLES`, `TEAM`) and workspace hub shortcuts.
- Conversation creation modal and message thread navigation tailored for mobile screen sizes (320px–414px).

---

## 5. Security & Authorization Integrity

- UI CTAs are driven by backend permission policies, never used as security by obscurity.
- Every API route validates tenant isolation (`x-organization-id`), organization membership, project membership, project role, and resource ownership.
- Direct unauthorized API calls (e.g. Viewer attempting deliverable creation or cross-org access) return 403 Forbidden.

---

## 6. Integration Testing & Quality Gates

Phase 13 verification suite (`scratch/test-phase13.ts`):
1. Project overview loads -> PASS
2. Project state is correctly derived -> PASS
3. Client sees client actions -> PASS
4. Developer sees developer actions -> PASS
5. Manager sees manager actions -> PASS
6. Viewer cannot perform mutations -> PASS
7. Conversation access respects project membership -> PASS
8. Work item access respects project membership -> PASS
9. Deliverable actions respect role -> PASS
10. Completion actions respect role -> PASS
11. Team management respects role -> PASS
12. Activity visibility respects role -> PASS
13. Cross-organization project access returns 403 -> PASS
14. Unassigned organization member cannot access project -> PASS
15. No unauthorized mutation is possible through direct API call -> PASS

### Quality Gate Results:
- `scratch/test-phase13.ts`: 16/16 PASS
- `pnpm typecheck`: PASS
- `pnpm lint`: PASS
- `pnpm build`: PASS
