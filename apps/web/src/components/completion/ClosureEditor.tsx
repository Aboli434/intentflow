'use client';

import React, { useState } from 'react';
import { apiCreateProjectClosure, apiSubmitProjectClosure } from '../../lib/api-client';

interface ClosureEditorProps {
  projectId: string;
  onSuccess: () => void;
  onClose: () => void;
}

export function ClosureEditor({ projectId, onSuccess, onClose }: ClosureEditorProps) {
  const [summary, setSummary] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const closure = await apiCreateProjectClosure(projectId, {
        summary,
        completionNotes,
      });
      await apiSubmitProjectClosure(closure.id, completionNotes);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to submit closure request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111827] border border-[#1F2937] rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl text-[#F8FAFC]">
        <div className="flex items-center justify-between border-b border-[#1F2937] pb-3">
          <h3 className="text-base font-extrabold text-[#F8FAFC] flex items-center gap-2">
            🚀 Submit Project Closure Request
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
              Final Project Summary
            </label>
            <textarea
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Provide a high-level summary of what was delivered in this project..."
              className="w-full bg-[#0B0F19] border border-[#1F2937] rounded-xl p-3 text-xs text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
              Developer Completion Notes (Optional)
            </label>
            <textarea
              rows={3}
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              placeholder="Access credentials, deployment notes, or maintenance instructions..."
              className="w-full bg-[#0B0F19] border border-[#1F2937] rounded-xl p-3 text-xs text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-[11px] text-[#94A3B8] font-medium space-y-1">
            <span className="font-bold text-indigo-400 block">Notice:</span>
            Submitting this request will notify the client to perform their final project review and sign-off.
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1F2937]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#151D2E] hover:bg-[#1F2937] text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-semibold rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              {loading ? 'Submitting...' : 'Submit for Client Approval'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

