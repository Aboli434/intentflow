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
    await request('/api/auth/logout', { method: 'POST' });
  } finally {
    setMobileAuthToken(null);
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

