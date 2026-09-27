import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { users } from './users';

export const deliverables = pgTable('deliverables', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').default('draft').notNull(), // draft, ready_for_review, in_review, changes_requested, approved, archived
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  deliveredAt: timestamp('delivered_at'),
  approvedAt: timestamp('approved_at'),
  approvedBy: text('approved_by').references(() => users.id, { onDelete: 'set null' }),
});
