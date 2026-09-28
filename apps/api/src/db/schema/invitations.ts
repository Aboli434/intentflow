import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { users } from './users';

export const organizationInvitations = pgTable('organization_invitations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  email: text('email'),
  phone: text('phone'),
  invitationMethod: text('invitation_method', { enum: ['email', 'sms'] })
    .default('email')
    .notNull(),
  role: text('role', { enum: ['admin', 'developer', 'client'] }).notNull(),
  token: text('token').notNull().unique(),
  invitedBy: text('invited_by').references(() => users.id, { onDelete: 'set null' }),
  status: text('status', { enum: ['pending', 'sent', 'delivery_failed', 'accepted', 'expired', 'cancelled'] })
    .default('pending')
    .notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  sentAt: timestamp('sent_at'),
  deliveryStatus: text('delivery_status'),
  lastDeliveryAttempt: timestamp('last_delivery_attempt'),
  failureReason: text('failure_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});
