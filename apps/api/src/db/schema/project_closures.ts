import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { users } from './users';

export const projectClosures = pgTable('project_closures', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  status: text('status', {
    enum: [
      'draft',
      'pending_client_approval',
      'changes_requested',
      'approved',
      'completed',
      'cancelled',
    ],
  })
    .default('draft')
    .notNull(),
  summary: text('summary'),
  completionNotes: text('completion_notes'),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
  submittedAt: timestamp('submitted_at'),
  approvedAt: timestamp('approved_at'),
  approvedBy: text('approved_by').references(() => users.id),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
