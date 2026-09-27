import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { users } from './users';

export const projectMilestones = pgTable('project_milestones', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').default('upcoming').notNull(), // upcoming, in_progress, review, completed, blocked
  position: integer('position').default(0).notNull(),
  dueDate: timestamp('due_date'),
  completedAt: timestamp('completed_at'),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});
