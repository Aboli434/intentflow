/**
 * Shared Core Domain Types for IntentFlow
 */

export type UserRole = 'admin' | 'developer' | 'client';
export type ProjectRole = 'client' | 'developer' | 'manager' | 'viewer';
export type ProjectStatus =
  | 'active'
  | 'closure_requested'
  | 'client_review'
  | 'changes_requested'
  | 'completed'
  | 'archived';
export type MessageType = 'text' | 'system';

export type PolicyAction =
  | 'org:view'
  | 'org:update'
  | 'org:invite'
  | 'org:remove_member'
  | 'org:invitation_view'
  | 'org:invitation_create'
  | 'org:invitation_cancel'
  | 'org:invitation_resend'
  | 'org:member_remove'
  | 'org:member_edit'
  | 'project:create'
  | 'project:view'
  | 'project:update'
  | 'project:delete'
  | 'project:manage_members'
  | 'project:client_approve'
  | 'project_member:view'
  | 'project_member:assign'
  | 'project_member:edit'
  | 'project_member:remove'
  | 'project_workspace:view'
  | 'project_workspace:manage'
  | 'conversation:create'
  | 'conversation:view'
  | 'conversation:manage_participants'
  | 'message:view'
  | 'message:send'
  | 'attachment:upload'
  | 'attachment:view'
  | 'intent:view'
  | 'intent:analyze'
  | 'intent:edit'
  | 'intent:confirm'
  | 'intent:reject'
  | 'intent:request_clarification'
  | 'work:view'
  | 'work:create'
  | 'work:edit'
  | 'work:assign'
  | 'work:change_status'
  | 'work:generate_proposal'
  | 'work:approve_proposal'
  | 'work:complete'
  | 'work:view_activity'
  | 'notification:view'
  | 'notification:mark_read'
  | 'activity:view'
  | 'deliverable:view'
  | 'deliverable:create'
  | 'deliverable:edit'
  | 'deliverable:submit_review'
  | 'deliverable:approve'
  | 'deliverable:request_changes'
  | 'review:view'
  | 'review:create'
  | 'revision:view'
  | 'revision:create'
  | 'revision:manage'
  | 'milestone:view'
  | 'milestone:create'
  | 'milestone:edit'
  | 'milestone:complete'
  | 'project:completion_view'
  | 'project:completion_manage'
  | 'project:closure_create'
  | 'project:closure_submit'
  | 'project:closure_view'
  | 'project:closure_approve'
  | 'project:closure_request_changes'
  | 'project:closure_revision_manage'
  | 'project:handoff_view'
  | 'project:handoff_manage'
  | 'project:handoff_acknowledge';

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

export type InvitationMethod = 'email' | 'sms';
export type InvitationStatus = 'pending' | 'sent' | 'delivery_failed' | 'accepted' | 'expired' | 'cancelled';

export interface OrganizationInvitation {
  id: string;
  organizationId: string;
  email?: string | null;
  phone?: string | null;
  invitationMethod: InvitationMethod;
  role: UserRole;
  token?: string;
  invitedBy?: string | null;
  status: InvitationStatus;
  expiresAt: string;
  acceptedAt?: string | null;
  sentAt?: string | null;
  deliveryStatus?: string | null;
  lastDeliveryAttempt?: string | null;
  failureReason?: string | null;
  createdAt: string;
  updatedAt?: string;
  organizationName?: string;
  inviterName?: string;
  isExpired?: boolean;
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

export interface Conversation {
  id: string;
  projectId: string;
  title: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: Message | null;
  unreadCount?: number;
  participantCount?: number;
  participants?: ConversationParticipant[];
}

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
  joinedAt: string;
  lastReadAt?: string | null;
  user?: User;
}

export interface MessageAttachment {
  id: string;
  messageId?: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  createdAt: string;
  downloadUrl?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  type: MessageType;
  createdAt: string;
  updatedAt: string;
  sender?: User;
  senderName?: string;
  senderEmail?: string;
  attachments?: MessageAttachment[];
}

export type IntentStatus =
  | 'processing'
  | 'ready_for_review'
  | 'confirmed'
  | 'rejected'
  | 'needs_clarification';

export type QuestionStatus = 'open' | 'resolved' | 'dismissed';

