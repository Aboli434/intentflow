'use client';

export const dynamic = 'force-dynamic';

import { use } from 'react';
import { ProjectWorkspaceShell } from '@/components/project-workspace/ProjectWorkspaceShell';

export default function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const resolvedParams = use(params);

  return <ProjectWorkspaceShell projectId={resolvedParams.projectId} />;
}
