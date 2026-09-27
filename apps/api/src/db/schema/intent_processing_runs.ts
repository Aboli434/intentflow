import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { conversations } from './conversations';
import { intents } from './intents';
import { messages } from './messages';

export const intentProcessingRuns = pgTable('intent_processing_runs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  conversationId: text('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  intentId: text('intent_id').references(() => intents.id, { onDelete: 'set null' }),
  triggerMessageId: text('trigger_message_id').references(() => messages.id, { onDelete: 'set null' }),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  status: text('status', { enum: ['pending', 'success', 'completed', 'failed'] }).default('pending').notNull(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  errorCode: text('error_code'),
});
