import {
  User,
  Organization,
  OrganizationMember,
  OrganizationInvitation,
  Project,
  Conversation,
  Message,
  MessageAttachment,
  RealtimeMessageEvent,
  HealthStatus,
  Intent,
  WorkItem,
  WorkProposal,
  WorkItemActivity,
  WorkItemStatus,
  Notification,
  ProjectActivity,
  Deliverable,
  ClientReview,
  RevisionRequest,
  ProjectMilestone,
  ProjectClosure,
  ClosureReview,
  ClosureRevisionRequest,
  ProjectHandoff,
  HandoffItem,
  ProjectCompletionChecklist,
  ProjectCompletionEligibility,
} from '@intentflow/types';
import {
  SignupValidation,
  LoginValidation,
  CreateOrganizationValidation,
  CreateInvitationValidation,
  CreateProjectValidation,
  CreateConversationValidation,
  SendMessageValidation,
  UpdateIntentValidation,
  CreateClarificationValidation,
  CreateWorkItemValidation,
  UpdateWorkItemValidation,
  CreateDeliverableValidation,
  UpdateDeliverableValidation,
  RequestChangesValidation,
  CreateMilestoneValidation,
  UpdateMilestoneValidation,
  UpdateRevisionStatusValidation,
  CreateClosureValidation,
  UpdateClosureValidation,
  RequestClosureChangesValidation,
  CreateHandoffItemValidation,
  UpdateHandoffValidation,
  UpdateChecklistValidation,
} from '@intentflow/validation';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function getAuthHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('intentflow_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('intentflow_token');
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
    const token = getStoredToken();
    if (token) {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    }
  } catch {
    // Proceed with local storage cleanup regardless of network/auth error
  } finally {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('intentflow_token');
      localStorage.removeItem('intentflow_user');
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

export async function apiUpdateOrgMemberRole(orgId: string, memberId: string, role: string): Promise<OrganizationMember> {
  const res = await fetch(`${API_BASE_URL}/api/organizations/${orgId}/members/${memberId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ role }),
  });
  return handleResponse<OrganizationMember>(res);
}

export async function apiRemoveOrgMember(orgId: string, memberId: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/organizations/${orgId}/members/${memberId}`, {
    method: 'DELETE',
    headers: { ...getAuthHeader() },
  });
  return handleResponse<{ message: string }>(res);
}

export async function apiGetOrgInvitations(orgId: string): Promise<OrganizationInvitation[]> {
  const res = await fetch(`${API_BASE_URL}/api/organizations/${orgId}/invitations`, {
    headers: { ...getAuthHeader() },
    cache: 'no-store',
  });
  return handleResponse<OrganizationInvitation[]>(res);
}

export async function apiInviteMember(orgId: string, data: CreateInvitationValidation): Promise<OrganizationInvitation> {
  const res = await fetch(`${API_BASE_URL}/api/organizations/${orgId}/invitations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(data),
  });
  return handleResponse<OrganizationInvitation>(res);
}

export async function apiCancelInvitation(invitationId: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/organization-invitations/${invitationId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({}),
  });
  return handleResponse<{ message: string }>(res);
}

export async function apiResendInvitation(invitationId: string): Promise<OrganizationInvitation> {
  const res = await fetch(`${API_BASE_URL}/api/organization-invitations/${invitationId}/resend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({}),
  });
  return handleResponse<OrganizationInvitation>(res);
}

// INVITATION PREVIEW / ACCEPT
export async function apiGetInvitation(token: string): Promise<{ id: string; email?: string; phone?: string; invitationMethod: string; role: string; organizationId: string; organizationName: string; isExpired: boolean; isAccepted: boolean }> {
  const res = await fetch(`${API_BASE_URL}/api/invitations/${token}`, { cache: 'no-store' });
  return handleResponse<{ id: string; email?: string; phone?: string; invitationMethod: string; role: string; organizationId: string; organizationName: string; isExpired: boolean; isAccepted: boolean }>(res);
}

export async function apiAcceptInvitation(token: string): Promise<{ organizationId: string; role: string }> {
  const res = await fetch(`${API_BASE_URL}/api/invitations/${token}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({}),
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

// CONVERSATIONS API
export async function apiGetProjectConversations(projectId: string): Promise<(Conversation & { unread?: boolean })[]> {
  const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/conversations`, {
    headers: { ...getAuthHeader() },
    cache: 'no-store',
  });
  return handleResponse<(Conversation & { unread?: boolean })[]>(res);
}

