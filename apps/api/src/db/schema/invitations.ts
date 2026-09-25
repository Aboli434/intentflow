import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';

export const organizationInvitations = pgTable('organization_invitations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role', { enum: ['admin', 'developer', 'client'] }).notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
