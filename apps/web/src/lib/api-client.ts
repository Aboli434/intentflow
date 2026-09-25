import {
  User,
  Organization,
  OrganizationMember,
  OrganizationInvitation,
  Project,
  AuthSession,
  HealthStatus,
} from '@intentflow/types';
import {
  SignupValidation,
  LoginValidation,
  CreateOrganizationValidation,
  CreateInvitationValidation,
  CreateProjectValidation,
} from '@intentflow/validation';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function getAuthHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('intentflow_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok || !json.success) {
    const errorMsg = json.error?.message || `HTTP Error ${res.status}`;
    throw new Error(errorMsg);
  }
  return json.data as T;
}

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE_URL}/health`, { cache: 'no-store' });
  return handleResponse<HealthStatus>(res);
}

// AUTH API
export async function apiSignup(data: SignupValidation): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await handleResponse<{ token: string; user: User }>(res);
  if (typeof window !== 'undefined') {
    localStorage.setItem('intentflow_token', result.token);
  }
  return result;
}

export async function apiLogin(data: LoginValidation): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await handleResponse<{ token: string; user: User }>(res);
  if (typeof window !== 'undefined') {
    localStorage.setItem('intentflow_token', result.token);
  }
  return result;
}

export async function apiLogout(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
  } finally {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('intentflow_token');
    }
  }
}

export async function apiGetMe(): Promise<{ user: User; memberships: (OrganizationMember & { organization: Organization })[] }> {
  const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: { ...getAuthHeader() },
    cache: 'no-store',
  });
  return handleResponse<{ user: User; memberships: (OrganizationMember & { organization: Organization })[] }>(res);
}

// ORGANIZATIONS API
export async function apiCreateOrganization(data: CreateOrganizationValidation): Promise<Organization & { role: string }> {
  const res = await fetch(`${API_BASE_URL}/api/organizations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(data),
  });
  return handleResponse<Organization & { role: string }>(res);
}

export async function apiGetOrganizations(): Promise<(Organization & { role: string })[]> {
  const res = await fetch(`${API_BASE_URL}/api/organizations`, {
    headers: { ...getAuthHeader() },
    cache: 'no-store',
  });
  return handleResponse<(Organization & { role: string })[]>(res);
}

export async function apiGetOrgMembers(orgId: string): Promise<OrganizationMember[]> {
  const res = await fetch(`${API_BASE_URL}/api/organizations/${orgId}/members`, {
    headers: { ...getAuthHeader() },
    cache: 'no-store',
  });
  return handleResponse<OrganizationMember[]>(res);
}

export async function apiInviteMember(orgId: string, data: CreateInvitationValidation): Promise<OrganizationInvitation> {
  const res = await fetch(`${API_BASE_URL}/api/organizations/${orgId}/invitations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(data),
  });
  return handleResponse<OrganizationInvitation>(res);
}

// INVITATION PREVIEW / ACCEPT
export async function apiGetInvitation(token: string): Promise<{ id: string; email: string; role: string; organizationName: string; isExpired: boolean; isAccepted: boolean }> {
  const res = await fetch(`${API_BASE_URL}/api/invitations/${token}`, { cache: 'no-store' });
  return handleResponse<{ id: string; email: string; role: string; organizationName: string; isExpired: boolean; isAccepted: boolean }>(res);
}

export async function apiAcceptInvitation(token: string): Promise<{ organizationId: string; role: string }> {
  const res = await fetch(`${API_BASE_URL}/api/invitations/${token}/accept`, {
    method: 'POST',
    headers: { ...getAuthHeader() },
  });
  return handleResponse<{ organizationId: string; role: string }>(res);
}

// PROJECTS API
export async function apiCreateProject(data: CreateProjectValidation): Promise<Project> {
  const res = await fetch(`${API_BASE_URL}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(data),
  });
  return handleResponse<Project>(res);
}

export async function apiGetProjects(): Promise<Project[]> {
  const res = await fetch(`${API_BASE_URL}/api/projects`, {
    headers: { ...getAuthHeader() },
    cache: 'no-store',
  });
  return handleResponse<Project[]>(res);
}

export async function apiGetProjectDetail(projectId: string): Promise<Project> {
  const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
    headers: { ...getAuthHeader() },
    cache: 'no-store',
  });
  return handleResponse<Project>(res);
}
