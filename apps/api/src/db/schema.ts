import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Minimal Database Schema for Phase 1 Technical Foundation
 */

export const systemChecks = pgTable('system_checks', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
