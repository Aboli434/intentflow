import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { projectClosures } from './project_closures';
import { projects } from './projects';
import { users } from './users';

export const projectHandoffs = pgTable('project_handoffs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  closureId: text('closure_id')
    .notNull()
    .references(() => projectClosures.id, { onDelete: 'cascade' }),
  handoffStatus: text('handoff_status', {
    enum: ['pending', 'ready', 'delivered', 'acknowledged'],
  })
    .default('pending')
    .notNull(),
  summary: text('summary'),
  deliverablesCount: integer('deliverables_count').default(0).notNull(),
  completedWorkCount: integer('completed_work_count').default(0).notNull(),
  approvedDeliverablesCount: integer('approved_deliverables_count')
    .default(0)
    .notNull(),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
  deliveredAt: timestamp('delivered_at'),
  acknowledgedAt: timestamp('acknowledged_at'),
  acknowledgedBy: text('acknowledged_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
