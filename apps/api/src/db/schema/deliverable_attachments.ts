import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { deliverables } from './deliverables';
import { attachments } from './attachments';

export const deliverableAttachments = pgTable(
  'deliverable_attachments',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    deliverableId: text('deliverable_id')
      .notNull()
      .references(() => deliverables.id, { onDelete: 'cascade' }),
    attachmentId: text('attachment_id')
      .notNull()
      .references(() => attachments.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('deliv_att_unique_idx').on(table.deliverableId, table.attachmentId),
  ]
);
