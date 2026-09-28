'use client';

import React, { useState, useEffect } from 'react';
import { WorkItem, WorkItemStatus, WorkItemActivity, User } from '@intentflow/types';
import {
  apiGetProjectWork,
  apiCreateWorkItem,
  apiGetWorkItemDetail,
  apiUpdateWorkItemStatus,
  apiAssignWorkItem,
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
  const [workSearch, setWorkSearch] = useState<string>('');

  const filteredWorkItems = workItems.filter((w) => {
    if (!workSearch.trim()) return true;
    const q = workSearch.toLowerCase().trim();
    const assigneeName = (w as any).assignee?.name || (w as any).assignedToName || '';
    return (
      w.title.toLowerCase().includes(q) ||
      (w.description && w.description.toLowerCase().includes(q)) ||
      (assigneeName && assigneeName.toLowerCase().includes(q))
    );
  });

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
        return <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30 uppercase tracking-wider">COMPLETED</span>;
      case 'in_progress':
        return <span className="bg-indigo-500/10 text-indigo-400 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border border-indigo-500/30 uppercase tracking-wider">IN PROGRESS</span>;
      case 'blocked':
        return <span className="bg-rose-500/10 text-rose-400 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border border-rose-500/30 uppercase tracking-wider">BLOCKED</span>;
      case 'in_review':
        return <span className="bg-purple-500/10 text-purple-400 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border border-purple-500/30 uppercase tracking-wider">IN REVIEW</span>;
      case 'ready':
        return <span className="bg-sky-500/10 text-sky-400 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border border-sky-500/30 uppercase tracking-wider">READY</span>;
      default:
        return <span className="bg-slate-500/10 text-slate-300 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border border-slate-500/30 uppercase tracking-wider">{status}</span>;
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

  const getProgressPercentage = (status: WorkItemStatus) => {
    if (status === 'completed') return 100;
    if (status === 'in_review') return 80;
    if (status === 'in_progress') return 60;
    if (status === 'ready') return 30;
    return 10;
  };

  return (
    <div className="space-y-6 text-[#F8FAFC]">
      {/* Top Metrics Banner */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-4 shadow-md">
            <span className="text-[10px] font-mono font-bold text-[#64748B] uppercase tracking-wider block">Total Work</span>
            <div className="text-xl sm:text-2xl font-extrabold text-[#F8FAFC] mt-1">{metrics.total}</div>
          </div>
          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-4 shadow-md">
            <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider block">In Progress</span>
            <div className="text-xl sm:text-2xl font-extrabold text-indigo-400 mt-1">{metrics.in_progress}</div>
          </div>
          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-4 shadow-md">
            <span className="text-[10px] font-mono font-bold text-rose-400 uppercase tracking-wider block">Blocked</span>
            <div className="text-xl sm:text-2xl font-extrabold text-rose-400 mt-1">{metrics.blocked}</div>
          </div>
          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-4 shadow-md">
            <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider block">Completed</span>
            <div className="text-xl sm:text-2xl font-extrabold text-emerald-400 mt-1">
              {metrics.completed} <span className="text-xs font-semibold text-[#94A3B8]">({metrics.completionRatePercentage}%)</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter Toolbar & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111827] border border-[#1F2937] rounded-2xl p-3 shadow-md">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {[
              { id: 'all', label: 'All Work' },
              { id: 'my_work', label: 'My Work' },
              { id: 'ready', label: 'Ready' },
              { id: 'in_progress', label: 'In Progress' },
              { id: 'in_review', label: 'Review' },
              { id: 'blocked', label: 'Blocked' },
              { id: 'completed', label: 'Completed' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap min-h-[36px] cursor-pointer ${
                  activeFilter === f.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#151D2E]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative w-48 sm:w-56">
            <input
              type="text"
              value={workSearch}
              onChange={(e) => setWorkSearch(e.target.value)}
              placeholder="Search work..."
              className="w-full rounded-xl border border-[#1F2937] bg-[#0B0F19] pl-3 pr-7 py-1.5 text-xs text-[#F8FAFC] placeholder:text-[#64748B] focus:border-indigo-500 focus:outline-none"
            />
            {workSearch && (
              <button
                onClick={() => setWorkSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8] hover:text-[#F8FAFC]"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {!isClientView && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md transition flex items-center gap-1.5 min-h-[40px] cursor-pointer"
          >
            + Create Work Item
          </button>
        )}
      </div>

      {/* Work Item List / Cards */}
      {loading ? (
        <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-8 text-center text-[#94A3B8] space-y-3 animate-pulse shadow-md">
          <div className="h-5 bg-[#1F2937] rounded w-1/3 mx-auto"></div>
          <div className="h-4 bg-[#1F2937] rounded w-1/2 mx-auto"></div>
        </div>
      ) : error ? (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold p-4 rounded-2xl shadow-md">
          {error}
        </div>
      ) : filteredWorkItems.length === 0 ? (
        <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-10 text-center text-[#94A3B8] space-y-3 shadow-md">
          <div className="w-12 h-12 mx-auto rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-xl">
            ⚡
          </div>
          <h4 className="text-sm font-bold text-[#F8FAFC]">
            {workSearch ? 'No Work Items Match Your Search' : 'No Work Items Found'}
          </h4>
          <p className="text-xs text-[#94A3B8] max-w-xs mx-auto leading-relaxed font-medium">
            {workSearch
              ? 'Try adjusting your search query or active filter.'
              : 'Work items are created when confirmed intents are converted through AI work proposals or added manually by developers.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkItems.map((item) => {
            const pct = getProgressPercentage(item.status);
            return (
              <div
                key={item.id}
                onClick={() => handleOpenDetail(item)}
                className="group rounded-2xl border border-[#1F2937] bg-[#111827] p-5 hover:border-indigo-500/50 hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between space-y-4 shadow-md"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    {statusBadge(item.status)}
                    {priorityBadge(item.priority)}
                  </div>

                  <h3 className="text-sm font-bold text-[#F8FAFC] group-hover:text-indigo-400 transition-colors line-clamp-2">
                    {item.title}
                  </h3>

                  {item.intentTitle && (
                    <p className="text-[11px] font-mono text-[#94A3B8] line-clamp-1">
                      Intent: {item.intentTitle}
                    </p>
                  )}
                </div>

                <div className="space-y-3 pt-3 border-t border-[#1F2937]">
                  <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                    <span>Assignee:</span>
                    <span className="font-bold text-[#F8FAFC] truncate max-w-[140px]">
                      {item.assigneeName || 'Unassigned'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono text-[#94A3B8]">
                      <span>Progress</span>
                      <span className="font-bold text-indigo-400">{pct}%</span>
                    </div>
                    <div className="w-full bg-[#151D2E] h-1.5 rounded-full overflow-hidden border border-[#1F2937]">
                      <div
                        className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-mono text-[#64748B]">
                      Due: {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'No deadline'}
                    </span>
                    <button className="text-xs font-bold text-indigo-400 group-hover:translate-x-0.5 transition-transform">
                      Open →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Drawer / Modal */}
      {selectedWorkItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6 max-w-2xl w-full space-y-5 max-h-[90vh] flex flex-col shadow-2xl text-[#F8FAFC]">
            <div className="flex items-start justify-between border-b border-[#1F2937] pb-3.5 gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  {statusBadge(selectedWorkItem.status)}
                  {priorityBadge(selectedWorkItem.priority)}
                </div>
                <h3 className="text-base font-extrabold text-[#F8FAFC]">{selectedWorkItem.title}</h3>
              </div>
              <button
                onClick={() => setSelectedWorkItem(null)}
                className="text-[#64748B] hover:text-[#F8FAFC] text-base font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-5 pr-1 custom-scrollbar">
              {selectedWorkItem.description && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold text-[#64748B] uppercase tracking-wider">
                    Description & Scope
                  </label>
                  <p className="text-xs text-[#94A3B8] bg-[#0B0F19]/60 p-3.5 rounded-xl border border-[#1F2937] leading-relaxed font-medium">
                    {selectedWorkItem.description}
                  </p>
                </div>
              )}

              {/* Requirement Traceability */}
              <div className="space-y-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4">
                <label className="text-[11px] font-mono font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🔗</span> Full Requirement Traceability
                </label>
                <div className="space-y-2 text-xs text-[#94A3B8]">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#64748B]">Work Item:</span>
                    <span className="text-[#F8FAFC] font-bold">{selectedWorkItem.title}</span>
                  </div>
                  {selectedWorkItem.intentTitle && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#64748B]">Confirmed Intent:</span>
                      <span className="text-indigo-400 font-bold">{selectedWorkItem.intentTitle}</span>
                    </div>
                  )}
                  {selectedWorkItem.sourceMessageId && onSelectMessage && (
                    <div className="pt-1">
                      <button
                        onClick={() => {
                          onSelectMessage(selectedWorkItem.sourceMessageId!);
                          setSelectedWorkItem(null);
                        }}
                        className="bg-indigo-600 text-white hover:bg-indigo-500 text-xs px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 shadow-md"
                      >
                        🔗 View Original Client Message
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Activity Audit Timeline */}
              <div className="space-y-2 border-t border-[#1F2937] pt-3">
                <label className="text-[10px] font-mono font-bold text-[#64748B] uppercase tracking-wider">
                  Audit Activity Timeline
                </label>
                {loadingDetail ? (
                  <p className="text-xs text-[#94A3B8] font-medium animate-pulse">Loading timeline...</p>
                ) : selectedActivities.length === 0 ? (
                  <p className="text-xs text-[#64748B] italic">No activity recorded yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {selectedActivities.map((act) => (
                      <li
                        key={act.id}
                        className="flex items-center justify-between text-xs bg-[#0B0F19]/60 p-3 rounded-xl border border-[#1F2937]"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#F8FAFC]">{act.actorName}</span>
                          <span className="text-[#94A3B8] font-medium">
                            {act.type === 'created' && 'created work item'}
                            {act.type === 'assigned' && 'assigned work item'}
                            {act.type === 'status_changed' && `changed status to ${act.metadata?.to}`}
                            {act.type === 'completed' && 'marked COMPLETED'}
                            {act.type === 'blocked' && 'marked BLOCKED'}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-[#64748B]">
                          {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="border-t border-[#1F2937] pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              {!isClientView ? (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => handleStatusChange(selectedWorkItem.id, 'completed')}
                    disabled={selectedWorkItem.status === 'completed'}
                    className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md transition disabled:opacity-50 min-h-[40px] cursor-pointer"
                  >
                    ✓ Complete Work
                  </button>
                  <button
                    onClick={() => handleStatusChange(selectedWorkItem.id, 'blocked')}
                    disabled={selectedWorkItem.status === 'blocked'}
                    className="flex-1 sm:flex-initial bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold px-4 py-2 rounded-xl transition min-h-[40px] cursor-pointer"
                  >
                    Mark Blocked
                  </button>
                </div>
              ) : (
                <div className="text-xs text-[#94A3B8] font-medium">
                  Client View: Read-only execution monitoring
                </div>
              )}

              <button
                onClick={() => setSelectedWorkItem(null)}
                className="w-full sm:w-auto bg-[#151D2E] hover:bg-[#1F2937] text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-bold px-5 py-2 rounded-xl border border-[#1F2937] min-h-[40px] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl text-[#F8FAFC]">
            <h3 className="text-sm font-extrabold text-[#F8FAFC]">Create Manual Work Item</h3>
            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#94A3B8] font-semibold mb-1">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Production DNS Record Setup"
                  className="w-full bg-[#0B0F19] text-[#F8FAFC] px-3.5 py-2.5 rounded-xl border border-[#1F2937] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-[#94A3B8] font-semibold mb-1">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Detailed task instructions..."
                  rows={3}
                  className="w-full bg-[#0B0F19] text-[#F8FAFC] px-3.5 py-2.5 rounded-xl border border-[#1F2937] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94A3B8] font-semibold mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full bg-[#0B0F19] text-[#F8FAFC] px-3 py-2 rounded-xl border border-[#1F2937] focus:outline-none focus:border-indigo-500 min-h-[44px] cursor-pointer"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#94A3B8] font-semibold mb-1">Assignee</label>
                  <select
                    value={newAssignedTo}
                    onChange={(e) => setNewAssignedTo(e.target.value)}
                    className="w-full bg-[#0B0F19] text-[#F8FAFC] px-3 py-2 rounded-xl border border-[#1F2937] focus:outline-none focus:border-indigo-500 min-h-[44px] cursor-pointer"
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

            <div className="flex items-center justify-end gap-2 border-t border-[#1F2937] pt-3.5">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-xs font-semibold text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#151D2E] px-4 py-2 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateWork}
                disabled={creating || !newTitle.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md transition disabled:opacity-50 min-h-[40px] cursor-pointer"
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

