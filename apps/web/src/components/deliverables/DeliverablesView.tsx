'use client';

import React, { useEffect, useState } from 'react';
import { Deliverable, ProjectMilestone, WorkItem } from '@intentflow/types';
import {
  apiGetProjectDeliverables,
  apiGetProjectMilestones,
  apiGetProjectWork,
  apiSubmitDeliverableForReview,
  apiUpdateMilestoneStatus,
  apiUpdateRevisionStatus,
} from '../../lib/api-client';
import { MilestoneTimeline } from '../milestones/MilestoneTimeline';
import { ClientReviewPanel } from './ClientReviewPanel';
import { DeliverableEditor } from './DeliverableEditor';

interface DeliverablesViewProps {
  projectId: string;
  isClient: boolean;
  isDeveloper: boolean;
}

export function DeliverablesView({
  projectId,
  isClient,
  isDeveloper,
}: DeliverablesViewProps) {
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeReviewDeliverable, setActiveReviewDeliverable] = useState<Deliverable | null>(null);
  const [editingDeliverable, setEditingDeliverable] = useState<Deliverable | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [delivs, mStones, wis] = await Promise.all([
        apiGetProjectDeliverables(projectId),
        apiGetProjectMilestones(projectId),
        apiGetProjectWork(projectId),
      ]);
      setDeliverables(delivs);
      setMilestones(mStones);
      setWorkItems(wis.workItems || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load deliverables data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const handleSubmitForReview = async (id: string) => {
    try {
      await apiSubmitDeliverableForReview(id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to submit deliverable');
    }
  };

  const handleMilestoneStatusChange = async (milestoneId: string, newStatus: string) => {
    try {
      await apiUpdateMilestoneStatus(milestoneId, newStatus);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update milestone status');
    }
  };

  const handleResolveRevision = async (revisionId: string) => {
    try {
      await apiUpdateRevisionStatus(revisionId, 'resolved');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to resolve revision');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold rounded-md">✓ Approved</span>;
      case 'ready_for_review':
        return <span className="px-2.5 py-1 bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-semibold rounded-md">🔍 Ready for Review</span>;
      case 'changes_requested':
        return <span className="px-2.5 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold rounded-md">↻ Changes Requested</span>;
      case 'in_review':
        return <span className="px-2.5 py-1 bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-semibold rounded-md">👀 In Review</span>;
      default:
        return <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-400 text-xs font-semibold rounded-md">📝 Draft</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            📦 Deliverables & Approval Portal
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isClient
              ? 'Review, approve, or request changes on completed project deliverables.'
              : 'Prepare, link work, and submit deliverables for formal client review.'}
          </p>
        </div>

        {isDeveloper && (
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg shadow-lg transition flex items-center gap-1.5"
          >
            <span>+</span> Create Deliverable
          </button>
        )}
      </div>

      {/* Milestone Progression */}
      <MilestoneTimeline
        milestones={milestones}
        isDeveloper={isDeveloper}
        onStatusChange={handleMilestoneStatusChange}
      />

      {error && (
        <div className="p-3 bg-red-900/40 border border-red-500/50 rounded-lg text-xs text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-500 text-xs">Loading deliverables...</div>
      ) : deliverables.length === 0 ? (
        <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-xl text-slate-400">
          <p className="text-sm font-medium">No deliverables created yet.</p>
          <p className="text-xs text-slate-500 mt-1">
            {isDeveloper
              ? 'Click "Create Deliverable" above to prepare a work package for client review.'
              : 'Deliverables submitted by your development team will appear here for your review.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {deliverables.map((d) => (
            <div
              key={d.id}
              className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4 hover:border-slate-700 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white">{d.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {d.description || 'No detailed description.'}
                  </p>
                </div>
                {getStatusBadge(d.status)}
              </div>

              {/* Linked Work Items */}
              {d.linkedWorkItems && d.linkedWorkItems.length > 0 && (
                <div className="pt-2">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Linked Execution Items
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {d.linkedWorkItems.map((wi) => (
                      <span
                        key={wi.id}
                        className="px-2 py-0.5 bg-slate-950 border border-slate-800 text-[11px] text-cyan-300 rounded font-mono"
                      >
                        ✓ {wi.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Revision Requests */}
              {d.revisions && d.revisions.length > 0 && (
                <div className="pt-2 border-t border-slate-800/60">
                  <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                    ↻ Requested Revisions ({d.revisions.length})
                  </span>
                  <div className="space-y-1.5 mt-1.5">
                    {d.revisions.map((rev) => (
                      <div
                        key={rev.id}
                        className="p-2.5 bg-amber-950/30 border border-amber-900/50 rounded-lg text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-amber-200">
                          <span className="font-semibold">{rev.clientName || 'Client'}</span>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-amber-900/50 rounded">
                            {rev.status}
                          </span>
                        </div>
                        <p className="text-slate-300 text-[11px]">{rev.description}</p>

                        {isDeveloper && rev.status !== 'resolved' && (
                          <button
                            onClick={() => handleResolveRevision(rev.id)}
                            className="mt-1 text-[10px] font-bold text-emerald-400 hover:underline"
                          >
                            ✓ Mark Revision Resolved
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                {isDeveloper && d.status === 'draft' && (
                  <>
                    <button
                      onClick={() => setEditingDeliverable(d)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleSubmitForReview(d.id)}
                      className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg transition"
                    >
                      Submit for Review
                    </button>
                  </>
                )}

                {isClient && (d.status === 'ready_for_review' || d.status === 'in_review' || d.status === 'changes_requested') && (
                  <button
                    onClick={() => setActiveReviewDeliverable(d)}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-lg transition"
                  >
                    Review & Approve / Request Changes
                  </button>
                )}

                {d.status === 'approved' && (
                  <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                    ✓ Approved on {d.approvedAt ? new Date(d.approvedAt).toLocaleDateString() : 'Date'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Modal for Client */}
      {activeReviewDeliverable && (
        <ClientReviewPanel
          deliverable={activeReviewDeliverable}
          onSuccess={() => {
            setActiveReviewDeliverable(null);
            loadData();
          }}
          onClose={() => setActiveReviewDeliverable(null)}
        />
      )}

      {/* Create / Edit Modal for Developer */}
      {(isCreating || editingDeliverable) && (
        <DeliverableEditor
          projectId={projectId}
          deliverable={editingDeliverable}
          availableWorkItems={workItems}
          availableMilestones={milestones}
          onSuccess={() => {
            setIsCreating(false);
            setEditingDeliverable(null);
            loadData();
          }}
          onClose={() => {
            setIsCreating(false);
            setEditingDeliverable(null);
          }}
        />
      )}
    </div>
  );
};
