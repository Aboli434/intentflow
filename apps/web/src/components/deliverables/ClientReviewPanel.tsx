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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-2xl w-full p-6 text-slate-100 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              📦 Review Deliverable
            </h2>
            <p className="text-xs text-slate-400 mt-1">{deliverable.title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition text-lg"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-900/40 border border-red-500/50 rounded-lg text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="my-5 space-y-4">
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Description</h4>
            <p className="text-sm text-slate-200 mt-1 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
              {deliverable.description || 'No description provided.'}
            </p>
          </div>

          {/* Linked Work Items */}
          {deliverable.linkedWorkItems && deliverable.linkedWorkItems.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Linked Work Items</h4>
              <div className="mt-1 flex flex-wrap gap-2">
                {deliverable.linkedWorkItems.map((wi) => (
                  <span
                    key={wi.id}
                    className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-md text-xs text-cyan-300 font-mono"
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
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Attachments & Downloads</h4>
              <div className="mt-1 space-y-1.5">
                {deliverable.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-xs"
                  >
                    <span className="truncate font-medium text-slate-300">📄 {att.fileName}</span>
                    <span className="text-slate-500 text-[10px]">{(att.size / 1024).toFixed(1)} KB</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action selection */}
          {mode === 'view' ? (
            <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setMode('request_changes')}
                className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300 text-xs font-medium rounded-lg transition"
              >
                ↻ Request Changes
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleApprove}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-lg transition"
              >
                {submitting ? 'Approving...' : '✓ Approve Deliverable'}
              </button>
            </div>
          ) : (
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <div>
                <label className="block text-xs font-medium text-amber-300 mb-1">
                  Required Change Details & Comments *
                </label>
                <textarea
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Explain clearly what changes or revisions are needed..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setMode('view')}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleRequestChanges}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-lg transition"
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
