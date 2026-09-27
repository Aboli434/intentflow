import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { projectHandoffs } from './project_handoffs';

export const handoffItems = pgTable('handoff_items', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  handoffId: text('handoff_id')
    .notNull()
    .references(() => projectHandoffs.id, { onDelete: 'cascade' }),
  type: text('type', {
    enum: ['deliverable', 'attachment', 'documentation', 'link', 'note'],
  }).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  referenceId: text('reference_id'),
  referenceUrl: text('reference_url'),
  position: integer('position').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
