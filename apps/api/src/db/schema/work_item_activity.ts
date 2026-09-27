import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { workItems } from './work_items';
import { users } from './users';

export const workItemActivity = pgTable('work_item_activity', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  workItemId: text('work_item_id')
    .notNull()
    .references(() => workItems.id, { onDelete: 'cascade' }),
  actorId: text('actor_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type', {
    enum: [
      'created',
      'assigned',
      'status_changed',
      'priority_changed',
      'commented',
      'blocked',
      'unblocked',
      'completed',
    ],
  }).notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
