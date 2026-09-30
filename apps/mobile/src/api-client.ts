import {
  User,
  Organization,
  Project,
  Conversation,
  Message,
  RealtimeMessageEvent,
  HealthStatus,
  WorkItem,
  WorkItemStatus,
  Notification,
  Deliverable,
  RevisionRequest,
  ProjectMilestone,
} from '@intentflow/types';

import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

const TOKEN_KEY = '@intentflow_mobile_token';
const ROLE_KEY = '@intentflow_mobile_role';
const USER_KEY = '@intentflow_mobile_user';

let authToken: string | null = null;
let currentDemoRole: string | null = null;

export async function initMobileAuth(): Promise<string | null> {
  try {
    const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
    authToken = storedToken;
    currentDemoRole = await AsyncStorage.getItem(ROLE_KEY);
    return authToken;
  } catch {
    return null;
  }
}

export async function setMobileAuthToken(token: string | null, role?: string | null) {
  authToken = token;
  currentDemoRole = role || null;
  try {
    if (token) {
      await AsyncStorage.setItem(TOKEN_KEY, token);
      if (role) {
        await AsyncStorage.setItem(ROLE_KEY, role);
      } else {
        await AsyncStorage.removeItem(ROLE_KEY);
      }
    } else {
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem(ROLE_KEY);
      await AsyncStorage.removeItem(USER_KEY);
    }
  } catch (err) {
    console.error('AsyncStorage auth error:', err);
  }
}

export function getMobileAuthToken() {
  return authToken;
}

export function getMobileDemoRole(): string | null {
  return currentDemoRole;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error('Unable to connect to IntentFlow. Please check your network connection.');
  }

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Server returned status ${res.status}`);
  }

  if (res.status === 401) {
    await setMobileAuthToken(null);
    throw new Error('Your session has expired. Please sign in again.');
  }

  if (res.status === 403) {
    throw new Error("You don't have permission to perform this action.");
  }

  if (!res.ok || (json && json.success === false)) {
    throw new Error(json?.error?.message || `HTTP Error ${res.status}`);
  }

  return (json?.data !== undefined ? json.data : json) as T;
}

export async function mobileHealthCheck(): Promise<HealthStatus> {
  return request<HealthStatus>('/health');
}

export async function mobileDemoLogin(role: 'admin' | 'developer' | 'client'): Promise<{ token: string; user: User }> {
  const data = await request<{ token: string; user: User }>('/api/auth/demo-login', {
    method: 'POST',
    body: JSON.stringify({ role }),
  });
  await setMobileAuthToken(data.token, role);
  return data;
}

export async function mobileLogin(email: string, password: string): Promise<{ token: string; user: User }> {
  const data = await request<{ token: string; user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  await setMobileAuthToken(data.token, null);
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

export async function mobileGetProjectConversations(projectId: string): Promise<(Conversation & { unread?: boolean })[]> {
  return request<(Conversation & { unread?: boolean })[]>(`/api/projects/${projectId}/conversations`);
}

export async function mobileCreateConversation(projectId: string, title: string): Promise<Conversation> {
  return request<Conversation>(`/api/projects/${projectId}/conversations`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export async function mobileGetConversationMessages(conversationId: string, limit: number = 30): Promise<Message[]> {
  return request<Message[]>(`/api/conversations/${conversationId}/messages?limit=${limit}`);
}

export async function mobileSendMessage(conversationId: string, body: string): Promise<Message> {
  return request<Message>(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

export async function mobileMarkConversationRead(conversationId: string): Promise<void> {
  await request(`/api/conversations/${conversationId}/read`, { method: 'POST' });
}

export async function mobileGetProjectWork(
  projectId: string,
  filters?: { status?: string; assignedTo?: string }
): Promise<{ workItems: WorkItem[]; metrics: any }> {
  let url = `/api/projects/${projectId}/work`;
  const queryParams: string[] = [];
  if (filters?.status) queryParams.push(`status=${encodeURIComponent(filters.status)}`);
  if (filters?.assignedTo) queryParams.push(`assignedTo=${encodeURIComponent(filters.assignedTo)}`);
  if (queryParams.length > 0) url += `?${queryParams.join('&')}`;

  return request<{ workItems: WorkItem[]; metrics: any }>(url);
}

export async function mobileUpdateWorkItemStatus(
  workItemId: string,
  status: WorkItemStatus
): Promise<WorkItem> {
  return request<WorkItem>(`/api/work/${workItemId}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

export async function mobileGetNotifications(options?: { unreadOnly?: boolean }): Promise<Notification[]> {
  let url = `/api/notifications?limit=30`;
  if (options?.unreadOnly) url += '&unreadOnly=true';
  return request<Notification[]>(url);
}

export async function mobileGetUnreadNotificationCount(): Promise<number> {
  const data = await request<{ count: number }>('/api/notifications/unread-count');
  return data.count;
}

export async function mobileMarkNotificationRead(notificationId: string): Promise<Notification> {
  return request<Notification>(`/api/notifications/${notificationId}/read`, { method: 'POST' });
}

export async function mobileMarkAllNotificationsRead(): Promise<{ count: number }> {
  return request<{ count: number }>('/api/notifications/read-all', { method: 'POST' });
}

export function connectMobileConversationWebSocket(
  conversationId: string,
  onEvent: (event: RealtimeMessageEvent) => void
): () => void {
  if (!authToken) return () => {};

  const wsUrl = (API_URL.replace(/^http/, 'ws')) + `/api/conversations/${conversationId}/ws?token=${encodeURIComponent(authToken)}`;
  const ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onEvent(data);
    } catch (err) {
      console.error('Mobile WS parse error:', err);
    }
  };

  return () => {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  };
}

