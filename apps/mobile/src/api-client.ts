import {
  User,
  Organization,
  Project,
  HealthStatus,
} from '@intentflow/types';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

let authToken: string | null = null;

export function setMobileAuthToken(token: string | null) {
  authToken = token;
}

export function getMobileAuthToken() {
  return authToken;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || `HTTP Error ${res.status}`);
  }

  return json.data as T;
}

export async function mobileHealthCheck(): Promise<HealthStatus> {
  return request<HealthStatus>('/health');
}

export async function mobileLogin(email: string, password: string): Promise<{ token: string; user: User }> {
  const data = await request<{ token: string; user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setMobileAuthToken(data.token);
  return data;
}

export async function mobileSignup(name: string, email: string, password: string): Promise<{ token: string; user: User }> {
  const data = await request<{ token: string; user: User }>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  setMobileAuthToken(data.token);
  return data;
}

export async function mobileGetMe(): Promise<{ user: User }> {
  return request<{ user: User }>('/api/auth/me');
}

export async function mobileGetProjects(): Promise<Project[]> {
  return request<Project[]>('/api/projects');
}

export async function mobileGetProjectDetail(projectId: string): Promise<Project> {
  return request<Project>(`/api/projects/${projectId}`);
}

export async function mobileLogout(): Promise<void> {
  try {
    await request('/api/auth/logout', { method: 'POST' });
  } finally {
    setMobileAuthToken(null);
  }
}
