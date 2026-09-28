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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111827] border border-[#1F2937] rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl text-[#F8FAFC]">
        <div className="flex items-center justify-between border-b border-[#1F2937] pb-3">
          <h3 className="text-base font-extrabold text-[#F8FAFC] flex items-center gap-2">
            🔍 Final Project Completion Review
          </h3>
          <button onClick={onClose} className="text-[#64748B] hover:text-[#F8FAFC] text-sm font-bold">
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-semibold text-rose-400">
            {error}
          </div>
        )}

        {/* Closure Details */}
        <div className="space-y-3">
          <div className="p-3 bg-[#0B0F19]/60 border border-[#1F2937] rounded-xl text-xs space-y-1">
            <span className="font-bold text-[#F8FAFC] block">Development Team Summary:</span>
            <p className="text-[#94A3B8] font-medium leading-relaxed">{closure.summary || 'Final project deliverables prepared.'}</p>
          </div>

          {closure.completionNotes && (
            <div className="p-3 bg-[#0B0F19]/60 border border-[#1F2937] rounded-xl text-xs space-y-1">
              <span className="font-bold text-[#F8FAFC] block">Completion Notes:</span>
              <p className="text-[#94A3B8] font-medium leading-relaxed">{closure.completionNotes}</p>
            </div>
          )}
        </div>

        {!isRequestingChanges ? (
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Approval Comment (Optional)
              </label>
              <textarea
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Great work team! Final deliverables look complete."
                className="w-full bg-[#0B0F19] border border-[#1F2937] rounded-xl p-3 text-xs text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-[11px] text-emerald-400 font-medium">
              ✓ Approving this closure request will mark the project as formally completed and generate your project handoff record.
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#1F2937]">
              <button
                type="button"
                onClick={() => setIsRequestingChanges(true)}
                className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold rounded-xl transition"
              >
                ↻ Request Final Changes
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-[#151D2E] hover:bg-[#1F2937] text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-semibold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
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
                className="w-full bg-[#0B0F19] border border-amber-500/40 rounded-xl p-3 text-xs text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1F2937]">
              <button
                type="button"
                onClick={() => setIsRequestingChanges(false)}
                className="px-4 py-2 bg-[#151D2E] hover:bg-[#1F2937] text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-semibold rounded-xl transition"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
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