export async function apiCreateConversation(projectId: string, data: CreateConversationValidation): Promise<Conversation> {
  const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(data),
  });
  return handleResponse<Conversation>(res);
}

export async function apiGetConversationDetail(conversationId: string): Promise<Conversation> {
  const res = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`, {
    headers: { ...getAuthHeader() },
    cache: 'no-store',
  });
  return handleResponse<Conversation>(res);
}

export async function apiGetConversationMessages(
  conversationId: string,
  limit: number = 30,
  cursor?: string
): Promise<{ data: Message[]; nextCursor?: string }> {
  let url = `${API_BASE_URL}/api/conversations/${conversationId}/messages?limit=${limit}`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;

  const res = await fetch(url, {
    headers: { ...getAuthHeader() },
    cache: 'no-store',
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to fetch messages');
  }
  return { data: json.data, nextCursor: json.nextCursor };
}

export async function apiSendMessage(
  conversationId: string,
  data: SendMessageValidation
): Promise<Message> {
  const res = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(data),
  });
  return handleResponse<Message>(res);
}

export async function apiMarkConversationRead(conversationId: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/read`, {
    method: 'POST',
    headers: { ...getAuthHeader() },
  });
}

// ATTACHMENTS API
export async function apiUploadAttachment(projectId: string, file: File): Promise<MessageAttachment> {
  const formData = new FormData();
  formData.append('projectId', projectId);
  formData.append('file', file);

  const res = await fetch(`${API_BASE_URL}/api/attachments/upload`, {
    method: 'POST',
    headers: {
      ...getAuthHeader(),
    },
    body: formData,
  });
  return handleResponse<MessageAttachment>(res);
}

export function getAttachmentDownloadUrl(attachmentId: string): string {
  return `${API_BASE_URL}/api/attachments/${attachmentId}/download`;
}

// INTENTS API
export async function apiAnalyzeIntent(conversationId: string, orgId?: string): Promise<Intent> {
  const res = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/intents/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader(), ...(orgId ? { 'x-organization-id': orgId } : {}) },
  });
  return handleResponse<Intent>(res);
}

export async function apiGetConversationIntents(conversationId: string, orgId?: string): Promise<Intent[]> {
  const res = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/intents`, {
    headers: { ...getAuthHeader(), ...(orgId ? { 'x-organization-id': orgId } : {}) },
    cache: 'no-store',
  });
  return handleResponse<Intent[]>(res);
}

export async function apiGetIntentDetail(intentId: string, orgId?: string): Promise<Intent> {
  const res = await fetch(`${API_BASE_URL}/api/intents/${intentId}`, {
    headers: { ...getAuthHeader(), ...(orgId ? { 'x-organization-id': orgId } : {}) },
    cache: 'no-store',
  });
  return handleResponse<Intent>(res);
}

export async function apiUpdateIntent(intentId: string, data: UpdateIntentValidation, orgId?: string): Promise<Intent> {
  const res = await fetch(`${API_BASE_URL}/api/intents/${intentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader(), ...(orgId ? { 'x-organization-id': orgId } : {}) },
    body: JSON.stringify(data),
  });
  return handleResponse<Intent>(res);
}

export async function apiConfirmIntent(intentId: string, orgId?: string): Promise<Intent> {
  const res = await fetch(`${API_BASE_URL}/api/intents/${intentId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader(), ...(orgId ? { 'x-organization-id': orgId } : {}) },
    body: JSON.stringify({}),
  });
  return handleResponse<Intent>(res);
}

export async function apiRejectIntent(intentId: string, reason?: string, orgId?: string): Promise<Intent> {
  const res = await fetch(`${API_BASE_URL}/api/intents/${intentId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader(), ...(orgId ? { 'x-organization-id': orgId } : {}) },
    body: JSON.stringify({ reason }),
  });
  return handleResponse<Intent>(res);
}

export async function apiDismissQuestion(intentId: string, questionId: string, orgId?: string): Promise<Intent> {
  const res = await fetch(`${API_BASE_URL}/api/intents/${intentId}/questions/${questionId}/dismiss`, {
    method: 'POST',
    headers: { ...getAuthHeader(), ...(orgId ? { 'x-organization-id': orgId } : {}) },
  });
  return handleResponse<Intent>(res);
}

