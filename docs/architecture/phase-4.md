# IntentFlow Phase 4 — Intent Intelligence & Human Review Architecture

This document specifies the technical architecture, data models, AI provider abstraction, context builder, Zod validation schemas, human review workflow, centralized authorization policies, real-time events, and security boundaries implemented in **Phase 4 — Intent Intelligence & Human Review**.

---

## 1. Executive Summary & Core Principle

Phase 4 is the first AI-enabled product phase of IntentFlow.

> **Core Principle**: AI turns messy client communication into a structured, reviewable representation of work intent (`Communication → Context → AI Interpretation → Human Review → Confirmed Intent`).

### Crucial Architectural Rules
1. **No Autonomous Task Creation**: The AI proposes structured intents. Humans verify and edit. AI interpretation is never automatically treated as truth (`Message → AI Interpretation → Human Review → Confirmed Intent`).
2. **Invisible Infrastructure Layer**: IntentFlow is NOT an AI chatbot, Claude playground, or "Ask AI" chat tool. The user communicates naturally, and IntentFlow structures what they meant in the background.
3. **Traceability (Evidence)**: Every extracted requirement maps back to source message IDs (`intent_evidence`), enabling developers to navigate directly to the evidence in the communication timeline.
4. **Resilience**: AI provider failures or network timeouts NEVER impede normal messaging or prevent developer workflows. Communication remains 100% operational regardless of LLM availability.

---

## 2. Intent Data Model & Database Schema

Phase 4 introduces 6 new persistent database entities:

```text
Organization
    ↓
Project
    ↓
Conversation
    ↓
Message
    ↓
Intent ───┬──► Requirements (intent_requirements)
          ├──► Missing Information (intent_questions)
          ├──► Evidence References (intent_evidence)
          ├──► Version History (intent_versions)
          └──► Execution Run Logs (intent_processing_runs)
```

### Table Definitions (Drizzle ORM & PostgreSQL)

1. **`intents`**
   - `id`: `text` (Primary Key, UUID)
   - `projectId`: `text` (Foreign Key -> `projects.id`, ON DELETE CASCADE)
   - `conversationId`: `text` (Foreign Key -> `conversations.id`, ON DELETE CASCADE)
   - `createdBy`: `text` (Foreign Key -> `users.id`, ON DELETE CASCADE)
   - `status`: `text` enum (`'processing'`, `'ready_for_review'`, `'confirmed'`, `'rejected'`, `'needs_clarification'`)
   - `origin`: `text` enum (`'ai'`, `'human'`)
   - `modifiedByHuman`: `boolean` (Set to `true` when a developer modifies AI output)
   - `title`: `text` (Concise intent title)
   - `summary`: `text` (Structured summary of client requested outcome)
   - `confidence`: `real` (Normalized float `0.0` to `1.0`)
   - `sourceMessageId`: `text` (Nullable Foreign Key -> `messages.id`)
   - `rejectionReason`: `text` (Nullable explanation when rejected by developer)
   - `reviewedBy`: `text` (Nullable Foreign Key -> `users.id`)
   - `reviewedAt`: `timestamp`
   - `createdAt`: `timestamp`
   - `updatedAt`: `timestamp`

2. **`intent_requirements`**
   - `id`: `text` (Primary Key, UUID)
   - `intentId`: `text` (Foreign Key -> `intents.id`, ON DELETE CASCADE)
   - `text`: `text` (Specific actionable requirement statement)
   - `confidence`: `real` (Normalized confidence score)
   - `position`: `integer` (Ordered display position)
   - `createdAt`: `timestamp`
   - `updatedAt`: `timestamp`

3. **`intent_questions`**
   - `id`: `text` (Primary Key, UUID)
   - `intentId`: `text` (Foreign Key -> `intents.id`, ON DELETE CASCADE)
   - `question`: `text` (Clarifying question for ambiguous or missing information)
   - `status`: `text` enum (`'open'`, `'resolved'`, `'dismissed'`)
   - `createdAt`: `timestamp`
   - `resolvedAt`: `timestamp`

