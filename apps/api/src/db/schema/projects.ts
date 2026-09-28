import { pgTable, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { users } from './users';

export const projects = pgTable('projects', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status', {
    enum: ['active', 'closure_requested', 'client_review', 'changes_requested', 'completed', 'archived'],
  })
    .default('active')
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const projectMembers = pgTable(
  'project_members',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['client', 'developer', 'manager', 'viewer'] }).notNull(),
    assignedBy: text('assigned_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex('project_user_unique_idx').on(table.projectId, table.userId),
    index('project_members_project_id_idx').on(table.projectId),
    index('project_members_user_id_idx').on(table.userId),
    index('project_members_role_idx').on(table.role),
  ]
);
