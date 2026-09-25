/**
 * Shared Core Domain Types for IntentFlow (Phase 1 Foundation)
 */

export type UserRole = 'client' | 'developer' | 'admin';

export interface HealthStatus {
  status: 'ok';
  service: string;
  timestamp: string;
  environment: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