4. **`intent_evidence`**
   - `id`: `text` (Primary Key, UUID)
   - `intentId`: `text` (Foreign Key -> `intents.id`, ON DELETE CASCADE)
   - `messageId`: `text` (Foreign Key -> `messages.id`, ON DELETE CASCADE)
   - `attachmentId`: `text` (Nullable Foreign Key -> `attachments.id`, ON DELETE SET NULL)
   - `excerpt`: `text` (Relevant quotation or snippet from source communication)
   - `createdAt`: `timestamp`

5. **`intent_versions`**
   - `id`: `text` (Primary Key, UUID)
   - `intentId`: `text` (Foreign Key -> `intents.id`, ON DELETE CASCADE)
   - `version`: `integer` (Monotonically increasing version index)
   - `source`: `text` enum (`'ai'`, `'human'`)
   - `snapshot`: `jsonb` (Complete JSON snapshot of intent, requirements, questions, and evidence)
   - `createdBy`: `text` (Nullable Foreign Key -> `users.id`)
   - `createdAt`: `timestamp`

6. **`intent_processing_runs`**
   - `id`: `text` (Primary Key, UUID)
   - `conversationId`: `text` (Foreign Key -> `conversations.id`, ON DELETE CASCADE)
   - `intentId`: `text` (Nullable Foreign Key -> `intents.id`, ON DELETE SET NULL)
   - `triggerMessageId`: `text` (Nullable Foreign Key -> `messages.id`, ON DELETE SET NULL)
   - `provider`: `text` (AI Provider identifier, e.g. `'DefaultAIProvider'`)
   - `model`: `text` (Model identifier, e.g. `'gpt-4o-mini'`)
   - `status`: `text` enum (`'pending'`, `'success'`, `'completed'`, `'failed'`)
   - `startedAt`: `timestamp`
   - `completedAt`: `timestamp`
   - `errorCode`: `text` (Diagnostic error string if run fails)

---

## 3. AI Provider Abstraction Architecture

IntentFlow defines an internal interface boundary (`apps/api/src/services/ai/providers/ai-provider.interface.ts`) decoupled from specific vendor SDKs.

```text
IntentAnalysisService
        │
        ▼
   AIProvider (Interface)
        │
        ├──► DefaultAIProvider (OpenAI / Gemini API wrapper)
        └──► Fallback Heuristic Analysis Engine (Runs if no API key is configured)
```

### Prompt Construction & Hallucination Prevention
Prompts (`apps/api/src/services/ai/prompts/intent-analysis.ts`) strictly instruct the model to:
- Extract explicit & implicit work requirements without inventing fake deadlines, budgets, or missing features.
- Output missing details as `missingInformation` questions rather than guessing.
- Map every extracted requirement to source `messageId` references.
- Respond with valid JSON matching `aiStructuredOutputSchema`.

### Output Validation (Zod)
Before persisting any model response to PostgreSQL, `IntentAnalysisService` parses the raw JSON using Zod's `aiStructuredOutputSchema.safeParse(...)`.
- If valid: Persists records and emits `intent.ready` event.
- If invalid or provider fails: Logs error to `intent_processing_runs`, marks intent as `needs_clarification`, and keeps communication 100% operational.

---

## 4. Context Construction Layer (`ContextBuilder`)

The `ContextBuilder` (`apps/api/src/services/ai/context-builder.ts`) retrieves bounded context:
- Project details & description.
- Bounded conversation timeline (up to 30 recent messages).
- Associated file attachment metadata (`fileName`, `mimeType`, `size`).
- Previously confirmed project intents (up to 5 recent confirmed intents for context continuity).

---

## 5. Centralized Policy Authorization

