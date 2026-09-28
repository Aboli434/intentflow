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
import { EmptyState } from '../common/EmptyState';

import { useToast } from '../ui/ToastContext';

interface DeliverablesViewProps {
  projectId: string;
  isClient: boolean;
  isDeveloper: boolean;
}

type DeliverableFilter = 'all' | 'draft' | 'submitted' | 'changes_requested' | 'approved';

export function DeliverablesView({
  projectId,
  isClient,
  isDeveloper,
}: DeliverablesViewProps) {
  const { showToast } = useToast();
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<DeliverableFilter>('all');

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
      showToast('Deliverable submitted', { type: 'success', message: 'Sent to client for review' });
      loadData();
    } catch (err: any) {
      showToast('Failed to submit deliverable', { type: 'error', message: err.message });
    }
  };

  const handleMilestoneStatusChange = async (milestoneId: string, newStatus: string) => {
    try {
      await apiUpdateMilestoneStatus(milestoneId, newStatus);
      showToast('Milestone status updated', { type: 'success' });
      loadData();
    } catch (err: any) {
      showToast('Failed to update milestone', { type: 'error', message: err.message });
    }
  };

  const handleResolveRevision = async (revisionId: string) => {
    try {
      await apiUpdateRevisionStatus(revisionId, 'resolved');
      showToast('Revision marked as resolved', { type: 'success' });
      loadData();
    } catch (err: any) {
      showToast('Failed to resolve revision', { type: 'error', message: err.message });
    }
  };

  const [delivSearch, setDelivSearch] = useState<string>('');

  const approvedCount = deliverables.filter((d) => d.status === 'approved').length;
  const totalCount = deliverables.length;

  const filteredDeliverables = deliverables.filter((d) => {
    if (activeFilter === 'draft' && d.status !== 'draft') return false;
    if (activeFilter === 'submitted' && (d.status !== 'ready_for_review' && d.status !== 'in_review')) return false;
    if (activeFilter === 'changes_requested' && d.status !== 'changes_requested') return false;
    if (activeFilter === 'approved' && d.status !== 'approved') return false;

    if (delivSearch.trim()) {
      const q = delivSearch.toLowerCase().trim();
      return (
        d.title.toLowerCase().includes(q) ||
        (d.description && d.description.toLowerCase().includes(q)) ||
        ((d as any).category && (d as any).category.toLowerCase().includes(q))
      );
    }

    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold rounded-full uppercase">✓ Approved</span>;
      case 'ready_for_review':
      case 'in_review':
        return <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[10px] font-mono font-bold rounded-full uppercase">🔍 Submitted</span>;
      case 'changes_requested':
        return <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-mono font-bold rounded-full uppercase">↻ Changes Requested</span>;
      default:
        return <span className="px-3 py-1 bg-slate-500/10 border border-slate-500/30 text-slate-300 text-[10px] font-mono font-bold rounded-full uppercase">📝 Draft</span>;
    }
  };

  return (
    <div className="space-y-6 text-[#F8FAFC]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111827] border border-[#1F2937] rounded-2xl p-5 shadow-md">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-base sm:text-lg font-extrabold text-[#F8FAFC] tracking-tight">
              📦 Deliverables & Approval Portal
            </h2>
            <span className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-mono font-bold px-2.5 py-0.5 rounded-full">
              {approvedCount} of {totalCount} approved
            </span>
          </div>
          <p className="text-xs text-[#94A3B8] mt-1 max-w-xl leading-relaxed font-medium">
            {isClient
              ? 'Review, approve, or request changes on completed project deliverables.'
              : 'Prepare, link execution work items, and submit deliverables for formal client review.'}
          </p>
        </div>

        {isDeveloper && (
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 shrink-0 min-h-[40px] cursor-pointer"
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

      {/* Filters & Search Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111827] border border-[#1F2937] rounded-2xl p-3 shadow-md">
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(['all', 'draft', 'submitted', 'changes_requested', 'approved'] as DeliverableFilter[]).map((tab) => {
            const isActive = activeFilter === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all capitalize shrink-0 min-h-[36px] cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#151D2E]'
                }`}
              >
                {tab.replace('_', ' ')}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-56">
          <input
            type="text"
            value={delivSearch}
            onChange={(e) => setDelivSearch(e.target.value)}
            placeholder="Search deliverables..."
            className="w-full rounded-xl border border-[#1F2937] bg-[#0B0F19] pl-3 pr-7 py-1.5 text-xs text-[#F8FAFC] placeholder:text-[#64748B] focus:border-indigo-500 focus:outline-none"
          />
          {delivSearch && (
            <button
              onClick={() => setDelivSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8] hover:text-[#F8FAFC]"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs font-semibold text-rose-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-[#94A3B8] text-xs font-medium animate-pulse">Loading deliverables...</div>
      ) : filteredDeliverables.length === 0 ? (
        <EmptyState
          icon="📦"
          title="No deliverables found"
          description={
            isDeveloper
              ? 'Create a deliverable package to submit work for client review.'
              : 'Deliverables submitted by your development team will appear here for client review.'
          }
          actionLabel={isDeveloper ? '+ Create Deliverable' : undefined}
          onAction={isDeveloper ? () => setIsCreating(true) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDeliverables.map((d) => (
            <div
              key={d.id}
              className="bg-[#111827] border border-[#1F2937] rounded-2xl p-5 space-y-4 hover:border-indigo-500/50 transition-all shadow-md flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-[#F8FAFC]">{d.title}</h3>
                    <p className="text-xs text-[#94A3B8] mt-1 line-clamp-2 leading-relaxed font-medium">
                      {d.description || 'No detailed description.'}
                    </p>
                  </div>
                  {getStatusBadge(d.status)}
                </div>

                {/* Linked Work Items */}
                {d.linkedWorkItems && d.linkedWorkItems.length > 0 && (
                  <div className="pt-2 space-y-1">
                    <span className="text-[10px] font-mono font-bold text-[#64748B] uppercase tracking-wider block">
                      Linked Work Items
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {d.linkedWorkItems.map((wi) => (
                        <span
                          key={wi.id}
                          className="px-2.5 py-0.5 bg-[#0B0F19] border border-[#1F2937] text-[11px] text-cyan-400 rounded-md font-mono font-semibold"
                        >
                          ✓ {wi.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Revision Requests */}
                {d.revisions && d.revisions.length > 0 && (
                  <div className="pt-2 border-t border-[#1F2937] space-y-1.5">
                    <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                      ↻ Requested Revisions ({d.revisions.length})
                    </span>
                    <div className="space-y-1.5">
                      {d.revisions.map((rev) => (
                        <div
                          key={rev.id}
                          className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between text-amber-400 font-bold">
                            <span>{rev.clientName || 'Client'}</span>
                            <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/30">
                              {rev.status}
                            </span>
                          </div>
                          <p className="text-[#94A3B8] text-[11px] leading-snug font-medium">{rev.description}</p>

                          {isDeveloper && rev.status !== 'resolved' && (
                            <button
                              onClick={() => handleResolveRevision(rev.id)}
                              className="mt-1 text-[11px] font-bold text-emerald-400 hover:underline min-h-[36px] cursor-pointer"
                            >
                              ✓ Mark Revision Resolved
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#1F2937] flex items-center justify-end gap-2">
                {isDeveloper && d.status === 'draft' && (
                  <>
                    <button
                      onClick={() => setEditingDeliverable(d)}
                      className="px-3.5 py-2 bg-[#151D2E] hover:bg-[#1F2937] text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-semibold rounded-xl transition border border-[#1F2937] min-h-[40px]"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleSubmitForReview(d.id)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition min-h-[40px]"
                    >
                      Submit for Review
                    </button>
                  </>
                )}

                {isClient && (d.status === 'ready_for_review' || d.status === 'in_review' || d.status === 'changes_requested') && (
                  <button
                    onClick={() => setActiveReviewDeliverable(d)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition min-h-[40px]"
                  >
                    Review & Approve / Request Changes
                  </button>
                )}

                {d.status === 'approved' && (
                  <span className="text-xs text-emerald-400 font-bold flex items-center gap-1 font-mono">
                    ✓ Approved {d.approvedAt ? new Date(d.approvedAt).toLocaleDateString() : ''}
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
}