export async function apiCreateClarification(intentId: string, data: CreateClarificationValidation, orgId?: string): Promise<{ draftMessage: string; intent: Intent }> {
  const res = await fetch(`${API_BASE_URL}/api/intents/${intentId}/clarification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader(), ...(orgId ? { 'x-organization-id': orgId } : {}) },
    body: JSON.stringify(data),
  });
  return handleResponse<{ draftMessage: string; intent: Intent }>(res);
}

// WORK PROPOSALS & WORK ITEMS API
export async function apiGenerateWorkProposal(intentId: string, orgId?: string): Promise<WorkProposal> {
  const res = await fetch(`${API_BASE_URL}/api/intents/${intentId}/work-proposals/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader(), ...(orgId ? { 'x-organization-id': orgId } : {}) },
  });
  return handleResponse<WorkProposal>(res);
}

export async function apiGetIntentWorkProposals(intentId: string, orgId?: string): Promise<WorkProposal[]> {
  const res = await fetch(`${API_BASE_URL}/api/intents/${intentId}/work-proposals`, {
    headers: { ...getAuthHeader(), ...(orgId ? { 'x-organization-id': orgId } : {}) },
    cache: 'no-store',
  });
  return handleResponse<WorkProposal[]>(res);
}

export async function apiGetWorkProposalDetail(proposalId: string, orgId?: string): Promise<WorkProposal> {
  const res = await fetch(`${API_BASE_URL}/api/work-proposals/${proposalId}`, {
    headers: { ...getAuthHeader(), ...(orgId ? { 'x-organization-id': orgId } : {}) },
    cache: 'no-store',
  });
  return handleResponse<WorkProposal>(res);
}

export async function apiUpdateWorkProposal(proposalId: string, items: any[], orgId?: string): Promise<WorkProposal> {
  const res = await fetch(`${API_BASE_URL}/api/work-proposals/${proposalId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader(), ...(orgId ? { 'x-organization-id': orgId } : {}) },
    body: JSON.stringify({ items }),
  });
  return handleResponse<WorkProposal>(res);
}

export async function apiApproveWorkProposal(
  proposalId: string,
  payload?: { items?: any[]; assignees?: Record<string, string> },
  orgId?: string
): Promise<{ proposalId: string; workItems: WorkItem[] }> {
  const res = await fetch(`${API_BASE_URL}/api/work-proposals/${proposalId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader(), ...(orgId ? { 'x-organization-id': orgId } : {}) },
    body: JSON.stringify(payload || {}),
  });
  return handleResponse<{ proposalId: string; workItems: WorkItem[] }>(res);
}

export async function apiRejectWorkProposal(proposalId: string, orgId?: string): Promise<WorkProposal> {
  const res = await fetch(`${API_BASE_URL}/api/work-proposals/${proposalId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader(), ...(orgId ? { 'x-organization-id': orgId } : {}) },
  });
  return handleResponse<WorkProposal>(res);
}

export async function apiCreateWorkItem(projectId: string, data: CreateWorkItemValidation, orgId?: string): Promise<WorkItem> {
  const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/work`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader(), ...(orgId ? { 'x-organization-id': orgId } : {}) },
    body: JSON.stringify(data),
  });
  return handleResponse<WorkItem>(res);
}

export async function apiGetProjectWork(
  projectId: string,
  filters?: { status?: string; assignedTo?: string },
  orgId?: string
): Promise<{ workItems: WorkItem[]; metrics: any }> {
  let url = `${API_BASE_URL}/api/projects/${projectId}/work`;
  const queryParams: string[] = [];
  if (filters?.status) queryParams.push(`status=${encodeURIComponent(filters.status)}`);
  if (filters?.assignedTo) queryParams.push(`assignedTo=${encodeURIComponent(filters.assignedTo)}`);
  if (queryParams.length > 0) url += `?${queryParams.join('&')}`;

  const res = await fetch(url, {
    headers: { ...getAuthHeader(), ...(orgId ? { 'x-organization-id': orgId } : {}) },
    cache: 'no-store',
  });
  return handleResponse<{ workItems: WorkItem[]; metrics: any }>(res);
}

export async function apiGetWorkItemDetail(workItemId: string, orgId?: string): Promise<WorkItem> {
  const res = await fetch(`${API_BASE_URL}/api/work/${workItemId}`, {
    headers: { ...getAuthHeader(), ...(orgId ? { 'x-organization-id': orgId } : {}) },
    cache: 'no-store',
  });
  return handleResponse<WorkItem>(res);
}

