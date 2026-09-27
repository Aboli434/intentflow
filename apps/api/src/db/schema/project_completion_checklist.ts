import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { users } from './users';

export const projectCompletionChecklist = pgTable(
  'project_completion_checklist',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    label: text('label').notNull(),
    status: text('status', {
      enum: ['pending', 'completed', 'blocked'],
    })
      .default('pending')
      .notNull(),
    required: boolean('required').default(true).notNull(),
    completedBy: text('completed_by').references(() => users.id),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  }
);