export async function mobileLogout(): Promise<void> {
  try {
    await request('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });
  } finally {
    await setMobileAuthToken(null);
  }
}

// PHASE 7 — DELIVERABLES & MILESTONES MOBILE API
export async function mobileGetProjectDeliverables(projectId: string): Promise<Deliverable[]> {
  return request<Deliverable[]>(`/api/projects/${projectId}/deliverables`);
}

export async function mobileGetDeliverableDetail(deliverableId: string): Promise<Deliverable> {
  return request<Deliverable>(`/api/deliverables/${deliverableId}`);
}

export async function mobileApproveDeliverable(deliverableId: string, comment?: string): Promise<Deliverable> {
  return request<Deliverable>(`/api/deliverables/${deliverableId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
}

export async function mobileRequestDeliverableChanges(deliverableId: string, comment: string): Promise<{ deliverable: Deliverable; revisionRequest: RevisionRequest }> {
  return request<{ deliverable: Deliverable; revisionRequest: RevisionRequest }>(`/api/deliverables/${deliverableId}/request-changes`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
}

export async function mobileGetProjectMilestones(projectId: string): Promise<ProjectMilestone[]> {
  return request<ProjectMilestone[]>(`/api/projects/${projectId}/milestones`);
}

// PHASE 8 — PROJECT CLOSURE, HANDOFF & COMPLETION MOBILE API
export async function mobileGetProjectCompletionStatus(projectId: string): Promise<any> {
  return request<any>(`/api/projects/${projectId}/completion-status`);
}

export async function mobileGetProjectCompletionChecklist(projectId: string): Promise<any[]> {
  return request<any[]>(`/api/projects/${projectId}/completion-checklist`);
}

export async function mobileGetProjectClosures(projectId: string): Promise<any[]> {
  return request<any[]>(`/api/projects/${projectId}/closures`);
}

export async function mobileApproveProjectClosure(closureId: string, comment?: string): Promise<any> {
  return request<any>(`/api/project-closures/${closureId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
}

export async function mobileRequestClosureChanges(closureId: string, comment: string): Promise<any> {
  return request<any>(`/api/project-closures/${closureId}/request-changes`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
}

export async function mobileGetProjectHandoff(projectId: string): Promise<any> {
  return request<any>(`/api/projects/${projectId}/handoff`);
}

export async function mobileAcknowledgeProjectHandoff(handoffId: string): Promise<any> {
  return request<any>(`/api/handoffs/${handoffId}/acknowledge`, {
    method: 'POST',
  });
}

// PHASE 9 — MULTI-CHANNEL TEAM INVITATIONS & MEMBER MANAGEMENT MOBILE API
export async function mobileGetOrganizations(): Promise<Organization[]> {
  return request<Organization[]>('/api/organizations');
}

export async function mobileGetOrgMembers(orgId: string): Promise<any[]> {
  return request<any[]>(`/api/organizations/${orgId}/members`);
}

export async function mobileGetOrgInvitations(orgId: string): Promise<any[]> {
  return request<any[]>(`/api/organizations/${orgId}/invitations`);
}

export async function mobileInviteMember(orgId: string, data: { method: 'email' | 'sms'; email?: string; phone?: string; role: string }): Promise<any> {
  return request<any>(`/api/organizations/${orgId}/invitations`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function mobileCancelInvitation(invitationId: string): Promise<any> {
  return request<any>(`/api/organization-invitations/${invitationId}/cancel`, {
    method: 'POST',
  });
}

export async function mobileResendInvitation(invitationId: string): Promise<any> {
  return request<any>(`/api/organization-invitations/${invitationId}/resend`, {
    method: 'POST',
  });
}

export async function mobileUpdateOrgMemberRole(orgId: string, memberId: string, role: string): Promise<any> {
  return request<any>(`/api/organizations/${orgId}/members/${memberId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function mobileRemoveOrgMember(orgId: string, memberId: string): Promise<any> {
  return request<any>(`/api/organizations/${orgId}/members/${memberId}`, {
    method: 'DELETE',
  });
}

// PHASE 10 — PROJECT TEAM MOBILE API
export async function mobileGetProjectMembers(projectId: string): Promise<any> {
  const res = await request<{ members: any[] }>(`/api/projects/${projectId}/members`);
  return res.members;
}

export async function mobileGetAvailableProjectMembers(projectId: string): Promise<any> {
  const res = await request<{ members: any[] }>(`/api/projects/${projectId}/available-members`);
  return res.members;
}

export async function mobileAssignProjectMember(
  projectId: string,
  userId: string,
  projectRole: string
): Promise<any> {
  return request<any>(`/api/projects/${projectId}/members`, {
    method: 'POST',
    body: JSON.stringify({ userId, projectRole }),
  });
}

export async function mobileUpdateProjectMemberRole(
  projectId: string,
  memberId: string,
  projectRole: string
): Promise<any> {
  return request<any>(`/api/projects/${projectId}/members/${memberId}`, {
    method: 'PATCH',
    body: JSON.stringify({ projectRole }),
  });
}

export async function mobileRemoveProjectMember(
  projectId: string,
  memberId: string
): Promise<any> {
  return request<any>(`/api/projects/${projectId}/members/${memberId}`, {
    method: 'DELETE',
  });
}

