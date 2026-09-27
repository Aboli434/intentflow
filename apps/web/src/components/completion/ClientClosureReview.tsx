'use client';

import React, { useState } from 'react';
import { ProjectClosure } from '@intentflow/types';
import { apiApproveProjectClosure, apiRequestClosureChanges } from '../../lib/api-client';

interface ClientClosureReviewProps {
  closure: ProjectClosure;
  onSuccess: () => void;
  onClose: () => void;
}

export function ClientClosureReview({ closure, onSuccess, onClose }: ClientClosureReviewProps) {
  const [comment, setComment] = useState('');
  const [isRequestingChanges, setIsRequestingChanges] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    setLoading(true);
    setError(null);
    try {
      await apiApproveProjectClosure(closure.id, comment);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to approve project closure');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      setError('Please provide feedback explaining the requested changes.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiRequestClosureChanges(closure.id, comment);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to request changes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            🔍 Final Project Completion Review
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-sm">
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-900/40 border border-red-500/50 rounded-lg text-xs text-red-300">
            {error}
          </div>
        )}

        {/* Closure Details */}
        <div className="space-y-3">
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1">
            <span className="font-semibold text-slate-300 block">Development Team Summary:</span>
            <p className="text-slate-300">{closure.summary || 'Final project deliverables prepared.'}</p>
          </div>

          {closure.completionNotes && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1">
              <span className="font-semibold text-slate-300 block">Completion Notes:</span>
              <p className="text-slate-400">{closure.completionNotes}</p>
            </div>
          )}
        </div>

        {!isRequestingChanges ? (
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Approval Comment (Optional)
              </label>
              <textarea
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Great work team! Final deliverables look complete."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="p-3 bg-emerald-950/20 border border-emerald-800/40 rounded-lg text-[11px] text-emerald-300">
              ✓ Approving this closure request will mark the project as formally completed and generate your project handoff record.
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setIsRequestingChanges(true)}
                className="px-4 py-2 bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 border border-amber-800/40 text-xs font-semibold rounded-lg transition"
              >
                ↻ Request Final Changes
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-lg transition"
                >
                  {loading ? 'Approving...' : '✓ Approve Final Project Completion'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleRequestChanges} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-amber-400 mb-1">
                Requested Changes & Feedback (Required)
              </label>
              <textarea
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Explain the specific changes required before final sign-off..."
                className="w-full bg-slate-950 border border-amber-900/60 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRequestingChanges(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg shadow-lg transition"
              >
                {loading ? 'Submitting...' : 'Submit Change Request'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
