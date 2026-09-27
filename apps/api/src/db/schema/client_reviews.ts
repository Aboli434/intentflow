import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { deliverables } from './deliverables';
import { users } from './users';

export const clientReviews = pgTable('client_reviews', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  deliverableId: text('deliverable_id')
    .notNull()
    .references(() => deliverables.id, { onDelete: 'cascade' }),
  clientId: text('client_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').notNull(), // pending, approved, changes_requested
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  resolvedAt: timestamp('resolved_at'),
});
