import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { messages } from './messages';
import { projects } from './projects';
import { users } from './users';

export const attachments = pgTable('attachments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  uploadedBy: text('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  messageId: text('message_id').references(() => messages.id, { onDelete: 'cascade' }),
  relatedEntityType: text('related_entity_type'),
  relatedEntityId: text('related_entity_id'),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  storageKey: text('storage_key').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