Phase 4 extends `apps/api/src/lib/permissions.ts` with 6 new policy actions:

| Action | Developer / Org Admin | Client |
| :--- | :--- | :--- |
| `intent:view` | Allowed | Allowed (Client-safe view) |
| `intent:analyze` | Allowed | **DENIED (403)** |
| `intent:edit` | Allowed | **DENIED (403)** |
| `intent:confirm` | Allowed | **DENIED (403)** |
| `intent:reject` | Allowed | **DENIED (403)** |
| `intent:request_clarification` | Allowed | **DENIED (403)** |

*Rule*: Clients participate in natural messaging but cannot perform internal AI analysis triggers or modify/confirm internal intent records.

---

## 6. API Endpoints Overview

- `POST /api/conversations/:conversationId/intents/analyze` — Trigger AI intent analysis for a conversation thread.
- `GET /api/conversations/:conversationId/intents` — List detailed intents for a conversation.
- `GET /api/intents/:intentId` — Get single intent details with requirements, questions, evidence, and versions.
- `PATCH /api/intents/:intentId` — Edit intent title, summary, requirements, or questions (Sets `modifiedByHuman = true`, records `intent_versions`).
- `POST /api/intents/:intentId/confirm` — Confirm intent (Sets `status = 'confirmed'`, `reviewedBy`, `reviewedAt`).
- `POST /api/intents/:intentId/reject` — Reject intent with optional reason (Sets `status = 'rejected'`, `rejectionReason`).
- `POST /api/intents/:intentId/questions/:questionId/dismiss` — Dismiss a missing information question.
- `POST /api/intents/:intentId/clarification` — Generate clarification question draft for developer review.

---

## 7. Human Review Experience & Web/Mobile Interfaces

### Web Workspace (`apps/web`)
Integrated inside `/projects/[projectId]` as a 3-column workspace:
1. **Left Column**: Conversation thread navigator.
2. **Center Column**: Real-time message feed, composer, and file attachments with an **Analyze Intent** trigger button.
3. **Right Column (`IntentPanel.tsx`)**: Developer review panel presenting:
   - Status badge & normalized Confidence badge.
   - Requirements editor with checkmarks & editable items.
   - Missing Information questions with `[Ask Client]` draft builder and `[Dismiss]`.
   - Traceable Evidence badges linking to original message IDs in the timeline.
   - Review action buttons: `[Edit]`, `[Confirm]`, `[Reject]`, `[Ask Client]`.

### Mobile Workspace (`apps/mobile`)
Remains client-focused under `/conversations/[conversationId]` with a subtle status banner (`✨ Your project communication is organized & reviewed by your team`), concealing internal AI confidence scores and review controls from clients.

---

## 8. Real-Time WebSocket Events

- `intent.processing`: Emitted when AI processing commences for a conversation.
- `intent.ready`: Emitted when structured intent analysis completes successfully.
- `intent.updated`: Emitted when a human developer edits requirement details.
- `intent.confirmed`: Emitted when an intent is confirmed by a developer.
- `intent.rejected`: Emitted when an intent is rejected with a reason.

---

## 9. Verification & Automated Test Suite

Verified via `scratch/test-phase4.ts`:
- **AI Analysis**: PASS
- **Schema Validation**: PASS
- **Evidence Mapping**: PASS
- **Human Editing**: PASS (`modifiedByHuman: true`, version history snapshot recorded)
- **Confirmation**: PASS
- **Rejection**: PASS
- **Authorization & Role Access**: PASS
- **Tenant Isolation**: PASS
- **AI Failure Resilience**: PASS
- **PostgreSQL Persistence**: PASS (all 6 tables populated)

---

## 10. Future Work Boundary

Phase 4 concludes at **Confirmed Intent**.

Do **NOT** implement:
- Task creation or task assignment.
- Work item execution or sprint planning.
- Automated client approval workflows.

Future work execution phases will consume confirmed intents as input objects.