export interface IntentRequirement {
  id: string;
  intentId: string;
  text: string;
  confidence: number;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface IntentQuestion {
  id: string;
  intentId: string;
  question: string;
  status: QuestionStatus;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface IntentEvidence {
  id: string;
  intentId: string;
  messageId: string;
  attachmentId?: string | null;
  excerpt?: string | null;
  createdAt: string;
}

export interface IntentVersion {
  id: string;
  intentId: string;
  version: number;
  source: 'ai' | 'human';
  snapshot: Record<string, any>;
  createdBy?: string | null;
  createdAt: string;
}

export interface IntentProcessingRun {
  id: string;
  conversationId: string;
  intentId?: string | null;
  triggerMessageId?: string | null;
  provider: string;
  model: string;
  status: 'pending' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string | null;
  errorCode?: string | null;
}

export interface Intent {
  id: string;
  projectId: string;
  conversationId: string;
  createdBy: string;
  status: IntentStatus;
  origin: 'ai' | 'human';
  modifiedByHuman: boolean;
  title: string;
  summary: string;
  confidence: number;
  sourceMessageId?: string | null;
  rejectionReason?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  requirements?: IntentRequirement[];
  questions?: IntentQuestion[];
  evidence?: IntentEvidence[];
  versions?: IntentVersion[];
}

// PHASE 5 — WORK DOMAIN TYPES
export type WorkItemStatus =
  | 'backlog'
  | 'ready'
  | 'in_progress'
  | 'blocked'
  | 'in_review'
  | 'completed'
  | 'cancelled';

export type WorkItemPriority = 'low' | 'medium' | 'high' | 'urgent';

export type WorkProposalStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';

export type EstimatedEffort = 'small' | 'medium' | 'large';

export interface WorkItemRequirement {
  id: string;
  workItemId: string;
  requirementId: string;
  createdAt: string;
  requirementText?: string;
}

export interface WorkItemActivity {
  id: string;
  workItemId: string;
  actorId: string;
  type:
    | 'created'
    | 'assigned'
    | 'status_changed'
    | 'priority_changed'
    | 'commented'
    | 'blocked'
    | 'unblocked'
    | 'completed';
  metadata?: Record<string, any> | null;
  createdAt: string;
  actorName?: string;
}

export interface WorkItem {
  id: string;
  projectId: string;
  intentId?: string | null;
  title: string;
  description?: string | null;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  createdBy: string;
  assignedTo?: string | null;
  dueDate?: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  assigneeName?: string;
  assigneeEmail?: string;
  creatorName?: string;
  requirements?: WorkItemRequirement[];
  activities?: WorkItemActivity[];
  intentTitle?: string;
  conversationId?: string;
  sourceMessageId?: string | null;
}

export interface WorkProposalItem {
  id: string;
  proposalId: string;
  title: string;
  description?: string | null;
  priority: WorkItemPriority;
  estimatedEffort: EstimatedEffort;
  sourceRequirementId?: string | null;
  suggestedRole?: string;
  position: number;
  sourceRequirementText?: string;
}

export interface WorkProposal {
  id: string;
  projectId: string;
  intentId: string;
  createdBy?: string | null;
  status: WorkProposalStatus;
  generatedBy: 'ai' | 'human';
  createdAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  items?: WorkProposalItem[];
}

// PHASE 6 — NOTIFICATION & PROJECT ACTIVITY TYPES
export type NotificationType =
  | 'message_received'
  | 'intent_ready'
  | 'intent_confirmed'
  | 'clarification_requested'
  | 'work_assigned'
  | 'work_started'
  | 'work_blocked'
  | 'work_review'
  | 'work_completed'
  | 'project_update'
  | 'deliverable_ready'
  | 'deliverable_approved'
  | 'deliverable_changes_requested'
  | 'revision_started'
  | 'revision_resolved'
  | 'milestone_completed'
  | 'closure_submitted'
  | 'closure_approved'
  | 'closure_changes_requested'
  | 'closure_revision_started'
  | 'closure_revision_resolved'
  | 'project_completed'
  | 'handoff_ready'
  | 'handoff_delivered'
  | 'handoff_acknowledged'
  | 'organization_invitation_created'
  | 'organization_invitation_resent'
  | 'organization_member_added'
  | 'organization_member_removed'
  | 'organization_role_changed'
  | 'project_member_assigned'
  | 'project_member_role_changed'
  | 'project_member_removed';

export interface Notification {
  id: string;
  userId: string;
  organizationId: string;
  projectId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  entityType?: string | null;
  entityId?: string | null;
  readAt?: string | null;
  createdAt: string;
  projectName?: string | null;
}

export interface ProjectActivity {
  id: string;
  projectId: string;
  actorId?: string | null;
  type: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
  actorName?: string | null;
}

// PHASE 7 — CLIENT PORTAL, APPROVALS & DELIVERY TYPES
export type DeliverableStatus =
  | 'draft'
  | 'ready_for_review'
  | 'in_review'
  | 'changes_requested'
  | 'approved'
  | 'archived';

export type ClientReviewStatus = 'pending' | 'approved' | 'changes_requested';

export type RevisionRequestStatus = 'open' | 'in_progress' | 'resolved' | 'cancelled';

export type MilestoneStatus = 'upcoming' | 'in_progress' | 'review' | 'completed' | 'blocked';

export interface Deliverable {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  status: DeliverableStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  creatorName?: string;
  approverName?: string;
  linkedWorkItems?: WorkItem[];
  attachments?: MessageAttachment[];
  reviews?: ClientReview[];
  revisions?: RevisionRequest[];
  milestone?: ProjectMilestone | null;
}

export interface ClientReview {
  id: string;
  deliverableId: string;
  clientId: string;
  status: ClientReviewStatus;
  comment?: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  clientName?: string;
}

export interface RevisionRequest {
  id: string;
  deliverableId: string;
  clientId: string;
  description: string;
  status: RevisionRequestStatus;
  createdAt: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  clientName?: string;
  resolverName?: string;
}

export interface ProjectMilestone {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  status: MilestoneStatus;
  position: number;
  dueDate?: string | null;
  completedAt?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deliverables?: Deliverable[];
}

// PHASE 8 — PROJECT CLOSURE, HANDOFF & COMPLETION TYPES
export type ProjectClosureStatus =
  | 'draft'
  | 'pending_client_approval'
  | 'changes_requested'
  | 'approved'
  | 'completed'
  | 'cancelled';

export type ClosureReviewStatus = 'pending' | 'approved' | 'changes_requested';

export type ClosureRevisionStatus = 'open' | 'in_progress' | 'resolved' | 'cancelled';

export type ProjectHandoffStatus = 'pending' | 'ready' | 'delivered' | 'acknowledged';

export type HandoffItemType = 'deliverable' | 'attachment' | 'documentation' | 'link' | 'note';

export type CompletionChecklistStatus = 'pending' | 'completed' | 'blocked';

export interface ProjectClosure {
  id: string;
  projectId: string;
  status: ProjectClosureStatus;
  summary?: string | null;
  completionNotes?: string | null;
  createdBy: string;
  submittedAt?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  creatorName?: string;
  approverName?: string;
  reviews?: ClosureReview[];
  revisions?: ClosureRevisionRequest[];
  handoff?: ProjectHandoff | null;
}

export interface ClosureReview {
  id: string;
  closureId: string;
  clientId: string;
  status: ClosureReviewStatus;
  comment?: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  clientName?: string;
}

export interface ClosureRevisionRequest {
  id: string;
  closureId: string;
  clientId: string;
  description: string;
  status: ClosureRevisionStatus;
  resolvedBy?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  clientName?: string;
  resolverName?: string;
}

export interface HandoffItem {
  id: string;
  handoffId: string;
  type: HandoffItemType;
  title: string;
  description?: string | null;
  referenceId?: string | null;
  referenceUrl?: string | null;
  position: number;
  createdAt: string;
}

export interface ProjectHandoff {
  id: string;
  projectId: string;
  closureId: string;
  handoffStatus: ProjectHandoffStatus;
  summary?: string | null;
  deliverablesCount: number;
  completedWorkCount: number;
  approvedDeliverablesCount: number;
  createdBy: string;
  deliveredAt?: string | null;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  creatorName?: string;
  acknowledgedByName?: string;
  items?: HandoffItem[];
}

export interface ProjectCompletionChecklist {
  id: string;
  projectId: string;
  key: string;
  label: string;
  status: CompletionChecklistStatus;
  required: boolean;
  completedBy?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  completedByName?: string;
}

export interface ProjectCompletionBlocker {
  key: string;
  label: string;
  entityType: string;
  entityId?: string;
}

export interface ProjectCompletionEligibility {
  eligible: boolean;
  blockers: ProjectCompletionBlocker[];
  completedWorkCount: number;
  totalWorkCount: number;
  approvedDeliverablesCount: number;
  totalDeliverablesCount: number;
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

export interface ProjectMemberDetail {
  id: string;
  projectId: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  organizationRole: UserRole;
  projectRole: ProjectRole;
  assignedAt: string;
  assignedBy?: string | null;
}

export interface ProjectMemberActivity {
  id: string;
  projectId: string;
  userId: string;
  actorId: string;
  action: 'member_assigned' | 'member_role_changed' | 'member_removed';
  metadata?: Record<string, any> | null;
  createdAt: string;
  actorName?: string;
  targetUserName?: string;
}

export interface AvailableOrgMember {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  organizationRole: UserRole;
}

export type RealtimeMessageEvent =
  | { type: 'conversation.message.created'; conversationId: string; message: Message }
  | { type: 'conversation.message.updated'; conversationId: string; message: Message }
  | { type: 'conversation.participant.joined'; conversationId: string; participant: ConversationParticipant }
  | { type: 'conversation.participant.left'; conversationId: string; userId: string }
  | { type: 'intent.processing'; conversationId: string; runId: string }
  | { type: 'intent.ready'; conversationId: string; intent: Intent }
  | { type: 'intent.updated'; conversationId: string; intent: Intent }
  | { type: 'intent.confirmed'; conversationId: string; intent: Intent }
  | { type: 'intent.rejected'; conversationId: string; intentId: string; reason?: string }
  | { type: 'work.created'; projectId: string; workItem: WorkItem }
  | { type: 'work.updated'; projectId: string; workItem: WorkItem }
  | { type: 'work.assigned'; projectId: string; workItemId: string; assignedTo: string | null }
  | { type: 'work.status_changed'; projectId: string; workItemId: string; status: WorkItemStatus }
  | { type: 'work.completed'; projectId: string; workItemId: string }
  | { type: 'work_proposal.ready'; projectId: string; proposal: WorkProposal }
  | { type: 'work_proposal.approved'; projectId: string; proposalId: string; workItems: WorkItem[] }
  | { type: 'work_proposal.rejected'; projectId: string; proposalId: string }
  | { type: 'notification.created'; notification: Notification }
  | { type: 'notification.read'; notificationId: string }
  | { type: 'deliverable.created'; projectId: string; deliverable: Deliverable }
  | { type: 'deliverable.updated'; projectId: string; deliverable: Deliverable }
  | { type: 'deliverable.submitted'; projectId: string; deliverable: Deliverable }
  | { type: 'deliverable.approved'; projectId: string; deliverable: Deliverable }
  | { type: 'deliverable.changes_requested'; projectId: string; deliverable: Deliverable; revisionRequest: RevisionRequest }
  | { type: 'revision.created'; projectId: string; revisionRequest: RevisionRequest }
  | { type: 'revision.updated'; projectId: string; revisionRequest: RevisionRequest }
  | { type: 'milestone.created'; projectId: string; milestone: ProjectMilestone }
  | { type: 'milestone.updated'; projectId: string; milestone: ProjectMilestone }
  | { type: 'milestone.completed'; projectId: string; milestoneId: string }
  | { type: 'closure.created'; projectId: string; closure: ProjectClosure }
  | { type: 'closure.submitted'; projectId: string; closure: ProjectClosure }
  | { type: 'closure.approved'; projectId: string; closure: ProjectClosure }
  | { type: 'closure.changes_requested'; projectId: string; closure: ProjectClosure; revisionRequest: ClosureRevisionRequest }
  | { type: 'closure.revision_created'; projectId: string; revisionRequest: ClosureRevisionRequest }
  | { type: 'closure.revision_updated'; projectId: string; revisionRequest: ClosureRevisionRequest }
  | { type: 'handoff.created'; projectId: string; handoff: ProjectHandoff }
  | { type: 'handoff.delivered'; projectId: string; handoff: ProjectHandoff }
  | { type: 'handoff.acknowledged'; projectId: string; handoff: ProjectHandoff }
  | { type: 'project.completed'; projectId: string }
  | { type: 'project.member_assigned'; projectId: string; member: ProjectMemberDetail }
  | { type: 'project.member_role_changed'; projectId: string; memberId: string; projectRole: ProjectRole }
  | { type: 'project.member_removed'; projectId: string; memberId: string }
  | { event: string; data: any };
