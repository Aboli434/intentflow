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
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            🚀 Submit Project Closure Request
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Final Project Summary
            </label>
            <textarea
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Provide a high-level summary of what was delivered in this project..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Developer Completion Notes (Optional)
            </label>
            <textarea
              rows={3}
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              placeholder="Access credentials, deployment notes, or maintenance instructions..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg text-[11px] text-slate-400 space-y-1">
            <span className="font-semibold text-cyan-300 block">Notice:</span>
            Submitting this request will notify the client to perform their final project review and sign-off.
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-lg transition flex items-center gap-1.5"
            >
              {loading ? 'Submitting...' : 'Submit for Client Approval'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
