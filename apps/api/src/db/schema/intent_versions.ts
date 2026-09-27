import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { intents } from './intents';
import { users } from './users';

export const intentVersions = pgTable('intent_versions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  intentId: text('intent_id')
    .notNull()
    .references(() => intents.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  source: text('source', { enum: ['ai', 'human'] }).notNull(),
  snapshot: text('snapshot').notNull(), // JSON stringified snapshot of title, summary, requirements, questions
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
