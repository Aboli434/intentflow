import { z } from 'zod';

/**
 * Validation Schemas for IntentFlow (Phase 3 Conversations & Messaging)
 */

export const userRoleSchema = z.enum(['admin', 'developer', 'client']);
export const projectRoleSchema = z.enum(['client', 'developer', 'manager', 'viewer']);
export const projectStatusSchema = z.enum(['active', 'archived']);
export const messageTypeSchema = z.enum(['text', 'system']);

export const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  invitationToken: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const createOrganizationSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters long'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters long')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
    .optional(),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters long').optional(),
});

export const invitationMethodSchema = z.enum(['email', 'sms']);

export const createInvitationSchema = z
  .object({
    method: invitationMethodSchema.default('email'),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    phone: z.string().optional().or(z.literal('')),
    role: userRoleSchema.default('client'),
  })
  .refine(
    (data) => {
      if (data.method === 'sms') {
        return typeof data.phone === 'string' && data.phone.trim().length >= 8;
      }
      return typeof data.email === 'string' && data.email.includes('@');
    },
    {
      message: 'Must provide valid contact details matching invitation method',
      path: ['email'],
    }
  );

export const updateMemberRoleSchema = z.object({
  role: userRoleSchema,
});

export const createProjectSchema = z.object({
  organizationId: z.string().uuid('Invalid Organization ID'),
  name: z.string().min(2, 'Project name must be at least 2 characters long'),
  description: z.string().optional(),
  members: z
    .array(
      z.object({
        userId: z.string().uuid('Invalid User ID'),
        role: projectRoleSchema,
      })
    )
    .optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(2, 'Project name must be at least 2 characters long').optional(),
  description: z.string().optional(),
  status: projectStatusSchema.optional(),
});

export const addProjectMemberSchema = z.object({
  userId: z.string().uuid('Invalid User ID'),
  role: projectRoleSchema,
});

export const createConversationSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(100, 'Title cannot exceed 100 characters'),
  participantUserIds: z.array(z.string().uuid('Invalid User ID')).optional(),
});

export const sendMessageSchema = z.object({
  body: z.string().min(1, 'Message body cannot be empty').max(10000, 'Message body cannot exceed 10,000 characters'),
  attachmentIds: z.array(z.string().uuid('Invalid Attachment ID')).optional(),
});

export const addParticipantSchema = z.object({
  userId: z.string().uuid('Invalid User ID'),
});

export const healthCheckResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  timestamp: z.string().optional(),
  database: z.enum(['connected', 'disconnected']),
});

export const intentStatusSchema = z.enum([
  'processing',
  'ready_for_review',
  'confirmed',
  'rejected',
  'needs_clarification',
]);

export const questionStatusSchema = z.enum(['open', 'resolved', 'dismissed']);

export const aiStructuredRequirementSchema = z.object({
  text: z.string().min(1, 'Requirement text cannot be empty'),
  confidence: z.number().min(0).max(1).default(0.85),
  messageId: z.string().optional().nullable(),
});

export const aiStructuredQuestionSchema = z.object({
  question: z.string().min(1, 'Question cannot be empty'),
});

export const aiStructuredEvidenceSchema = z.object({
  messageId: z.string(),
  attachmentId: z.string().optional().nullable(),
  excerpt: z.string().optional().nullable(),
});

export const aiStructuredOutputSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  summary: z.string().min(1, 'Summary is required'),
  requirements: z.array(aiStructuredRequirementSchema).default([]),
  missingInformation: z.array(aiStructuredQuestionSchema).default([]),
  references: z.array(aiStructuredEvidenceSchema).default([]),
  confidence: z.number().min(0).max(1).default(0.85),
});

export const updateIntentSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  summary: z.string().min(1, 'Summary is required').optional(),
  requirements: z
    .array(
      z.object({
        id: z.string().optional(),
        text: z.string().min(1, 'Requirement text is required'),
        confidence: z.number().min(0).max(1).optional(),
        position: z.number().optional(),
      })
    )
    .optional(),
  questions: z
    .array(
      z.object({
        id: z.string().optional(),
        question: z.string().min(1, 'Question is required'),
        status: questionStatusSchema.optional(),
      })
    )
    .optional(),
});

