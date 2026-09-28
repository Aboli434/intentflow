'use client';

import React from 'react';
import { Badge, BadgeVariant } from './Badge';

interface StatusBadgeProps {
  status: string;
  type?: 'work' | 'deliverable' | 'closure' | 'project' | 'intent';
}

export function StatusBadge({ status, type = 'work' }: StatusBadgeProps) {
  const normalized = status.toLowerCase();

  let variant: BadgeVariant = 'slate';
  let label = status.replace(/_/g, ' ');

  if (type === 'work') {
    switch (normalized) {
      case 'completed':
        variant = 'emerald';
        label = '✓ Completed';
        break;
      case 'in_progress':
        variant = 'indigo';
        label = '⚡ In Progress';
        break;
      case 'blocked':
        variant = 'rose';
        label = '⚠️ Blocked';
        break;
      case 'in_review':
        variant = 'violet';
        label = '🔍 In Review';
        break;
      case 'ready':
        variant = 'cyan';
        label = ' Ready';
        break;
      default:
        variant = 'slate';
    }
  } else if (type === 'deliverable') {
    switch (normalized) {
      case 'approved':
        variant = 'emerald';
        label = '✓ Approved';
        break;
      case 'ready_for_review':
      case 'in_review':
        variant = 'indigo';
        label = '🔍 Submitted';
        break;
      case 'changes_requested':
        variant = 'amber';
        label = '↻ Changes Requested';
        break;
      default:
        variant = 'slate';
        label = '📝 Draft';
    }
  } else if (type === 'closure') {
    switch (normalized) {
      case 'approved':
      case 'completed':
        variant = 'emerald';
        label = '✓ Closed & Handoff';
        break;
      case 'submitted':
      case 'in_review':
        variant = 'indigo';
        label = '⏳ Under Review';
        break;
      case 'changes_requested':
        variant = 'amber';
        label = '↻ Changes Requested';
        break;
      default:
        variant = 'slate';
    }
  } else if (type === 'project') {
    switch (normalized) {
      case 'active':
        variant = 'emerald';
        label = 'Active';
        break;
      case 'completed':
        variant = 'indigo';
        label = 'Completed';
        break;
      default:
        variant = 'slate';
    }
  } else if (type === 'intent') {
    switch (normalized) {
      case 'confirmed':
        variant = 'emerald';
        label = 'CONFIRMED INTENT';
        break;
      case 'rejected':
        variant = 'rose';
        label = 'REJECTED';
        break;
      case 'needs_clarification':
        variant = 'amber';
        label = 'NEEDS CLARIFICATION';
        break;
      case 'ready_for_review':
        variant = 'indigo';
        label = 'READY FOR REVIEW';
        break;
      default:
        variant = 'slate';
    }
  }

  return <Badge variant={variant}>{label}</Badge>;
}
