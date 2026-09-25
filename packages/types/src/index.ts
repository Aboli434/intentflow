/**
 * Shared Core Domain Types for IntentFlow
 */

export type UserRole = 'admin' | 'developer' | 'client';
export type ProjectRole = 'developer' | 'client';
export type ProjectStatus = 'active' | 'archived';

export type PolicyAction =
  | 'org:view'
  | 'org:update'
  | 'org:invite'
  | 'org:remove_member'
  | 'project:create'
  | 'project:view'
  | 'project:update'
  | 'project:delete'
  | 'project:manage_members'
  | 'project:client_approve';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: UserRole;
  createdAt: string;
  user?: User;
}

export interface OrganizationInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: UserRole;
  token: string;
  expiresAt: string;
  acceptedAt?: string | null;
  createdAt: string;
  organizationName?: string;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  organizationName?: string;
  members?: ProjectMember[];
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  createdAt: string;
  user?: User;
}

export interface AuthSession {
  token: string;
  user: User;
  memberships: (OrganizationMember & { organization: Organization })[];
}

export interface HealthStatus {
  status: 'ok';
  service: string;
  timestamp: string;
  database: 'connected' | 'disconnected';
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