export async function apiUpdateWorkItem(workItemId: string, data: UpdateWorkItemValidation, orgId?: string): Promise<WorkItem> {
  const res = await fetch(`${API_BASE_URL}/api/work/${workItemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader(), ...(orgId ? { 'x-organization-id': orgId } : {}) },
    body: JSON.stringify(data),
  });
  return handleResponse<WorkItem>(res);
}

export async function apiAssignWorkItem(workItemId: string, assignedTo: string, orgId?: string): Promise<WorkItem> {
  const res = await fetch(`${API_BASE_URL}/api/work/${workItemId}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader(), ...(orgId ? { 'x-organization-id': orgId } : {}) },
    body: JSON.stringify({ assignedTo }),
  });
  return handleResponse<WorkItem>(res);
}

export async function apiUpdateWorkItemStatus(workItemId: string, status: WorkItemStatus, orgId?: string): Promise<WorkItem> {
  const res = await fetch(`${API_BASE_URL}/api/work/${workItemId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader(), ...(orgId ? { 'x-organization-id': orgId } : {}) },
    body: JSON.stringify({ status }),
  });
  return handleResponse<WorkItem>(res);
}

export async function apiGetWorkItemActivity(workItemId: string, orgId?: string): Promise<WorkItemActivity[]> {
  const res = await fetch(`${API_BASE_URL}/api/work/${workItemId}/activity`, {
    headers: { ...getAuthHeader(), ...(orgId ? { 'x-organization-id': orgId } : {}) },
    cache: 'no-store',
  });
  return handleResponse<WorkItemActivity[]>(res);
}

// NOTIFICATIONS & PROJECT ACTIVITY API
export async function apiGetNotifications(options?: { limit?: number; unreadOnly?: boolean }): Promise<Notification[]> {
  let url = `${API_BASE_URL}/api/notifications?limit=${options?.limit || 30}`;
  if (options?.unreadOnly) url += '&unreadOnly=true';

  const res = await fetch(url, {
    headers: { ...getAuthHeader() },
    cache: 'no-store',
  });
  return handleResponse<Notification[]>(res);
}

export async function apiGetUnreadNotificationCount(): Promise<number> {
  const res = await fetch(`${API_BASE_URL}/api/notifications/unread-count`, {
    headers: { ...getAuthHeader() },
    cache: 'no-store',
  });
  const data = await handleResponse<{ count: number }>(res);
  return data.count;
}

export async function apiMarkNotificationRead(notificationId: string): Promise<Notification> {
  const res = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}/read`, {
    method: 'POST',
    headers: { ...getAuthHeader() },
  });
  return handleResponse<Notification>(res);
}

export async function apiMarkAllNotificationsRead(): Promise<{ count: number }> {
  const res = await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
    method: 'POST',
    headers: { ...getAuthHeader() },
  });
  return handleResponse<{ count: number }>(res);
}

export async function apiGetProjectActivity(projectId: string, limit: number = 50, orgId?: string): Promise<ProjectActivity[]> {
  const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/activity?limit=${limit}`, {
    headers: { ...getAuthHeader(), ...(orgId ? { 'x-organization-id': orgId } : {}) },
    cache: 'no-store',
  });
  return handleResponse<ProjectActivity[]>(res);
}

// PHASE 7 — DELIVERABLES & MILESTONES API
export async function apiGetProjectDeliverables(projectId: string): Promise<Deliverable[]> {
  const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/deliverables`, {
    headers: { ...getAuthHeader() },
    cache: 'no-store',
  });
  return handleResponse<Deliverable[]>(res);
}

export async function apiGetDeliverable(deliverableId: string): Promise<Deliverable> {
  const res = await fetch(`${API_BASE_URL}/api/deliverables/${deliverableId}`, {
    headers: { ...getAuthHeader() },
    cache: 'no-store',
  });
  return handleResponse<Deliverable>(res);
}

export async function apiCreateDeliverable(projectId: string, data: CreateDeliverableValidation): Promise<Deliverable> {
  const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/deliverables`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(data),
  });
  return handleResponse<Deliverable>(res);
}

export async function apiUpdateDeliverable(deliverableId: string, data: UpdateDeliverableValidation): Promise<Deliverable> {
  const res = await fetch(`${API_BASE_URL}/api/deliverables/${deliverableId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(data),
  });
  return handleResponse<Deliverable>(res);
}

