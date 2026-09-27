import { pgTable, text, timestamp, real, integer } from 'drizzle-orm/pg-core';
import { intents } from './intents';

export const intentRequirements = pgTable('intent_requirements', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  intentId: text('intent_id')
    .notNull()
    .references(() => intents.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  confidence: real('confidence').default(0.85).notNull(),
  position: integer('position').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});
