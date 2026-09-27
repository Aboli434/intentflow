'use client';

import React, { useState, useEffect } from 'react';
import { WorkItem, WorkItemStatus, WorkItemActivity, User } from '@intentflow/types';
import {
  apiGetProjectWork,
  apiCreateWorkItem,
  apiGetWorkItemDetail,
  apiUpdateWorkItemStatus,
  apiAssignWorkItem,
  apiUpdateWorkItem,
  apiGetWorkItemActivity,
} from '../../lib/api-client';

interface WorkViewProps {
  projectId: string;
  userRole?: string;
  currentUserId?: string;
  orgId?: string;
  projectMembers?: User[];
  onSelectMessage?: (messageId: string) => void;
}

export function WorkView({
  projectId,
  userRole = 'developer',
  currentUserId,
  orgId,
  projectMembers = [],
  onSelectMessage,
}: WorkViewProps) {
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Detail Drawer state
  const [selectedWorkItem, setSelectedWorkItem] = useState<WorkItem | null>(null);
  const [selectedActivities, setSelectedActivities] = useState<WorkItemActivity[]>([]);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Manual create modal state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDesc, setNewDesc] = useState<string>('');
  const [newPriority, setNewPriority] = useState<string>('medium');
  const [newAssignedTo, setNewAssignedTo] = useState<string>('');
  const [creating, setCreating] = useState<boolean>(false);

  const isClientView = userRole === 'client';

  const fetchWork = async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: any = {};
      if (activeFilter === 'my_work' && currentUserId) {
        filters.assignedTo = currentUserId;
      } else if (activeFilter !== 'all') {
        filters.status = activeFilter;
      }

      const data = await apiGetProjectWork(projectId, filters, orgId);
      setWorkItems(data.workItems);
      setMetrics(data.metrics);
    } catch (err: any) {
      setError(err.message || 'Failed to load project work items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchWork();
    }
  }, [projectId, activeFilter]);

  const handleOpenDetail = async (item: WorkItem) => {
    setSelectedWorkItem(item);
    setLoadingDetail(true);
    try {
      const detail = await apiGetWorkItemDetail(item.id, orgId);
      setSelectedWorkItem(detail);
      const activity = await apiGetWorkItemActivity(item.id, orgId);
      setSelectedActivities(activity);
    } catch (err) {
      console.error('Failed to load work item details', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleStatusChange = async (itemId: string, newStatus: WorkItemStatus) => {
    try {
      const updated = await apiUpdateWorkItemStatus(itemId, newStatus, orgId);
      setWorkItems(workItems.map((w) => (w.id === itemId ? updated : w)));
      if (selectedWorkItem && selectedWorkItem.id === itemId) {
        setSelectedWorkItem(updated);
        const activity = await apiGetWorkItemActivity(itemId, orgId);
        setSelectedActivities(activity);
      }
      fetchWork();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleAssignChange = async (itemId: string, assigneeId: string) => {
    try {
      const updated = await apiAssignWorkItem(itemId, assigneeId, orgId);
      setWorkItems(workItems.map((w) => (w.id === itemId ? updated : w)));
      if (selectedWorkItem && selectedWorkItem.id === itemId) {
        setSelectedWorkItem(updated);
        const activity = await apiGetWorkItemActivity(itemId, orgId);
        setSelectedActivities(activity);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to assign work item');
    }
  };

  const handleCreateWork = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await apiCreateWorkItem(
        projectId,
        {
          title: newTitle,
          description: newDesc,
          priority: newPriority as any,
          status: 'ready',
          assignedTo: newAssignedTo || null,
        },
        orgId
      );
      setNewTitle('');
      setNewDesc('');
      setShowCreateModal(false);
      fetchWork();
    } catch (err: any) {
      alert(err.message || 'Failed to create work item');
    } finally {
      setCreating(false);
    }
  };

  const statusBadge = (status: WorkItemStatus) => {
    switch (status) {
      case 'completed':
        return <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2.5 py-1 rounded-md font-semibold border border-emerald-500/30 uppercase tracking-wider">COMPLETED</span>;
      case 'in_progress':
        return <span className="bg-indigo-500/20 text-indigo-300 text-xs px-2.5 py-1 rounded-md font-semibold border border-indigo-500/30 uppercase tracking-wider">IN PROGRESS</span>;
      case 'blocked':
        return <span className="bg-rose-500/20 text-rose-300 text-xs px-2.5 py-1 rounded-md font-semibold border border-rose-500/30 uppercase tracking-wider">BLOCKED</span>;
      case 'in_review':
        return <span className="bg-purple-500/20 text-purple-300 text-xs px-2.5 py-1 rounded-md font-semibold border border-purple-500/30 uppercase tracking-wider">IN REVIEW</span>;
      case 'ready':
        return <span className="bg-sky-500/20 text-sky-300 text-xs px-2.5 py-1 rounded-md font-semibold border border-sky-500/30 uppercase tracking-wider">READY</span>;
      default:
        return <span className="bg-slate-800 text-slate-300 text-xs px-2.5 py-1 rounded-md font-semibold uppercase tracking-wider">{status}</span>;
    }
  };

  const priorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <span className="text-rose-400 font-semibold text-xs">🔴 Urgent</span>;
      case 'high':
        return <span className="text-amber-400 font-semibold text-xs">🟠 High</span>;
      case 'medium':
        return <span className="text-sky-400 font-semibold text-xs">🔵 Medium</span>;
      default:
        return <span className="text-slate-400 font-semibold text-xs">⚪ Low</span>;
    }
  };

  return (
    <div className="space-y-6 text-slate-200">
      {/* Top Metrics Banner */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Work</span>
            <div className="text-xl font-extrabold text-slate-100">{metrics.total}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">In Progress</span>
            <div className="text-xl font-extrabold text-indigo-400">{metrics.in_progress}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Blocked</span>
            <div className="text-xl font-extrabold text-rose-400">{metrics.blocked}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Completed</span>
            <div className="text-xl font-extrabold text-emerald-400">
              {metrics.completed} <span className="text-xs font-normal text-slate-400">({metrics.completionRatePercentage}%)</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter Toolbar & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'All Work' },
            { id: 'my_work', label: 'My Work' },
            { id: 'ready', label: 'Ready' },
            { id: 'in_progress', label: 'In Progress' },
            { id: 'in_review', label: 'Review' },
            { id: 'blocked', label: 'Blocked' },
            { id: 'completed', label: 'Done' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                activeFilter === f.id
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {!isClientView && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow transition flex items-center gap-1"
          >
            + Create Work Item
          </button>
        )}
      </div>

      {/* Work List Table / Card View */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400 space-y-3 animate-pulse">
          <div className="h-5 bg-slate-800 rounded w-1/3 mx-auto"></div>
          <div className="h-4 bg-slate-800 rounded w-1/2 mx-auto"></div>
        </div>
      ) : error ? (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-4 rounded-xl">
          {error}
        </div>
      ) : workItems.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-8 text-center text-slate-400 space-y-3">
          <div className="w-10 h-10 mx-auto rounded-full bg-slate-800 flex items-center justify-center text-indigo-400 font-bold">
            ✓
          </div>
          <h4 className="text-sm font-semibold text-slate-200">No Work Items Found</h4>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Work items are created when confirmed intents are converted through AI work proposals or added manually by developers.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Title & Traceability</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {workItems.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-800/40 transition cursor-pointer"
                    onClick={() => handleOpenDetail(item)}
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-100 text-sm">{item.title}</div>
                      {item.intentTitle && (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span className="text-indigo-400 font-semibold">Derived from:</span>
                          <span className="text-slate-300 truncate max-w-xs">{item.intentTitle}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      {!isClientView ? (
                        <select
                          value={item.assignedTo || ''}
                          onChange={(e) => handleAssignChange(item.id, e.target.value)}
                          className="bg-slate-800 text-slate-200 border border-slate-700 rounded px-2 py-1 text-xs focus:outline-none"
                        >
                          <option value="">Unassigned</option>
                          {projectMembers.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-300">{item.assigneeName || 'Unassigned'}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">{priorityBadge(item.priority)}</td>
                    <td className="py-3 px-4">{statusBadge(item.status)}</td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      {!isClientView ? (
                        <select
                          value={item.status}
                          onChange={(e) => handleStatusChange(item.id, e.target.value as WorkItemStatus)}
                          className="bg-slate-800 text-slate-200 border border-slate-700 rounded px-2.5 py-1 text-xs focus:outline-none"
                        >
                          <option value="backlog">Backlog</option>
                          <option value="ready">Ready</option>
                          <option value="in_progress">In Progress</option>
                          <option value="in_review">In Review</option>
                          <option value="blocked">Blocked</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      ) : (
                        <button
                          onClick={() => handleOpenDetail(item)}
                          className="text-indigo-400 hover:text-indigo-300 font-medium"
                        >
                          View Progress
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Work Item Detail Drawer / Modal */}
      {selectedWorkItem && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-2xl w-full space-y-5 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-3 gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {statusBadge(selectedWorkItem.status)}
                  {priorityBadge(selectedWorkItem.priority)}
                </div>
                <h3 className="text-lg font-bold text-slate-100">{selectedWorkItem.title}</h3>
              </div>
              <button
                onClick={() => setSelectedWorkItem(null)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-5 pr-1">
              {/* Description */}
              {selectedWorkItem.description && (
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Description & Instructions
                  </label>
                  <p className="text-xs text-slate-300 bg-slate-950/50 p-3 rounded-lg border border-slate-800/60 leading-relaxed">
                    {selectedWorkItem.description}
                  </p>
                </div>
              )}

              {/* End-to-End Traceability Chain */}
              <div className="space-y-2 bg-slate-950/60 border border-indigo-500/20 rounded-xl p-4">
                <label className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Full Requirement Traceability
                </label>
                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-400">Work Item:</span>
                    <span className="text-slate-100 font-bold">{selectedWorkItem.title}</span>
                  </div>
                  {selectedWorkItem.requirements && selectedWorkItem.requirements.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="font-semibold text-slate-400">Requirement:</span>
                      <ul className="space-y-1">
                        {selectedWorkItem.requirements.map((r) => (
                          <li key={r.id} className="text-emerald-300">
                            ✓ {r.requirementText}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {selectedWorkItem.intentTitle && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-400">Confirmed Intent:</span>
                      <span className="text-indigo-300 font-medium">{selectedWorkItem.intentTitle}</span>
                    </div>
                  )}
                  {selectedWorkItem.sourceMessageId && onSelectMessage && (
                    <div className="pt-1">
                      <button
                        onClick={() => {
                          onSelectMessage(selectedWorkItem.sourceMessageId!);
                          setSelectedWorkItem(null);
                        }}
                        className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs px-2.5 py-1 rounded font-semibold transition flex items-center gap-1.5"
                      >
                        🔗 View Original Client Message
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Execution Activity Timeline */}
              <div className="space-y-2 border-t border-slate-800 pt-3">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Audit Activity Timeline
                </label>
                {loadingDetail ? (
                  <p className="text-xs text-slate-500">Loading timeline...</p>
                ) : selectedActivities.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No activity recorded yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {selectedActivities.map((act) => (
                      <li
                        key={act.id}
                        className="flex items-center justify-between text-xs bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/40"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200">{act.actorName}</span>
                          <span className="text-slate-400">
                            {act.type === 'created' && 'created work item'}
                            {act.type === 'assigned' && 'assigned work item'}
                            {act.type === 'status_changed' && `changed status to ${act.metadata?.to}`}
                            {act.type === 'completed' && 'marked work item as COMPLETED'}
                            {act.type === 'blocked' && 'marked work item as BLOCKED'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="border-t border-slate-800 pt-3 flex items-center justify-between">
              {!isClientView ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleStatusChange(selectedWorkItem.id, 'completed')}
                    disabled={selectedWorkItem.status === 'completed'}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow transition disabled:opacity-50"
                  >
                    ✓ Complete Work
                  </button>
                  <button
                    onClick={() => handleStatusChange(selectedWorkItem.id, 'blocked')}
                    disabled={selectedWorkItem.status === 'blocked'}
                    className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                  >
                    Mark Blocked
                  </button>
                </div>
              ) : (
                <div className="text-xs text-slate-400">
                  Client View: Read-only progress monitoring
                </div>
              )}

              <button
                onClick={() => setSelectedWorkItem(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-1.5 rounded-lg border border-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-sm font-bold text-slate-100">Create Manual Work Item</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Set up production DNS record"
                  className="w-full bg-slate-950 text-slate-100 px-3 py-2 rounded border border-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Detailed task description..."
                  rows={3}
                  className="w-full bg-slate-950 text-slate-100 px-3 py-2 rounded border border-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full bg-slate-950 text-slate-100 px-2.5 py-2 rounded border border-slate-800 focus:outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Assignee</label>
                  <select
                    value={newAssignedTo}
                    onChange={(e) => setNewAssignedTo(e.target.value)}
                    className="w-full bg-slate-950 text-slate-100 px-2.5 py-2 rounded border border-slate-800 focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {projectMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateWork}
                disabled={creating || !newTitle.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow transition disabled:opacity-50"
              >
                Create Work Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
