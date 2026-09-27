'use client';

import React, { useState, useEffect } from 'react';
import { WorkProposal, WorkProposalItem, WorkItem } from '@intentflow/types';
import {
  apiGenerateWorkProposal,
  apiGetIntentWorkProposals,
  apiApproveWorkProposal,
  apiRejectWorkProposal,
} from '../../lib/api-client';

interface WorkProposalViewProps {
  intentId: string;
  projectId: string;
  isConfirmed: boolean;
  userRole?: string;
  orgId?: string;
  onWorkCreated?: (workItems: WorkItem[]) => void;
  onNavigateToWorkTab?: () => void;
}

export function WorkProposalView({
  intentId,
  projectId,
  isConfirmed,
  userRole = 'developer',
  orgId,
  onWorkCreated,
  onNavigateToWorkTab,
}: WorkProposalViewProps) {
  const [proposals, setProposals] = useState<WorkProposal[]>([]);
  const [activeProposal, setActiveProposal] = useState<WorkProposal | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [editableItems, setEditableItems] = useState<WorkProposalItem[]>([]);

  const isClientView = userRole === 'client';

  const loadProposals = async () => {
    try {
      const list = await apiGetIntentWorkProposals(intentId, orgId);
      setProposals(list);
      if (list.length > 0) {
        setActiveProposal(list[0]);
        setEditableItems(list[0].items || []);
      }
    } catch (err: any) {
      console.error('Failed to load proposals', err);
    }
  };

  useEffect(() => {
    if (intentId) {
      loadProposals();
    }
  }, [intentId]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const newProposal = await apiGenerateWorkProposal(intentId, orgId);
      setActiveProposal(newProposal);
      setEditableItems(newProposal.items || []);
      setProposals([newProposal, ...proposals]);
    } catch (err: any) {
      setError(err.message || 'Failed to generate work proposal');
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async () => {
    if (!activeProposal) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiApproveWorkProposal(
        activeProposal.id,
        {
          items: editableItems.map((item, idx) => ({
            title: item.title,
            description: item.description,
            priority: item.priority,
            estimatedEffort: item.estimatedEffort,
            sourceRequirementId: item.sourceRequirementId,
            suggestedRole: item.suggestedRole,
            position: idx + 1,
          })),
        },
        orgId
      );

      // Refresh proposal status
      await loadProposals();
      setShowReviewModal(false);
      if (onWorkCreated) onWorkCreated(result.workItems);
      if (onNavigateToWorkTab) onNavigateToWorkTab();
    } catch (err: any) {
      setError(err.message || 'Failed to approve work proposal');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!activeProposal) return;
    setLoading(true);
    setError(null);
    try {
      await apiRejectWorkProposal(activeProposal.id, orgId);
      await loadProposals();
      setShowReviewModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to reject work proposal');
    } finally {
      setLoading(false);
    }
  };

  if (!isConfirmed) {
    return null;
  }

  // Approved proposal state
  const approvedProposal = proposals.find((p) => p.status === 'approved');
  if (approvedProposal) {
    return (
      <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4 text-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
              ✓
            </div>
            <div>
              <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                Work Created & Approved
              </h4>
              <p className="text-xs text-slate-400">
                {approvedProposal.items?.length || 0} work items generated from confirmed intent.
              </p>
            </div>
          </div>
          {onNavigateToWorkTab && (
            <button
              type="button"
              onClick={onNavigateToWorkTab}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow transition"
            >
              View Work →
            </button>
          )}
        </div>
      </div>
    );
  }

  // Pending proposal state
  const pendingProposal = activeProposal && activeProposal.status === 'pending_review' ? activeProposal : null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-200 space-y-3">
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-2.5 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
            Structured Execution Proposal
          </span>
          <h4 className="text-sm font-bold text-slate-100">
            {pendingProposal ? 'AI Work Proposal Pending Review' : 'Convert Intent to Work'}
          </h4>
        </div>

        {!isClientView && (
          <div>
            {!pendingProposal ? (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                    Generating Proposal...
                  </>
                ) : (
                  'Generate Work Proposal'
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowReviewModal(true)}
                className="bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/30 text-xs font-semibold px-3.5 py-1.5 rounded-lg transition"
              >
                Review Proposal ({pendingProposal.items?.length || 0} items)
              </button>
            )}
          </div>
        )}
      </div>

      {pendingProposal && (
        <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-3 space-y-2">
          <div className="text-xs font-medium text-slate-300 flex items-center justify-between">
            <span>Suggested Tasks:</span>
            <span className="text-[10px] text-slate-400">Developer Review Required</span>
          </div>
          <ul className="space-y-1.5">
            {pendingProposal.items?.map((item, idx) => (
              <li
                key={item.id || idx}
                className="flex items-center justify-between text-xs bg-slate-900/60 px-2.5 py-1.5 rounded border border-slate-800/80"
              >
                <span className="text-slate-200 font-medium">{item.title}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-slate-800 text-indigo-300 px-1.5 py-0.5 rounded border border-slate-700">
                    {item.priority} priority
                  </span>
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                    {item.estimatedEffort} effort
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Proposal Review Modal */}
      {showReviewModal && pendingProposal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-2xl w-full space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                  Human Developer Review
                </span>
                <h3 className="text-base font-bold text-slate-100">Review AI Work Proposal</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Review, edit, add, or remove suggested work items before converting them into actionable project tasks.
            </p>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {editableItems.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-2.5 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-bold text-[10px]">#{idx + 1}</span>
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => {
                        const newItems = [...editableItems];
                        newItems[idx].title = e.target.value;
                        setEditableItems(newItems);
                      }}
                      className="flex-1 bg-slate-900 text-slate-100 font-medium px-2.5 py-1 rounded border border-slate-700 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setEditableItems(editableItems.filter((_, i) => i !== idx))}
                      className="text-rose-400 hover:text-rose-300 font-bold px-2 py-1"
                    >
                      ✕
                    </button>
                  </div>

                  <input
                    type="text"
                    value={item.description || ''}
                    placeholder="Task description / scope..."
                    onChange={(e) => {
                      const newItems = [...editableItems];
                      newItems[idx].description = e.target.value;
                      setEditableItems(newItems);
                    }}
                    className="w-full bg-slate-900 text-slate-300 text-xs px-2.5 py-1 rounded border border-slate-800"
                  />

                  <div className="flex items-center gap-4 flex-wrap text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <span>Priority:</span>
                      <select
                        value={item.priority}
                        onChange={(e) => {
                          const newItems = [...editableItems];
                          newItems[idx].priority = e.target.value as any;
                          setEditableItems(newItems);
                        }}
                        className="bg-slate-900 text-slate-200 rounded border border-slate-700 px-2 py-0.5 text-xs"
                      >
                        <option value="low">low</option>
                        <option value="medium">medium</option>
                        <option value="high">high</option>
                        <option value="urgent">urgent</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span>Effort:</span>
                      <select
                        value={item.estimatedEffort}
                        onChange={(e) => {
                          const newItems = [...editableItems];
                          newItems[idx].estimatedEffort = e.target.value as any;
                          setEditableItems(newItems);
                        }}
                        className="bg-slate-900 text-slate-200 rounded border border-slate-700 px-2 py-0.5 text-xs"
                      >
                        <option value="small">small</option>
                        <option value="medium">medium</option>
                        <option value="large">large</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  setEditableItems([
                    ...editableItems,
                    {
                      id: `temp-${Date.now()}`,
                      proposalId: pendingProposal.id,
                      title: 'New Custom Work Item',
                      description: '',
                      priority: 'medium',
                      estimatedEffort: 'small',
                      position: editableItems.length + 1,
                    },
                  ])
                }
                className="w-full py-2 border border-dashed border-slate-700 text-indigo-400 hover:text-indigo-300 text-xs font-semibold rounded-lg text-center hover:bg-slate-800/40 transition"
              >
                + Add Custom Work Item
              </button>
            </div>

            <div className="border-t border-slate-800 pt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleReject}
                disabled={loading}
                className="text-rose-400 hover:text-rose-300 text-xs font-semibold px-3 py-1.5 rounded"
              >
                Reject Proposal
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="text-slate-400 hover:text-slate-200 text-xs px-3 py-1.5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={loading || editableItems.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  ✓ Approve & Create Work Items
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
