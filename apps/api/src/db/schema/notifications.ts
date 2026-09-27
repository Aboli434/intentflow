import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { organizations } from './organizations';
import { projects } from './projects';
import { NotificationType } from '@intentflow/types';

export const notifications = pgTable(
  'notifications',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    type: text('type').$type<NotificationType>().notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('notifications_user_id_idx').on(table.userId),
    readAtIdx: index('notifications_read_at_idx').on(table.readAt),
    createdAtIdx: index('notifications_created_at_idx').on(table.createdAt),
    projectIdIdx: index('notifications_project_id_idx').on(table.projectId),
  })
);
