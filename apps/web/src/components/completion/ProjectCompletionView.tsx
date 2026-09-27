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

      // Try fetching handoff if project has closure
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

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            ✅ Project Closure, Completion & Handoff
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isClient
              ? 'Review final project deliverables, approve closure request, and acknowledge project handoff.'
              : 'Verify completion criteria, submit project closure for client approval, and deliver final handoff.'}
          </p>
        </div>

        {isDeveloper && activeClosure?.status !== 'pending_client_approval' && activeClosure?.status !== 'completed' && (
          <button
            onClick={() => setIsCreatingClosure(true)}
            disabled={!eligibility?.eligible}
            className={`px-4 py-2 text-xs font-semibold rounded-lg shadow-lg transition flex items-center gap-1.5 ${
              eligibility?.eligible
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <span>+</span> Submit Project Closure
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-900/40 border border-red-500/50 rounded-lg text-xs text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-500 text-xs">Loading completion status...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Eligibility & Readiness Overview */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Completion Readiness
                </span>
                {eligibility?.eligible ? (
                  <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold rounded-full">
                    ✓ Eligible for Closure
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold rounded-full">
                    ⚠️ {eligibility?.blockers.length} Completion Blocker(s)
                  </span>
                )}
              </div>

              {/* Progress Summary Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-center">
                  <span className="block text-xl font-extrabold text-cyan-400">
                    {eligibility?.completedWorkCount} / {eligibility?.totalWorkCount}
                  </span>
                  <span className="text-[11px] text-slate-400">Completed Work</span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-center">
                  <span className="block text-xl font-extrabold text-emerald-400">
                    {eligibility?.approvedDeliverablesCount} / {eligibility?.totalDeliverablesCount}
                  </span>
                  <span className="text-[11px] text-slate-400">Approved Deliverables</span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-center sm:col-span-1 col-span-2">
                  <span className="block text-xl font-extrabold text-purple-400">
                    {activeClosure ? activeClosure.status.toUpperCase() : 'NONE'}
                  </span>
                  <span className="text-[11px] text-slate-400">Closure Status</span>
                </div>
              </div>

              {/* Blockers List */}
              {eligibility && eligibility.blockers.length > 0 && (
                <div className="pt-3 border-t border-slate-800">
                  <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block mb-2">
                    Resolution Required Before Closure:
                  </span>
                  <div className="space-y-1.5">
                    {eligibility.blockers.map((b, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-amber-950/20 border border-amber-900/40 rounded-lg text-xs text-amber-200 flex items-center justify-between"
                      >
                        <span>• {b.label}</span>
                        <span className="text-[10px] font-mono uppercase bg-amber-900/40 px-2 py-0.5 rounded text-amber-300">
                          {b.entityType}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Active Closure Request Card */}
            {activeClosure && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">Active Closure Request</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Submitted on {activeClosure.submittedAt ? new Date(activeClosure.submittedAt).toLocaleDateString() : 'Draft'}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-bold rounded-lg uppercase font-mono">
                    {activeClosure.status}
                  </span>
                </div>

                {activeClosure.summary && (
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-300">
                    <span className="font-semibold text-white block mb-1">Completion Summary:</span>
                    {activeClosure.summary}
                  </div>
                )}

                {/* Revision Requests */}
                {activeClosure.revisions && activeClosure.revisions.length > 0 && (
                  <div className="pt-2 border-t border-slate-800">
                    <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block mb-2">
                      Closure Revision Feedback:
                    </span>
                    <div className="space-y-2">
                      {activeClosure.revisions.map((rev) => (
                        <div
                          key={rev.id}
                          className="p-3 bg-amber-950/30 border border-amber-900/50 rounded-lg text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between text-amber-200">
                            <span className="font-bold">{rev.clientName || 'Client'}</span>
                            <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-amber-900/50 rounded">
                              {rev.status}
                            </span>
                          </div>
                          <p className="text-slate-300 text-xs">{rev.description}</p>
                          {isDeveloper && rev.status !== 'resolved' && (
                            <button
                              onClick={() => handleResolveRevision(rev.id)}
                              className="mt-1 text-[11px] font-bold text-emerald-400 hover:underline block"
                            >
                              ✓ Mark Revision Resolved
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Client Review Action Button */}
                {isClient && activeClosure.status === 'pending_client_approval' && (
                  <div className="pt-3 border-t border-slate-800 flex justify-end">
                    <button
                      onClick={() => setActiveReviewClosure(activeClosure)}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-lg transition"
                    >
                      Review & Approve / Request Changes
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Handoff View */}
            {handoff && <ProjectHandoffView handoff={handoff} isClient={isClient} onRefresh={loadData} />}
          </div>

          {/* Right Col: Completion Checklist */}
          <div className="space-y-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>📋</span> Completion Checklist
              </h3>
              <p className="text-[11px] text-slate-400">
                Track formal completion requirements before sign-off.
              </p>

              <div className="space-y-2 pt-2">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => isDeveloper && item.key !== 'client_approved' && handleToggleChecklist(item.id, item.status)}
                    className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 transition ${
                      isDeveloper && item.key !== 'client_approved' ? 'cursor-pointer hover:border-slate-600' : ''
                    } ${
                      item.status === 'completed'
                        ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    <span className="text-base mt-0.5">
                      {item.status === 'completed' ? '✅' : '○'}
                    </span>
                    <div className="flex-1">
                      <span className={`font-medium block ${item.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-200'}`}>
                        {item.label}
                      </span>
                      {item.completedByName && (
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          Done by {item.completedByName}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Developer Closure Modal */}
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

      {/* Client Review Modal */}
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
