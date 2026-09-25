import { z } from 'zod';

/**
 * Validation Schemas for IntentFlow (Phase 1 Foundation)
 */

export const userRoleSchema = z.enum(['client', 'developer', 'admin']);

export const healthCheckResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  timestamp: z.string().optional(),
  environment: z.string().optional(),
});

export type UserRoleValidation = z.infer<typeof userRoleSchema>;
export type HealthCheckResponseValidation = z.infer<typeof healthCheckResponseSchema>;