export async function apiSubmitDeliverableForReview(deliverableId: string): Promise<Deliverable> {
  const res = await fetch(`${API_BASE_URL}/api/deliverables/${deliverableId}/submit-review`, {
    method: 'POST',
    headers: { ...getAuthHeader() },
  });
  return handleResponse<Deliverable>(res);
}

export async function apiApproveDeliverable(deliverableId: string, comment?: string): Promise<Deliverable> {
  const res = await fetch(`${API_BASE_URL}/api/deliverables/${deliverableId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ comment }),
  });
  return handleResponse<Deliverable>(res);
}

export async function apiRequestDeliverableChanges(deliverableId: string, comment: string): Promise<{ deliverable: Deliverable; revisionRequest: RevisionRequest }> {
  const res = await fetch(`${API_BASE_URL}/api/deliverables/${deliverableId}/request-changes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ comment }),
  });
  return handleResponse<{ deliverable: Deliverable; revisionRequest: RevisionRequest }>(res);
}

export async function apiGetDeliverableReviews(deliverableId: string): Promise<ClientReview[]> {
  const res = await fetch(`${API_BASE_URL}/api/deliverables/${deliverableId}/reviews`, {
    headers: { ...getAuthHeader() },
    cache: 'no-store',
  });
  return handleResponse<ClientReview[]>(res);
}

export async function apiGetDeliverableRevisions(deliverableId: string): Promise<RevisionRequest[]> {
  const res = await fetch(`${API_BASE_URL}/api/deliverables/${deliverableId}/revisions`, {
    headers: { ...getAuthHeader() },
    cache: 'no-store',
  });
  return handleResponse<RevisionRequest[]>(res);
}

export async function apiUpdateRevisionStatus(revisionId: string, status: 'in_progress' | 'resolved' | 'cancelled'): Promise<RevisionRequest> {
  const res = await fetch(`${API_BASE_URL}/api/revisions/${revisionId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ status }),
  });
  return handleResponse<RevisionRequest>(res);
}

export async function apiGetProjectMilestones(projectId: string): Promise<ProjectMilestone[]> {
  const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/milestones`, {
    headers: { ...getAuthHeader() },
    cache: 'no-store',
  });
  return handleResponse<ProjectMilestone[]>(res);
}

export async function apiGetMilestone(milestoneId: string): Promise<ProjectMilestone> {
  const res = await fetch(`${API_BASE_URL}/api/milestones/${milestoneId}`, {
    headers: { ...getAuthHeader() },
    cache: 'no-store',
  });
  return handleResponse<ProjectMilestone>(res);
}

export async function apiCreateMilestone(projectId: string, data: CreateMilestoneValidation): Promise<ProjectMilestone> {
  const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/milestones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(data),
  });
  return handleResponse<ProjectMilestone>(res);
}

export async function apiUpdateMilestone(milestoneId: string, data: UpdateMilestoneValidation): Promise<ProjectMilestone> {
  const res = await fetch(`${API_BASE_URL}/api/milestones/${milestoneId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(data),
  });
  return handleResponse<ProjectMilestone>(res);
}

export async function apiUpdateMilestoneStatus(milestoneId: string, status: string): Promise<ProjectMilestone> {
  const res = await fetch(`${API_BASE_URL}/api/milestones/${milestoneId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ status }),
  });
  return handleResponse<ProjectMilestone>(res);
}

export async function apiLinkDeliverableToMilestone(milestoneId: string, deliverableId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/milestones/${milestoneId}/deliverables`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ deliverableId }),
  });
  if (!res.ok) throw new Error('Failed to link deliverable');
}

export async function apiUnlinkDeliverableFromMilestone(milestoneId: string, deliverableId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/milestones/${milestoneId}/deliverables/${deliverableId}`, {
    method: 'DELETE',
    headers: { ...getAuthHeader() },
  });
  if (!res.ok) throw new Error('Failed to unlink deliverable');
}

// PHASE 8 — PROJECT CLOSURE, HANDOFF & COMPLETION API
export async function apiGetProjectCompletionStatus(projectId: string): Promise<ProjectCompletionEligibility> {
  const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/completion-status`, {
    headers: { ...getAuthHeader() },
    cache: 'no-store',
  });
  return handleResponse<ProjectCompletionEligibility>(res);
}

export async function apiGetProjectCompletionChecklist(projectId: string): Promise<ProjectCompletionChecklist[]> {
  const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/completion-checklist`, {
    headers: { ...getAuthHeader() },
    cache: 'no-store',
  });
  return handleResponse<ProjectCompletionChecklist[]>(res);
}

