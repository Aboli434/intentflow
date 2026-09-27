import { pgTable, text, integer } from 'drizzle-orm/pg-core';
import { workProposals } from './work_proposals';
import { intentRequirements } from './intent_requirements';

export const workProposalItems = pgTable('work_proposal_items', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  proposalId: text('proposal_id')
    .notNull()
    .references(() => workProposals.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  priority: text('priority', { enum: ['low', 'medium', 'high', 'urgent'] })
    .default('medium')
    .notNull(),
  estimatedEffort: text('estimated_effort', { enum: ['small', 'medium', 'large'] })
    .default('small')
    .notNull(),
  sourceRequirementId: text('source_requirement_id').references(() => intentRequirements.id, {
    onDelete: 'set null',
  }),
  suggestedRole: text('suggested_role').default('developer'),
  position: integer('position').default(0).notNull(),
});
