'use client';

import React, { useState } from 'react';
import { Intent, IntentRequirement, IntentQuestion, WorkItem } from '@intentflow/types';
import {
  apiUpdateIntent,
  apiConfirmIntent,
  apiRejectIntent,
  apiDismissQuestion,
  apiCreateClarification,
} from '../../lib/api-client';
import { WorkProposalView } from '../work/WorkProposalView';

interface IntentPanelProps {
  intent: Intent | null;
  projectId?: string;
  isProcessing: boolean;
  onIntentUpdated: (intent: Intent) => void;
  onSelectMessage?: (messageId: string) => void;
  onDraftClarification?: (draftMessage: string) => void;
  onNavigateToWorkTab?: () => void;
  orgId?: string;
  userRole?: string;
}

export function IntentPanel({
  intent,
  projectId = '',
  isProcessing,
  onIntentUpdated,
  onSelectMessage,
  onDraftClarification,
  onNavigateToWorkTab,
  orgId,
  userRole = 'developer',
}: IntentPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editRequirements, setEditRequirements] = useState<{ id?: string; text: string }[]>([]);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isProcessing) {
    return (
      <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-5 text-[#94A3B8] space-y-4 animate-pulse shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
            Intent Intelligence Engine
          </span>
          <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-2.5 py-1 rounded-full flex items-center gap-1.5 font-bold">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
            Processing...
          </span>
        </div>
        <div className="h-5 bg-[#1F2937] rounded-xl w-3/4"></div>
        <div className="h-4 bg-[#1F2937] rounded-xl w-full"></div>
        <div className="h-4 bg-[#1F2937] rounded-xl w-5/6"></div>
      </div>
    );
  }

  if (!intent) {
    return (
      <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6 text-center text-[#94A3B8] space-y-3 shadow-md">
        <div className="w-10 h-10 mx-auto rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h4 className="text-sm font-extrabold text-[#F8FAFC]">No Structured Intent Yet</h4>
        <p className="text-xs text-[#94A3B8] max-w-xs mx-auto">
          IntentFlow identifies actionable requirements & missing information from project conversations.
        </p>
      </div>
    );
  }

  const isClientView = userRole === 'client';

  const confidenceBadge = (score: number) => {
    if (score >= 0.85) {
      return <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-0.5 rounded-full font-bold border border-emerald-500/30">High confidence</span>;
    } else if (score >= 0.65) {
      return <span className="bg-amber-500/10 text-amber-400 text-xs px-2.5 py-0.5 rounded-full font-bold border border-amber-500/30">Medium confidence</span>;
    }
    return <span className="bg-rose-500/10 text-rose-400 text-xs px-2.5 py-0.5 rounded-full font-bold border border-rose-500/30">Low confidence</span>;
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-1 rounded-md font-bold border border-emerald-500/30 uppercase tracking-wider">CONFIRMED INTENT</span>;
      case 'rejected':
        return <span className="bg-rose-500/10 text-rose-400 text-xs px-2.5 py-1 rounded-md font-bold border border-rose-500/30 uppercase tracking-wider">REJECTED</span>;
      case 'needs_clarification':
        return <span className="bg-amber-500/10 text-amber-400 text-xs px-2.5 py-1 rounded-md font-bold border border-amber-500/30 uppercase tracking-wider">NEEDS CLARIFICATION</span>;
      case 'ready_for_review':
        return <span className="bg-indigo-500/10 text-indigo-400 text-xs px-2.5 py-1 rounded-md font-bold border border-indigo-500/30 uppercase tracking-wider">READY FOR REVIEW</span>;
      default:
        return <span className="bg-slate-500/10 text-slate-300 text-xs px-2.5 py-1 rounded-md font-bold uppercase tracking-wider">{status}</span>;
    }
  };

  const handleStartEdit = () => {
    setEditTitle(intent.title);
    setEditSummary(intent.summary);
    setEditRequirements(intent.requirements ? intent.requirements.map((r) => ({ id: r.id, text: r.text })) : []);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    setLoading(true);
    setError(null);
    try {
      const updated = await apiUpdateIntent(
        intent.id,
        {
          title: editTitle,
          summary: editSummary,
          requirements: editRequirements.map((r, idx) => ({ id: r.id, text: r.text, position: idx + 1 })),
        },
        orgId
      );
      onIntentUpdated(updated);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save changes');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const confirmed = await apiConfirmIntent(intent.id, orgId);
      onIntentUpdated(confirmed);
    } catch (err: any) {
      setError(err.message || 'Failed to confirm intent');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    setError(null);
    try {
      const rejected = await apiRejectIntent(intent.id, rejectReason, orgId);
      onIntentUpdated(rejected);
      setShowRejectModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to reject intent');
    } finally {
      setLoading(false);
    }
  };

  const handleDismissQuestion = async (qId: string) => {
    try {
      const updated = await apiDismissQuestion(intent.id, qId, orgId);
      onIntentUpdated(updated);
    } catch (err: any) {
      console.error('Failed to dismiss question', err);
    }
  };

  const handleAskClient = async (q: IntentQuestion) => {
    try {
      const result = await apiCreateClarification(intent.id, { questionId: q.id, questionText: q.question }, orgId);
      onIntentUpdated(result.intent);
      if (onDraftClarification && result.draftMessage) {
        onDraftClarification(result.draftMessage);
      }
    } catch (err: any) {
      console.error('Failed to draft clarification', err);
    }
  };

  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-5 space-y-5 shadow-md text-[#F8FAFC]">
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs p-3 rounded-xl font-semibold">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-[#1F2937] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {statusBadge(intent.status)}
            {confidenceBadge(intent.confidence)}
            {intent.modifiedByHuman && (
              <span className="text-[10px] bg-[#151D2E] text-[#94A3B8] px-2 py-0.5 rounded-md border border-[#1F2937] font-mono">
                Human modified
              </span>
            )}
          </div>
          {!isEditing ? (
            <h3 className="text-lg font-extrabold text-[#F8FAFC]">{intent.title}</h3>
          ) : (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full bg-[#0B0F19] text-[#F8FAFC] font-bold px-3 py-1.5 rounded-xl border border-[#1F2937] focus:outline-none focus:border-indigo-500 text-base"
            />
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="space-y-1">
        <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
          Summary
        </label>
        {!isEditing ? (
          <p className="text-sm text-[#94A3B8] leading-relaxed bg-[#0B0F19]/60 p-3 rounded-xl border border-[#1F2937] font-normal">
            {intent.summary}
          </p>
        ) : (
          <textarea
            value={editSummary}
            onChange={(e) => setEditSummary(e.target.value)}
            rows={3}
            className="w-full bg-[#0B0F19] text-[#F8FAFC] text-sm p-3 rounded-xl border border-[#1F2937] focus:outline-none focus:border-indigo-500"
          />
        )}
      </div>

      {/* Requirements */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
            Requirements
          </label>
          <span className="text-xs text-[#94A3B8] font-medium">{intent.requirements?.length || 0} extracted</span>
        </div>

        {!isEditing ? (
          <ul className="space-y-2">
            {intent.requirements && intent.requirements.length > 0 ? (
              intent.requirements.map((req) => (
                <li
                  key={req.id}
                  className="flex items-start gap-2.5 text-xs text-[#94A3B8] bg-[#0B0F19]/60 p-2.5 rounded-xl border border-[#1F2937] font-medium"
                >
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <span className="flex-1 text-[#F8FAFC]">{req.text}</span>
                </li>
              ))
            ) : (
              <li className="text-xs text-[#64748B] italic">No requirements extracted.</li>
            )}
          </ul>
        ) : (
          <div className="space-y-2">
            {editRequirements.map((req, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={req.text}
                  onChange={(e) => {
                    const newReqs = [...editRequirements];
                    newReqs[idx].text = e.target.value;
                    setEditRequirements(newReqs);
                  }}
                  className="flex-1 bg-[#0B0F19] text-[#F8FAFC] text-xs px-3 py-2 rounded-xl border border-[#1F2937]"
                />
                <button
                  type="button"
                  onClick={() => setEditRequirements(editRequirements.filter((_, i) => i !== idx))}
                  className="text-rose-400 hover:text-rose-300 text-xs font-bold px-2 py-1"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setEditRequirements([...editRequirements, { text: '' }])}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-bold pt-1"
            >
              + Add Requirement
            </button>
          </div>
        )}
      </div>

      {/* Missing Information Questions */}
      {intent.questions && intent.questions.filter((q) => q.status !== 'dismissed').length > 0 && (
        <div className="space-y-2 border-t border-[#1F2937] pt-4">
          <label className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Missing Information ({intent.questions.filter((q) => q.status !== 'dismissed').length})
          </label>
          <div className="space-y-2">
            {intent.questions
              .filter((q) => q.status !== 'dismissed')
              .map((q) => (
                <div
                  key={q.id}
                  className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl text-xs text-amber-300 space-y-2"
                >
                  <p className="font-semibold">? {q.question}</p>
                  {!isClientView && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleAskClient(q)}
                        className="bg-[#111827] hover:bg-[#151D2E] text-amber-400 border border-amber-500/40 text-[11px] px-2.5 py-1 rounded-lg font-bold transition shadow-sm"
                      >
                        Ask Client
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDismissQuestion(q.id)}
                        className="text-[#94A3B8] hover:text-[#F8FAFC] text-[11px] px-2 py-1 font-semibold"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Confirmed Intent -> Work Proposal Experience */}
      {intent.status === 'confirmed' && (
        <div className="border-t border-[#1F2937] pt-4">
          <WorkProposalView
            intentId={intent.id}
            projectId={projectId || intent.projectId}
            isConfirmed={true}
            userRole={userRole}
            orgId={orgId}
            onNavigateToWorkTab={onNavigateToWorkTab}
          />
        </div>
      )}

      {/* Sources & Evidence Links */}
      {intent.evidence && intent.evidence.length > 0 && (
        <div className="space-y-2 border-t border-[#1F2937] pt-4">
          <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
            Sources & Evidence
          </label>
          <div className="flex flex-wrap gap-2">
            {intent.evidence.map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={() => onSelectMessage?.(ev.messageId)}
                className="bg-[#151D2E] hover:bg-[#1F2937] text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-semibold px-2.5 py-1 rounded-xl border border-[#1F2937] flex items-center gap-1.5 transition"
              >
                <svg className="w-3 h-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Message #{ev.messageId.substring(0, 6)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action Footer for Developers */}
      {!isClientView && (
        <div className="border-t border-[#1F2937] pt-4 flex items-center justify-between gap-2 flex-wrap">
          {!isEditing ? (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleStartEdit}
                  disabled={loading}
                  className="bg-[#151D2E] hover:bg-[#1F2937] text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-bold px-3.5 py-2 rounded-xl border border-[#1F2937] transition"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setShowRejectModal(true)}
                  disabled={loading || intent.status === 'rejected'}
                  className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold px-3.5 py-2 rounded-xl transition"
                >
                  Reject
                </button>
              </div>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading || intent.status === 'confirmed'}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
              >
                ✓ Confirm Intent
              </button>
            </>
          ) : (
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-xs text-[#94A3B8] hover:text-[#F8FAFC] font-semibold px-3.5 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md transition"
              >
                Save Changes
              </button>
            </div>
          )}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-[#F8FAFC]">
            <h4 className="text-sm font-extrabold text-[#F8FAFC]">Reject Intent Interpretation</h4>
            <p className="text-xs text-[#94A3B8]">
              Provide an optional reason why this interpretation was rejected for history:
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Client was asking for inspiration, not actual change."
              rows={3}
              className="w-full bg-[#0B0F19] text-[#F8FAFC] text-xs p-3 rounded-xl border border-[#1F2937] focus:outline-none focus:border-rose-500"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="text-xs text-[#94A3B8] hover:text-[#F8FAFC] font-bold px-3.5 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={loading}
                className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md transition"
              >
                Reject Intent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

