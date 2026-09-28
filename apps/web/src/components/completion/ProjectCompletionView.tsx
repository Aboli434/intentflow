'use client';

import React, { useEffect, useState } from 'react';
import {
  ProjectClosure,
  ProjectCompletionChecklist,
  ProjectCompletionEligibility,
  ProjectHandoff,
} from '@intentflow/types';
import {
  apiGetProjectCompletionStatus,
  apiGetProjectCompletionChecklist,
  apiGetProjectClosures,
  apiUpdateChecklistItemStatus,
  apiGetProjectHandoff,
  apiUpdateClosureRevisionStatus,
} from '../../lib/api-client';
import { ClosureEditor } from './ClosureEditor';
import { ClientClosureReview } from './ClientClosureReview';
import { ProjectHandoffView } from './ProjectHandoffView';

interface ProjectCompletionViewProps {
  projectId: string;
  isClient: boolean;
  isDeveloper: boolean;
}

export function ProjectCompletionView({
  projectId,
  isClient,
  isDeveloper,
}: ProjectCompletionViewProps) {
  const [eligibility, setEligibility] = useState<ProjectCompletionEligibility | null>(null);
  const [checklist, setChecklist] = useState<ProjectCompletionChecklist[]>([]);
  const [closures, setClosures] = useState<ProjectClosure[]>([]);
  const [handoff, setHandoff] = useState<ProjectHandoff | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreatingClosure, setIsCreatingClosure] = useState(false);
  const [activeReviewClosure, setActiveReviewClosure] = useState<ProjectClosure | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [eligRes, chkRes, closuresRes] = await Promise.all([
        apiGetProjectCompletionStatus(projectId),
        apiGetProjectCompletionChecklist(projectId),
        apiGetProjectClosures(projectId),
      ]);
      setEligibility(eligRes);
      setChecklist(chkRes);
      setClosures(closuresRes);

      try {
        const hRes = await apiGetProjectHandoff(projectId);
        setHandoff(hRes);
      } catch {
        setHandoff(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load completion status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const handleToggleChecklist = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
      await apiUpdateChecklistItemStatus(id, newStatus);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update checklist item');
    }
  };

  const handleResolveRevision = async (revisionId: string) => {
    try {
      await apiUpdateClosureRevisionStatus(revisionId, 'resolved');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to resolve closure revision');
    }
  };

  const activeClosure = closures.length > 0 ? closures[0] : null;

  const completionPct = eligibility
    ? eligibility.totalWorkCount > 0
      ? Math.round((eligibility.completedWorkCount / eligibility.totalWorkCount) * 100)
      : eligibility.eligible
      ? 100
      : 0
    : 0;

  return (
    <div className="space-y-6 text-[#F8FAFC]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111827] border border-[#1F2937] rounded-2xl p-5 shadow-md">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-[#F8FAFC] tracking-tight flex items-center gap-2">
            ✅ Project Completion, Closure & Handoff
          </h2>
          <p className="text-xs text-[#94A3B8] mt-1 max-w-xl leading-relaxed font-medium">
            {isClient
              ? 'Review final project deliverables, approve closure request, and acknowledge project handoff.'
              : 'Verify completion criteria, submit project closure for client approval, and deliver final handoff.'}
          </p>
        </div>

        {isDeveloper && activeClosure?.status !== 'pending_client_approval' && activeClosure?.status !== 'completed' && (
          <button
            onClick={() => setIsCreatingClosure(true)}
            disabled={!eligibility?.eligible}
            className={`px-4 py-2.5 text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 shrink-0 min-h-[40px] cursor-pointer ${
              eligibility?.eligible
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-[#151D2E] text-[#64748B] cursor-not-allowed border border-[#1F2937]'
            }`}
          >
            <span>+</span> Submit Project Closure
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs font-semibold text-rose-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-[#94A3B8] text-xs font-medium animate-pulse">Loading completion status...</div>
      ) : (
        <div className="space-y-6">
          {/* SECTION 1: Completion Readiness */}
          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-5 space-y-4 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1F2937] pb-3.5">
              <div>
                <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest block">
                  Section 1
                </span>
                <h3 className="text-sm sm:text-base font-extrabold text-[#F8FAFC]">Completion Readiness ({completionPct}% Ready)</h3>
              </div>

              {eligibility?.eligible ? (
                <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold rounded-full self-start sm:self-auto">
                  ✓ Eligible for Closure
                </span>
              ) : (
                <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold rounded-full self-start sm:self-auto">
                  ⚠️ {eligibility?.blockers.length} Completion Blocker(s)
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3.5 bg-[#0B0F19]/60 border border-[#1F2937] rounded-xl text-center">
                <span className="block text-xl font-extrabold text-cyan-400">
                  {eligibility?.completedWorkCount} / {eligibility?.totalWorkCount}
                </span>
                <span className="text-[11px] text-[#94A3B8] font-mono font-semibold">Completed Work</span>
              </div>
              <div className="p-3.5 bg-[#0B0F19]/60 border border-[#1F2937] rounded-xl text-center">
                <span className="block text-xl font-extrabold text-emerald-400">
                  {eligibility?.approvedDeliverablesCount} / {eligibility?.totalDeliverablesCount}
                </span>
                <span className="text-[11px] text-[#94A3B8] font-mono font-semibold">Approved Deliverables</span>
              </div>
              <div className="p-3.5 bg-[#0B0F19]/60 border border-[#1F2937] rounded-xl text-center col-span-2 sm:col-span-1">
                <span className="block text-xl font-extrabold text-purple-400 font-mono uppercase">
                  {activeClosure ? activeClosure.status.replace(/_/g, ' ') : 'NONE'}
                </span>
                <span className="text-[11px] text-[#94A3B8] font-mono font-semibold">Closure Status</span>
              </div>
            </div>

            {eligibility && eligibility.blockers.length > 0 && (
              <div className="pt-2 border-t border-[#1F2937] space-y-2">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                  Blockers to Resolve Before Closure:
                </span>
                <div className="space-y-1.5">
                  {eligibility.blockers.map((b, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 font-medium flex items-center justify-between"
                    >
                      <span>• {b.label}</span>
                      <span className="text-[10px] font-mono uppercase bg-amber-500/20 px-2 py-0.5 rounded text-amber-400 font-bold border border-amber-500/30">
                        {b.entityType}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SECTION 2: Completion Checklist */}
            <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-5 space-y-4 shadow-md">
              <div className="border-b border-[#1F2937] pb-3">
                <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest block">
                  Section 2
                </span>
                <h3 className="text-sm sm:text-base font-extrabold text-[#F8FAFC] flex items-center gap-1.5">
                  <span>📋</span> Completion Checklist
                </h3>
              </div>

              <div className="space-y-2">
                {checklist.map((item) => {
                  const isChecked = item.status === 'completed';
                  return (
                    <div
                      key={item.id}
                      onClick={() => isDeveloper && item.key !== 'client_approved' && handleToggleChecklist(item.id, item.status)}
                      className={`p-3.5 rounded-xl border text-xs flex items-center gap-3 transition min-h-[44px] ${
                        isDeveloper && item.key !== 'client_approved' ? 'cursor-pointer hover:border-indigo-500/50' : ''
                      } ${
                        isChecked
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-[#0B0F19]/60 border-[#1F2937] text-[#94A3B8]'
                      }`}
                    >
                      <span className="text-base font-bold shrink-0">
                        {isChecked ? '✓' : '○'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className={`font-semibold block truncate ${isChecked ? 'line-through text-[#64748B]' : 'text-[#F8FAFC]'}`}>
                          {item.label}
                        </span>
                        {item.completedByName && (
                          <span className="text-[10px] text-[#94A3B8] font-mono block mt-0.5 font-medium">
                            Done by {item.completedByName}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SECTION 3: Client Review */}
            <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-5 space-y-4 shadow-md">
              <div className="border-b border-[#1F2937] pb-3">
                <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest block">
                  Section 3
                </span>
                <h3 className="text-sm sm:text-base font-extrabold text-[#F8FAFC] flex items-center gap-1.5">
                  <span>🔍</span> Client Closure Review
                </h3>
              </div>

              {!activeClosure ? (
                <div className="p-6 text-center text-xs text-[#94A3B8] space-y-1 bg-[#0B0F19]/60 rounded-xl border border-[#1F2937]">
                  <p className="font-bold text-[#F8FAFC]">No active closure request yet.</p>
                  <p className="text-[11px] text-[#94A3B8] font-medium">Developers can submit closure once completion criteria are met.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-[#F8FAFC]">Closure Request Status</h4>
                      <p className="text-[11px] text-[#94A3B8] font-mono mt-0.5">
                        Submitted {activeClosure.submittedAt ? new Date(activeClosure.submittedAt).toLocaleDateString() : 'Draft'}
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-bold rounded-full uppercase">
                      {activeClosure.status}
                    </span>
                  </div>

                  {activeClosure.summary && (
                    <div className="p-3.5 bg-[#0B0F19]/60 rounded-xl border border-[#1F2937] text-xs text-[#94A3B8] space-y-1 font-medium">
                      <span className="font-bold text-[#F8FAFC] block">Summary:</span>
                      <p className="leading-relaxed">{activeClosure.summary}</p>
                    </div>
                  )}

                  {activeClosure.revisions && activeClosure.revisions.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-[#1F2937]">
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                        Closure Revisions ({activeClosure.revisions.length}):
                      </span>
                      {activeClosure.revisions.map((rev) => (
                        <div key={rev.id} className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs space-y-1">
                          <div className="flex items-center justify-between text-amber-400 font-bold">
                            <span>{rev.clientName || 'Client'}</span>
                            <span className="text-[10px] font-mono uppercase bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                              {rev.status}
                            </span>
                          </div>
                          <p className="text-[#94A3B8] text-xs leading-snug font-medium">{rev.description}</p>
                          {isDeveloper && rev.status !== 'resolved' && (
                            <button
                              onClick={() => handleResolveRevision(rev.id)}
                              className="mt-1 text-[11px] font-bold text-emerald-400 hover:underline block min-h-[36px] cursor-pointer"
                            >
                              ✓ Mark Revision Resolved
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {isClient && activeClosure.status === 'pending_client_approval' && (
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => setActiveReviewClosure(activeClosure)}
                        className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition min-h-[40px] cursor-pointer"
                      >
                        Review & Approve / Request Changes
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 4: Handoff */}
          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-5 space-y-4 shadow-md">
            <div className="border-b border-[#1F2937] pb-3">
              <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest block">
                Section 4
              </span>
              <h3 className="text-sm sm:text-base font-extrabold text-[#F8FAFC] flex items-center gap-1.5">
                <span>📦</span> Project Handoff Package
              </h3>
            </div>

            {handoff ? (
              <ProjectHandoffView handoff={handoff} isClient={isClient} onRefresh={loadData} />
            ) : (
              <div className="p-6 text-center text-xs text-[#94A3B8] bg-[#0B0F19]/60 rounded-xl border border-[#1F2937] space-y-1 font-medium">
                <p className="font-bold text-[#F8FAFC]">Handoff Package Not Delivered Yet</p>
                <p className="text-[11px] text-[#94A3B8]">Handoff assets will be made available upon closure approval.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {isCreatingClosure && (
        <ClosureEditor
          projectId={projectId}
          onSuccess={() => {
            setIsCreatingClosure(false);
            loadData();
          }}
          onClose={() => setIsCreatingClosure(false)}
        />
      )}

      {activeReviewClosure && (
        <ClientClosureReview
          closure={activeReviewClosure}
          onSuccess={() => {
            setActiveReviewClosure(null);
            loadData();
          }}
          onClose={() => setActiveReviewClosure(null)}
        />
      )}
    </div>
  );
}

