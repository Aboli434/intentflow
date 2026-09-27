import { pgTable, text, timestamp, real, boolean } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { conversations } from './conversations';
import { messages } from './messages';
import { users } from './users';

export const intents = pgTable('intents', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  conversationId: text('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: text('status', {
    enum: ['processing', 'ready_for_review', 'confirmed', 'rejected', 'needs_clarification'],
  })
    .default('processing')
    .notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  confidence: real('confidence').default(0.85).notNull(),
  sourceMessageId: text('source_message_id').references(() => messages.id, { onDelete: 'set null' }),
  origin: text('origin', { enum: ['ai', 'human'] }).default('ai').notNull(),
  modifiedByHuman: boolean('modified_by_human').default(false).notNull(),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  reviewedAt: timestamp('reviewed_at'),
  reviewedBy: text('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
});
