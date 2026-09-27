import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { intents } from './intents';
import { users } from './users';

export const workItems = pgTable('work_items', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  intentId: text('intent_id').references(() => intents.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status', {
    enum: ['backlog', 'ready', 'in_progress', 'blocked', 'in_review', 'completed', 'cancelled'],
  })
    .default('backlog')
    .notNull(),
  priority: text('priority', { enum: ['low', 'medium', 'high', 'urgent'] })
    .default('medium')
    .notNull(),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  assignedTo: text('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  dueDate: timestamp('due_date'),
  position: integer('position').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});
