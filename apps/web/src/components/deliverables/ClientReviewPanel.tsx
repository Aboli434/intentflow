'use client';

import React, { useState } from 'react';
import { Deliverable, ClientReview } from '@intentflow/types';
import { apiApproveDeliverable, apiRequestDeliverableChanges } from '../../lib/api-client';

interface ClientReviewPanelProps {
  deliverable: Deliverable;
  onSuccess: () => void;
  onClose: () => void;
}

export const ClientReviewPanel: React.FC<ClientReviewPanelProps> = ({
  deliverable,
  onSuccess,
  onClose,
}) => {
  const [comment, setComment] = useState('');
  const [mode, setMode] = useState<'view' | 'request_changes'>('view');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await apiApproveDeliverable(deliverable.id, comment || undefined);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to approve deliverable');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!comment.trim()) {
      setError('Please provide specific comments describing the requested changes');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiRequestDeliverableChanges(deliverable.id, comment);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to submit change request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111827] border border-[#1F2937] rounded-2xl shadow-2xl max-w-2xl w-full p-6 text-[#F8FAFC] overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between pb-4 border-b border-[#1F2937]">
          <div>
            <h2 className="text-xl font-extrabold text-[#F8FAFC] flex items-center gap-2">
              📦 Review Deliverable
            </h2>
            <p className="text-xs text-[#94A3B8] font-medium mt-1">{deliverable.title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-[#64748B] hover:text-[#F8FAFC] transition text-lg font-bold"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-semibold text-rose-400">
            {error}
          </div>
        )}

        <div className="my-5 space-y-4">
          <div>
            <h4 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Description</h4>
            <p className="text-sm text-[#94A3B8] mt-1 bg-[#0B0F19]/60 p-3.5 rounded-xl border border-[#1F2937] font-medium leading-relaxed">
              {deliverable.description || 'No description provided.'}
            </p>
          </div>

          {/* Linked Work Items */}
          {deliverable.linkedWorkItems && deliverable.linkedWorkItems.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Linked Work Items</h4>
              <div className="mt-1 flex flex-wrap gap-2">
                {deliverable.linkedWorkItems.map((wi) => (
                  <span
                    key={wi.id}
                    className="px-2.5 py-1 bg-[#0B0F19] border border-[#1F2937] rounded-lg text-xs text-cyan-400 font-mono font-bold"
                  >
                    ✓ {wi.title} ({wi.status})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          {deliverable.attachments && deliverable.attachments.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Attachments & Downloads</h4>
              <div className="mt-1 space-y-1.5">
                {deliverable.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-2.5 bg-[#0B0F19]/60 rounded-xl border border-[#1F2937] text-xs"
                  >
                    <span className="truncate font-bold text-[#F8FAFC]">📄 {att.fileName}</span>
                    <span className="text-[#94A3B8] text-[10px] font-mono">{(att.size / 1024).toFixed(1)} KB</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action selection */}
          {mode === 'view' ? (
            <div className="pt-4 border-t border-[#1F2937] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setMode('request_changes')}
                className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 text-xs font-bold rounded-xl transition"
              >
                ↻ Request Changes
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleApprove}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition"
              >
                {submitting ? 'Approving...' : '✓ Approve Deliverable'}
              </button>
            </div>
          ) : (
            <div className="pt-4 border-t border-[#1F2937] space-y-3">
              <div>
                <label className="block text-xs font-bold text-amber-400 mb-1">
                  Required Change Details & Comments *
                </label>
                <textarea
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Explain clearly what changes or revisions are needed..."
                  className="w-full bg-[#0B0F19] border border-[#1F2937] rounded-xl p-3 text-xs text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setMode('view')}
                  className="px-3.5 py-2 bg-[#151D2E] hover:bg-[#1F2937] text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-semibold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleRequestChanges}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition"
                >
                  {submitting ? 'Submitting...' : 'Submit Change Request'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

