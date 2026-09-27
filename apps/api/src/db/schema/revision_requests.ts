import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { deliverables } from './deliverables';
import { users } from './users';

export const revisionRequests = pgTable('revision_requests', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  deliverableId: text('deliverable_id')
    .notNull()
    .references(() => deliverables.id, { onDelete: 'cascade' }),
  clientId: text('client_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  status: text('status').default('open').notNull(), // open, in_progress, resolved, cancelled
  createdAt: timestamp('created_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: text('resolved_by').references(() => users.id, { onDelete: 'set null' }),
});
