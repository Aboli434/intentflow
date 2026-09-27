'use client';

import React, { useState } from 'react';
import { WorkItem, ProjectMilestone, Deliverable } from '@intentflow/types';
import { apiCreateDeliverable, apiUpdateDeliverable } from '../../lib/api-client';

interface DeliverableEditorProps {
  projectId: string;
  deliverable?: Deliverable | null;
  availableWorkItems: WorkItem[];
  availableMilestones: ProjectMilestone[];
  onSuccess: () => void;
  onClose: () => void;
}

export const DeliverableEditor: React.FC<DeliverableEditorProps> = ({
  projectId,
  deliverable,
  availableWorkItems,
  availableMilestones,
  onSuccess,
  onClose,
}) => {
  const [title, setTitle] = useState(deliverable?.title || '');
  const [description, setDescription] = useState(deliverable?.description || '');
  const [selectedWorkItemIds, setSelectedWorkItemIds] = useState<string[]>(
    deliverable?.linkedWorkItems?.map((w) => w.id) || []
  );
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>(
    deliverable?.milestone?.id || ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (deliverable) {
        await apiUpdateDeliverable(deliverable.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          workItemIds: selectedWorkItemIds,
          milestoneId: selectedMilestoneId || undefined,
        });
      } else {
        await apiCreateDeliverable(projectId, {
          title: title.trim(),
          description: description.trim() || undefined,
          workItemIds: selectedWorkItemIds,
          milestoneId: selectedMilestoneId || undefined,
        });
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to save deliverable');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleWorkItem = (id: string) => {
    if (selectedWorkItemIds.includes(id)) {
      setSelectedWorkItemIds(selectedWorkItemIds.filter((wiId) => wiId !== id));
    } else {
      setSelectedWorkItemIds([...selectedWorkItemIds, id]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-xl w-full p-6 text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white">
            {deliverable ? '✏️ Edit Deliverable' : '📦 Create New Deliverable'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition">
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-900/40 border border-red-500/50 rounded-lg text-xs text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Deliverable Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Homepage Redesign & Mobile Navigation"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Description & Notes
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what was produced or instructions for client review..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Associate Milestone */}
          {availableMilestones.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Associate Project Milestone
              </label>
              <select
                value={selectedMilestoneId}
                onChange={(e) => setSelectedMilestoneId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="">-- No Milestone --</option>
                {availableMilestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} ({m.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Link Completed Work Items */}
          {availableWorkItems.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Link Completed Work Items
              </label>
              <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 bg-slate-950 border border-slate-800 rounded-lg">
                {availableWorkItems.map((wi) => (
                  <label
                    key={wi.id}
                    className="flex items-center gap-2 p-1.5 hover:bg-slate-900 rounded text-xs cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedWorkItemIds.includes(wi.id)}
                      onChange={() => toggleWorkItem(wi.id)}
                      className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                    />
                    <span className="text-slate-200 font-medium truncate">{wi.title}</span>
                    <span className="text-[10px] text-slate-500 ml-auto">{wi.status}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-lg transition"
            >
              {submitting ? 'Saving...' : deliverable ? 'Update Deliverable' : 'Create Deliverable'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
