import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { projectMilestones } from './project_milestones';
import { deliverables } from './deliverables';

export const milestoneDeliverables = pgTable(
  'milestone_deliverables',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    milestoneId: text('milestone_id')
      .notNull()
      .references(() => projectMilestones.id, { onDelete: 'cascade' }),
    deliverableId: text('deliverable_id')
      .notNull()
      .references(() => deliverables.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('milestone_deliv_unique_idx').on(table.milestoneId, table.deliverableId),
  ]
);
