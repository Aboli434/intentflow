import { pgTable, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { users } from './users';

export const projectActivity = pgTable(
  'project_activity',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    type: text('type').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('project_activity_project_id_idx').on(table.projectId),
    createdAtIdx: index('project_activity_created_at_idx').on(table.createdAt),
  })
);
