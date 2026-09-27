import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { projectClosures } from './project_closures';
import { users } from './users';

export const closureRevisionRequests = pgTable('closure_revision_requests', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  closureId: text('closure_id')
    .notNull()
    .references(() => projectClosures.id, { onDelete: 'cascade' }),
  clientId: text('client_id')
    .notNull()
    .references(() => users.id),
  description: text('description').notNull(),
  status: text('status', {
    enum: ['open', 'in_progress', 'resolved', 'cancelled'],
  })
    .default('open')
    .notNull(),
  resolvedBy: text('resolved_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
});
