import { z } from 'zod';

/**
 * Validation Schemas for IntentFlow (Phase 2 Foundation)
 */

export const userRoleSchema = z.enum(['admin', 'developer', 'client']);
export const projectRoleSchema = z.enum(['developer', 'client']);
export const projectStatusSchema = z.enum(['active', 'archived']);

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

export const createInvitationSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: userRoleSchema.default('developer'),
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

export const healthCheckResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  timestamp: z.string().optional(),
  database: z.enum(['connected', 'disconnected']),
});

export type SignupValidation = z.infer<typeof signupSchema>;
export type LoginValidation = z.infer<typeof loginSchema>;
export type CreateOrganizationValidation = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationValidation = z.infer<typeof updateOrganizationSchema>;
export type CreateInvitationValidation = z.infer<typeof createInvitationSchema>;
export type CreateProjectValidation = z.infer<typeof createProjectSchema>;
export type UpdateProjectValidation = z.infer<typeof updateProjectSchema>;
export type AddProjectMemberValidation = z.infer<typeof addProjectMemberSchema>;
