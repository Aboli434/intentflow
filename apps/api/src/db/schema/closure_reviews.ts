import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { projectClosures } from './project_closures';
import { users } from './users';

export const closureReviews = pgTable('closure_reviews', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  closureId: text('closure_id')
    .notNull()
    .references(() => projectClosures.id, { onDelete: 'cascade' }),
  clientId: text('client_id')
    .notNull()
    .references(() => users.id),
  status: text('status', {
    enum: ['pending', 'approved', 'changes_requested'],
  })
    .default('pending')
    .notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  resolvedAt: timestamp('resolved_at'),
});
