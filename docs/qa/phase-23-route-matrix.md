# IntentFlow — Phase 23 Route & UX Matrix

## Inventory & Status Matrix

| Route | Auth Req | Expected Role | Desktop (1024px+) | Mobile (320px–414px) | Navigation & Deep-Link | Loading State | Empty State | Error State | Validation State | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/` | Public | All | ✅ Full Hero, Features, CTA | ✅ Stacked, Hamburger Menu | ✅ Header links & CTAs | ✅ Fast static prerender | N/A | ✅ Toast / Graceful API fallbacks | N/A | **PASS** |
| `/demo` | Public | All | ✅ 3-Persona Cards Grid | ✅ 1-Col Stacked Cards | ✅ Direct Persona Switch | ✅ Button spinner | N/A | ✅ Error banner on token fault | N/A | **PASS** |
| `/login` | Public | Unauth | ✅ Centered Card Modal Style | ✅ Full width with padding | ✅ Links to Signup/Forgot-Pass | ✅ Submit button loader | N/A | ✅ Inline error banner | ✅ Email/Pass required | **PASS** |
| `/signup` | Public | Unauth | ✅ Form Card with invite banner | ✅ Responsive padding | ✅ Redirects to Dashboard | ✅ Submit button loader | N/A | ✅ Inline error banner | ✅ Matching passwords, min 8 chars | **PASS** |
| `/forgot-password` | Public | Unauth | ✅ Form Card with success state | ✅ Responsive padding | ✅ Back to Login link | ✅ State transition | N/A | ✅ Handled inline | ✅ Email format | **PASS** |
| `/invite/[token]` | Public / Auth | Invited | ✅ Accept banner & org name | ✅ Responsive stacked card | ✅ Auth gate / auto-route | ✅ Spinner during fetch | N/A | ✅ Expired / Invalid state alert | ✅ Token validation | **PASS** |
| `/dashboard` | Protected | Client, Dev, Admin | ✅ Metrics, Quick Actions, Activity | ✅ Responsive summary grid | ✅ Header tabs, project deep-links | ✅ Skeleton shimmer | ✅ "No projects yet" CTA | ✅ Error banner + retry | N/A | **PASS** |
| `/projects` | Protected | Client, Dev, Admin | ✅ Project Grid + Filter Bar | ✅ Stacked Cards | ✅ Link to `/projects/[id]` | ✅ WorkspaceSkeleton | ✅ "No matching projects" | ✅ Error boundary | ✅ Create modal validation | **PASS** |
| `/projects/[projectId]?tab=overview` | Protected | Assigned / Admin | ✅ Stats, Team, Milestones | ✅ Responsive 1-col | ✅ Persistent `?tab=` URL query | ✅ ProjectWorkspaceShell Skeleton | ✅ Dynamic empty states | ✅ AccessStateMode ('unauthorized', 'not_assigned') | N/A | **PASS** |
| `/projects/[projectId]?tab=conversations` | Protected | Assigned / Admin | ✅ Split thread / message panel | ✅ Responsive full-width thread | ✅ Thread select & deep-link | ✅ Skeleton loaders | ✅ "Start conversation" CTA | ✅ Network error retry | ✅ Non-empty message required | **PASS** |
| `/projects/[projectId]?tab=work` | Protected | Assigned / Admin | ✅ Kanban / List views | ✅ Stacked Cards | ✅ Filter by status/assignee | ✅ Shimmer list | ✅ "Create work item" CTA | ✅ Toast notifications | ✅ Title, priority validation | **PASS** |
| `/projects/[projectId]?tab=deliverables` | Protected | Assigned / Admin | ✅ Review Portal & Actions | ✅ Modal & Card overflow safe | ✅ Status filters | ✅ Shimmer list | ✅ "No deliverables submitted" | ✅ Error toast | ✅ Min 10 chars feedback on change req | **PASS** |
| `/projects/[projectId]?tab=team` | Protected | Assigned / Admin | ✅ Member table + Role badges | ✅ Card stack | ✅ Direct assignment triggers | ✅ Table skeleton | ✅ "No team members" | ✅ Auth error toast | ✅ Member selection required | **PASS** |
| `/projects/[projectId]?tab=activity` | Protected | Assigned / Admin | ✅ Chronological timeline | ✅ Compact timeline | ✅ Timestamp & Actor details | ✅ Shimmer timeline | ✅ "No recent activity" | ✅ Network error alert | N/A | **PASS** |
| `/projects/[projectId]?tab=completion` | Protected | Assigned / Admin | ✅ Formal signoff summary & checklist | ✅ Stacked checklist | ✅ Deep-linkable | ✅ Shimmer skeleton | ✅ "Incomplete items" state | ✅ Signoff error feedback | ✅ All deliverables approved required | **PASS** |
| `/settings` | Protected | Org Member (Admin controls)| ✅ Org switch, Member & Invites tables| ✅ Stacked invite cards | ✅ Tab switching | ✅ Shimmer skeletons | ✅ "No invitations pending" | ✅ Error banner | ✅ Email/SMS & phone validation | **PASS** |
| `/notifications` | Protected | All Authenticated | ✅ Filterable notification feed | ✅ Responsive list | ✅ Mark read / navigation | ✅ Skeleton loader | ✅ "You're all caught up" | ✅ Error banner | N/A | **PASS** |