export const confirmIntentSchema = z.object({
  notes: z.string().optional(),
});

export const rejectIntentSchema = z.object({
  reason: z.string().optional(),
});

export const createClarificationSchema = z.object({
  questionId: z.string().optional(),
  questionText: z.string().min(1, 'Question text is required'),
  customMessage: z.string().optional(),
});

export const workItemStatusSchema = z.enum([
  'backlog',
  'ready',
  'in_progress',
  'blocked',
  'in_review',
  'completed',
  'cancelled',
]);

export const workItemPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
export const workProposalStatusSchema = z.enum(['draft', 'pending_review', 'approved', 'rejected']);
export const estimatedEffortSchema = z.enum(['small', 'medium', 'large']);

export const aiWorkProposalItemSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  priority: workItemPrioritySchema.default('medium'),
  estimatedEffort: estimatedEffortSchema.default('small'),
  sourceRequirementId: z.string().optional().nullable(),
  suggestedRole: z.string().default('developer'),
});

export const aiWorkProposalSchema = z.object({
  items: z.array(aiWorkProposalItemSchema).min(1, 'Proposal must contain at least one work item'),
});

export const createWorkItemSchema = z.object({
  intentId: z.string().optional().nullable(),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional().nullable(),
  priority: workItemPrioritySchema.default('medium'),
  status: workItemStatusSchema.default('backlog'),
  assignedTo: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  requirementIds: z.array(z.string()).optional(),
});

export const updateWorkItemSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  priority: workItemPrioritySchema.optional(),
  status: workItemStatusSchema.optional(),
  assignedTo: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
});

export const assignWorkItemSchema = z.object({
  assignedTo: z.string().min(1, 'Assignee User ID is required'),
});

export const updateWorkItemStatusSchema = z.object({
  status: workItemStatusSchema,
});

export const updateWorkProposalSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().optional(),
      title: z.string().min(1),
      description: z.string().optional().nullable(),
      priority: workItemPrioritySchema.optional(),
      estimatedEffort: estimatedEffortSchema.optional(),
      sourceRequirementId: z.string().optional().nullable(),
      suggestedRole: z.string().optional(),
      position: z.number().optional(),
    })
  ),
});

export const approveWorkProposalSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().optional(),
        title: z.string().min(1),
        description: z.string().optional().nullable(),
        priority: workItemPrioritySchema.optional(),
        estimatedEffort: estimatedEffortSchema.optional(),
        sourceRequirementId: z.string().optional().nullable(),
        suggestedRole: z.string().optional(),
        position: z.number().optional(),
      })
    )
    .optional(),
  assignees: z.record(z.string(), z.string()).optional(),
});

// PHASE 7 — DELIVERABLES, REVISIONS & MILESTONES SCHEMAS
export const createDeliverableSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  workItemIds: z.array(z.string()).optional(),
  attachmentIds: z.array(z.string()).optional(),
  milestoneId: z.string().optional(),
});

export const updateDeliverableSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  workItemIds: z.array(z.string()).optional(),
  attachmentIds: z.array(z.string()).optional(),
  milestoneId: z.string().optional(),
});

export const requestChangesSchema = z.object({
  comment: z.string().min(10, 'Comment must be at least 10 characters long when requesting changes'),
  description: z.string().optional(),
});

export const createMilestoneSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  position: z.number().optional(),
  dueDate: z.string().optional(),
});

export const updateMilestoneSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  position: z.number().optional(),
  dueDate: z.string().optional(),
  status: z.enum(['upcoming', 'in_progress', 'review', 'completed', 'blocked']).optional(),
});

export const updateRevisionStatusSchema = z.object({
  status: z.enum(['in_progress', 'resolved', 'cancelled']),
});

// PHASE 8 — PROJECT CLOSURE, HANDOFF & COMPLETION SCHEMAS
export const createClosureSchema = z.object({
  summary: z.string().optional(),
  completionNotes: z.string().optional(),
});

export const updateClosureSchema = z.object({
  summary: z.string().optional(),
  completionNotes: z.string().optional(),
  status: z
    .enum([
      'draft',
      'pending_client_approval',
      'changes_requested',
      'approved',
      'completed',
      'cancelled',
    ])
    .optional(),
});

