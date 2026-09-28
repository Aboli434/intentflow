import { pgTable, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { users } from './users';

export const projectMemberActivity = pgTable(
  'project_member_activity',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    actorId: text('actor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    action: text('action', {
      enum: ['member_assigned', 'member_role_changed', 'member_removed'],
    }).notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('pma_project_id_idx').on(table.projectId),
    index('pma_user_id_idx').on(table.userId),
  ]
);
