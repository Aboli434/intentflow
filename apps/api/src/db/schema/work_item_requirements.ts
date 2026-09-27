import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { workItems } from './work_items';
import { intentRequirements } from './intent_requirements';

export const workItemRequirements = pgTable('work_item_requirements', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  workItemId: text('work_item_id')
    .notNull()
    .references(() => workItems.id, { onDelete: 'cascade' }),
  requirementId: text('requirement_id')
    .notNull()
    .references(() => intentRequirements.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
