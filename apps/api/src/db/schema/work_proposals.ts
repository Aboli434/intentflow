import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { intents } from './intents';
import { users } from './users';

export const workProposals = pgTable('work_proposals', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  intentId: text('intent_id')
    .notNull()
    .references(() => intents.id, { onDelete: 'cascade' }),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  status: text('status', { enum: ['draft', 'pending_review', 'approved', 'rejected'] })
    .default('pending_review')
    .notNull(),
  generatedBy: text('generated_by', { enum: ['ai', 'human'] })
    .default('ai')
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  reviewedAt: timestamp('reviewed_at'),
  reviewedBy: text('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
});