export async function apiUpdateChecklistItemStatus(checklistId: string, status: 'pending' | 'completed' | 'blocked'): Promise<ProjectCompletionChecklist[]> {
  const res = await fetch(`${API_BASE_URL}/api/completion-checklist/${checklistId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ status }),
  });
  return handleResponse<ProjectCompletionChecklist[]>(res);
}

export async function apiCreateProjectClosure(projectId: string, data: CreateClosureValidation): Promise<ProjectClosure> {
  const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/closure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(data),
  });
  return handleResponse<ProjectClosure>(res);
}

export async function apiGetProjectClosures(projectId: string): Promise<ProjectClosure[]> {
  const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/closures`, {
    headers: { ...getAuthHeader() },
    cache: 'no-store',
  });
  return handleResponse<ProjectClosure[]>(res);
}

export async function apiGetProjectClosureDetail(closureId: string): Promise<ProjectClosure> {
  const res = await fetch(`${API_BASE_URL}/api/project-closures/${closureId}`, {
    headers: { ...getAuthHeader() },
    cache: 'no-store',
  });
  return handleResponse<ProjectClosure>(res);
}

export async function apiSubmitProjectClosure(closureId: string, notes?: string): Promise<ProjectClosure> {
  const res = await fetch(`${API_BASE_URL}/api/project-closures/${closureId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ notes }),
  });
  return handleResponse<ProjectClosure>(res);
}

export async function apiApproveProjectClosure(closureId: string, comment?: string): Promise<{ closure: ProjectClosure; handoff: ProjectHandoff }> {
  const res = await fetch(`${API_BASE_URL}/api/project-closures/${closureId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ comment }),
  });
  return handleResponse<{ closure: ProjectClosure; handoff: ProjectHandoff }>(res);
}

export async function apiRequestClosureChanges(closureId: string, comment: string, description?: string): Promise<{ closure: ProjectClosure; revisionRequest: ClosureRevisionRequest }> {
  const res = await fetch(`${API_BASE_URL}/api/project-closures/${closureId}/request-changes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ comment, description }),
  });
  return handleResponse<{ closure: ProjectClosure; revisionRequest: ClosureRevisionRequest }>(res);
}

export async function apiUpdateClosureRevisionStatus(revisionId: string, status: 'in_progress' | 'resolved' | 'cancelled'): Promise<ClosureRevisionRequest> {
  const res = await fetch(`${API_BASE_URL}/api/closure-revisions/${revisionId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ status }),
  });
  return handleResponse<ClosureRevisionRequest>(res);
}

export async function apiGetProjectHandoff(projectId: string): Promise<ProjectHandoff> {
  const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/handoff`, {
    headers: { ...getAuthHeader() },
    cache: 'no-store',
  });
  return handleResponse<ProjectHandoff>(res);
}

export async function apiGenerateProjectHandoff(closureId: string): Promise<ProjectHandoff> {
  const res = await fetch(`${API_BASE_URL}/api/project-closures/${closureId}/handoff`, {
    method: 'POST',
    headers: { ...getAuthHeader() },
  });
  return handleResponse<ProjectHandoff>(res);
}

export async function apiAcknowledgeProjectHandoff(handoffId: string): Promise<ProjectHandoff> {
  const res = await fetch(`${API_BASE_URL}/api/handoffs/${handoffId}/acknowledge`, {
    method: 'POST',
    headers: { ...getAuthHeader() },
  });
  return handleResponse<ProjectHandoff>(res);
}

// REAL-TIME WEBSOCKET HELPER
export function connectConversationWebSocket(
  conversationId: string,
  onEvent: (event: RealtimeMessageEvent) => void,
  onStatusChange?: (connected: boolean) => void
): () => void {
  const token = getStoredToken();
  if (!token) return () => {};

  const wsUrl = (API_BASE_URL.replace(/^http/, 'ws')) + `/api/conversations/${conversationId}/ws?token=${encodeURIComponent(token)}`;
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    onStatusChange?.(true);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onEvent(data);
    } catch (err) {
      console.error('Failed to parse WebSocket message', err);
    }
  };

  ws.onclose = () => {
    onStatusChange?.(false);
  };

  ws.onerror = (err) => {
    console.error('WebSocket error:', err);
    onStatusChange?.(false);
  };

  return () => {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  };
}
