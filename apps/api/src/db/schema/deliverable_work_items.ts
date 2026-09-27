import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { deliverables } from './deliverables';
import { workItems } from './work_items';

export const deliverableWorkItems = pgTable(
  'deliverable_work_items',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    deliverableId: text('deliverable_id')
      .notNull()
      .references(() => deliverables.id, { onDelete: 'cascade' }),
    workItemId: text('work_item_id')
      .notNull()
      .references(() => workItems.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('deliv_wi_unique_idx').on(table.deliverableId, table.workItemId),
  ]
);
