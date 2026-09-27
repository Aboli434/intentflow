import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { intents } from './intents';

export const intentQuestions = pgTable('intent_questions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  intentId: text('intent_id')
    .notNull()
    .references(() => intents.id, { onDelete: 'cascade' }),
  question: text('question').notNull(),
  status: text('status', { enum: ['open', 'resolved', 'dismissed'] }).default('open').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
});
