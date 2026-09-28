import { Notification } from '@intentflow/types';

/**
 * Maps notification metadata to the appropriate target URL/tab
 */
export function getNotificationTargetUrl(n: Notification): string {
  const type = n.type;
  const projectId = n.projectId;

  if (type.startsWith('organization_')) {
    return '/settings';
  }

  if (!projectId) {
    return '/dashboard';
  }

  if (
    type === 'project_member_assigned' ||
    type === 'project_member_role_changed' ||
    type === 'project_member_removed'
  ) {
    return `/projects/${projectId}?tab=team`;
  }

  if (
    type.startsWith('closure_') ||
    type === 'project_completed' ||
    type.startsWith('handoff_')
  ) {
    return `/projects/${projectId}?tab=completion`;
  }

  if (
    type.startsWith('deliverable_') ||
    type.startsWith('revision_') ||
    type === 'milestone_completed'
  ) {
    return `/projects/${projectId}?tab=deliverables`;
  }

  if (type === 'message_received' || n.entityType === 'conversation') {
    return `/projects/${projectId}?tab=conversations`;
  }

  if (
    type.startsWith('work_') ||
    type.startsWith('intent_') ||
    type === 'clarification_requested'
  ) {
    return `/projects/${projectId}?tab=work`;
  }

  return `/projects/${projectId}?tab=overview`;
}

/**
 * Returns human readable relative time (e.g., "5 min ago", "2 hours ago", "Yesterday")
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 0) return 'Just now';

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Returns an icon label for notification type
 */
export function getNotificationTypeIcon(type: string): string {
  if (type.startsWith('deliverable_')) return '📦';
  if (type.startsWith('closure_') || type.startsWith('handoff_') || type === 'project_completed') return '✅';
  if (type.startsWith('work_') || type.startsWith('intent_')) return '⚡';
  if (type === 'message_received') return '💬';
  if (type.startsWith('project_member_') || type.startsWith('organization_')) return '👥';
  if (type === 'milestone_completed') return '🎉';
  return '🔔';
}
