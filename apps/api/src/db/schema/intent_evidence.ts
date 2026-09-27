import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { intents } from './intents';
import { messages } from './messages';
import { attachments } from './attachments';

export const intentEvidence = pgTable('intent_evidence', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  intentId: text('intent_id')
    .notNull()
    .references(() => intents.id, { onDelete: 'cascade' }),
  messageId: text('message_id')
    .notNull()
    .references(() => messages.id, { onDelete: 'cascade' }),
  attachmentId: text('attachment_id').references(() => attachments.id, { onDelete: 'set null' }),
  excerpt: text('excerpt'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