export const submitClosureSchema = z.object({
  notes: z.string().optional(),
});

export const approveClosureSchema = z.object({
  comment: z.string().optional(),
});

export const requestClosureChangesSchema = z.object({
  comment: z.string().min(1, 'Comment is required when requesting completion changes'),
  description: z.string().optional(),
});

export const createHandoffItemSchema = z.object({
  type: z.enum(['deliverable', 'attachment', 'documentation', 'link', 'note']),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  referenceId: z.string().optional(),
  referenceUrl: z.string().optional(),
  position: z.number().optional(),
});

export const updateHandoffSchema = z.object({
  summary: z.string().optional(),
  items: z.array(createHandoffItemSchema).optional(),
});

export const updateChecklistSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  status: z.enum(['pending', 'completed', 'blocked']),
  required: z.boolean().default(true),
});

export const updateClosureRevisionStatusSchema = z.object({
  status: z.enum(['in_progress', 'resolved', 'cancelled']),
});

export const assignProjectMemberSchema = z.object({
  userId: z.string().uuid('Invalid User ID'),
  projectRole: projectRoleSchema,
});

export const updateProjectMemberRoleSchema = z.object({
  projectRole: projectRoleSchema,
});

export type SignupValidation = z.infer<typeof signupSchema>;
export type LoginValidation = z.infer<typeof loginSchema>;
export type CreateOrganizationValidation = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationValidation = z.infer<typeof updateOrganizationSchema>;
export type CreateInvitationValidation = z.infer<typeof createInvitationSchema>;
export type CreateProjectValidation = z.infer<typeof createProjectSchema>;
export type UpdateProjectValidation = z.infer<typeof updateProjectSchema>;
export type AddProjectMemberValidation = z.infer<typeof addProjectMemberSchema>;
export type AssignProjectMemberValidation = z.infer<typeof assignProjectMemberSchema>;
export type UpdateProjectMemberRoleValidation = z.infer<typeof updateProjectMemberRoleSchema>;
export type CreateConversationValidation = z.infer<typeof createConversationSchema>;
export type SendMessageValidation = z.infer<typeof sendMessageSchema>;
export type AddParticipantValidation = z.infer<typeof addParticipantSchema>;
export type AiStructuredOutputValidation = z.infer<typeof aiStructuredOutputSchema>;
export type UpdateIntentValidation = z.infer<typeof updateIntentSchema>;
export type ConfirmIntentValidation = z.infer<typeof confirmIntentSchema>;
export type RejectIntentValidation = z.infer<typeof rejectIntentSchema>;
export type CreateClarificationValidation = z.infer<typeof createClarificationSchema>;
export type AiWorkProposalValidation = z.infer<typeof aiWorkProposalSchema>;
export type CreateWorkItemValidation = z.infer<typeof createWorkItemSchema>;
export type UpdateWorkItemValidation = z.infer<typeof updateWorkItemSchema>;
export type AssignWorkItemValidation = z.infer<typeof assignWorkItemSchema>;
export type UpdateWorkItemStatusValidation = z.infer<typeof updateWorkItemStatusSchema>;
export type UpdateWorkProposalValidation = z.infer<typeof updateWorkProposalSchema>;
export type ApproveWorkProposalValidation = z.infer<typeof approveWorkProposalSchema>;
export type CreateDeliverableValidation = z.infer<typeof createDeliverableSchema>;
export type UpdateDeliverableValidation = z.infer<typeof updateDeliverableSchema>;
export type RequestChangesValidation = z.infer<typeof requestChangesSchema>;
export type CreateMilestoneValidation = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneValidation = z.infer<typeof updateMilestoneSchema>;
export type UpdateRevisionStatusValidation = z.infer<typeof updateRevisionStatusSchema>;
export type CreateClosureValidation = z.infer<typeof createClosureSchema>;
export type UpdateClosureValidation = z.infer<typeof updateClosureSchema>;
export type RequestClosureChangesValidation = z.infer<typeof requestClosureChangesSchema>;
export type CreateHandoffItemValidation = z.infer<typeof createHandoffItemSchema>;
export type UpdateHandoffValidation = z.infer<typeof updateHandoffSchema>;
export type UpdateChecklistValidation = z.infer<typeof updateChecklistSchema>;
