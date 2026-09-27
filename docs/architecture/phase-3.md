# IntentFlow Phase 3 — Conversations & Messaging Architecture

This document specifies the technical design, data models, API endpoints, authorization rules, and real-time infrastructure implemented in **Phase 3 — Conversations & Messaging**.

---

## 1. Overview & Objective

Phase 3 introduces the core human communication foundation of IntentFlow. It enables persistent, project-scoped conversations between clients and developers with real-time delivery, file attachment uploads, participant management, and cursor-based pagination.

**Crucial Product Rule**: AI capabilities (LLM integration, intent extraction, embeddings, vector databases) are **NOT** implemented in Phase 3. Phase 3 provides the clean human communication stream that future Phase 4 intelligence features will operate on.

---

## 2. Core Data Model

The domain hierarchy follows a strict parent-child relationship:

```text
Organization
    ↓
Project
    ↓
Conversation
    ↓
Message
    ↓
Attachment
```

### Table Definitions (Drizzle ORM & PostgreSQL)

1. **`conversations`**
   - `id`: `text` (Primary Key, UUID)
   - `projectId`: `text` (Foreign Key -> `projects.id`, ON DELETE CASCADE)
   - `title`: `text` (Required conversation thread title)
   - `createdBy`: `text` (Foreign Key -> `users.id`, ON DELETE CASCADE)
   - `createdAt`: `timestamp`
   - `updatedAt`: `timestamp`

2. **`conversation_participants`**
   - `id`: `text` (Primary Key, UUID)
   - `conversationId`: `text` (Foreign Key -> `conversations.id`, ON DELETE CASCADE)
   - `userId`: `text` (Foreign Key -> `users.id`, ON DELETE CASCADE)
   - `joinedAt`: `timestamp`
   - `lastReadAt`: `timestamp` (Nullable, tracks latest read marker)
   - *Constraint*: Unique index on `(conversationId, userId)`

3. **`messages`**
   - `id`: `text` (Primary Key, UUID)
   - `conversationId`: `text` (Foreign Key -> `conversations.id`, ON DELETE CASCADE)
   - `senderId`: `text` (Foreign Key -> `users.id`, ON DELETE CASCADE)
   - `body`: `text` (Required non-empty message text)
   - `type`: `text` enum (`'text'`, `'system'`)
   - `createdAt`: `timestamp`
   - `updatedAt`: `timestamp`

4. **`attachments`**
   - `id`: `text` (Primary Key, UUID)
   - `messageId`: `text` (Nullable Foreign Key -> `messages.id`, ON DELETE CASCADE to allow pre-send upload)
   - `fileName`: `text` (Original file name)
   - `mimeType`: `text` (MIME type string)
   - `size`: `integer` (File size in bytes)
   - `storageKey`: `text` (Internal storage key / relative file path)
   - `createdAt`: `timestamp`

---

## 3. Centralized Policy Authorization

Phase 3 extends the centralized permission engine (`apps/api/src/lib/permissions.ts`) with 7 new policy actions:

- `conversation:create`: Requires Org Admin or assigned Project Member
- `conversation:view`: Requires Org Admin (administrative visibility) or assigned Project Member
- `conversation:manage_participants`: Requires Org Admin or assigned Project Developer
- `message:view`: Requires Org Admin or assigned Project Member
- `message:send`: Requires Org Admin or assigned Project Member
- `attachment:upload`: Requires Org Admin or assigned Project Member
- `attachment:view`: Requires Org Admin or assigned Project Member

### Important Admin Rule
```text
Admin ≠ Automatic Participant
```
Organization Admins have administrative visibility into all conversations within organization projects (`conversation:view`), but do **not** automatically become active conversation participants (`conversation_participants`). Participant status is explicitly managed.

---

## 4. API Endpoints Overview

### Conversations & Messages API
- `POST /api/projects/:projectId/conversations` — Create conversation thread
- `GET /api/projects/:projectId/conversations` — List project conversations (with last message preview & unread indicator)
- `GET /api/conversations/:conversationId` — Get conversation details & participant list
- `POST /api/conversations/:conversationId/participants` — Add conversation participant
- `DELETE /api/conversations/:conversationId/participants/:userId` — Remove conversation participant
- `GET /api/conversations/:conversationId/messages` — List conversation messages (cursor-based pagination)
- `POST /api/conversations/:conversationId/messages` — Send message (link attachments & broadcast WS event)
- `POST /api/conversations/:conversationId/read` — Mark conversation as read (updates `lastReadAt`)
- `GET /api/conversations/:conversationId/ws` — Real-time WebSocket connection endpoint

### Attachments API
- `POST /api/attachments/upload` — Upload file attachment (`@fastify/multipart`, 25MB limit)
- `GET /api/attachments/:attachmentId/download` — Secure file download endpoint

---

## 5. Real-Time Architecture

The real-time messaging pipeline operates synchronously with database persistence:

```text
User writes message
        ↓
POST /api/conversations/:conversationId/messages
        ↓
Authenticate & Authorize
        ↓
Persist to PostgreSQL (`messages` & `attachments`)
        ↓
Emit WebSocket Event (`conversation.message.created`)
        ↓
Connected WebSockets receive payload
```

If a client disconnects, database persistence guarantees zero message loss. Upon reconnection, the client fetches missed messages via `GET /api/conversations/:conversationId/messages`.

---

## 6. Applications (Web & Mobile)

- **Web Application (`apps/web`)**: Provides a full desktop communication workspace under `/projects/[projectId]` with dual tabs (`Conversations` | `Overview`), conversation sidebar, timeline feed, attachment preview/download, and message composer.
- **Mobile Application (`apps/mobile`)**: Provides touch-optimized project conversation list and dedicated chat screen under `/conversations/[conversationId]` with `KeyboardAvoidingView` and `FlatList` timeline.

---

## 7. Future AI Integration Boundary

Phase 3 establishes the raw communication layer. The future **Phase 4 — Intent Intelligence** will consume:

```text
Conversation
    ↓
Messages & Attachments
    ↓
Context Analysis
    ↓
Structured Intent & Suggested Work
```

Phase 3 stores immutable, raw human communication without applying AI processing.
