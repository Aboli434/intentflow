'use client';

import React, { useState } from 'react';
import { ProjectHandoff } from '@intentflow/types';
import { apiAcknowledgeProjectHandoff } from '../../lib/api-client';

interface ProjectHandoffViewProps {
  handoff: ProjectHandoff;
  isClient: boolean;
  onRefresh: () => void;
}

export function ProjectHandoffView({ handoff, isClient, onRefresh }: ProjectHandoffViewProps) {
  const [loading, setLoading] = useState(false);

  const handleAcknowledge = async () => {
    setLoading(true);
    try {
      await apiAcknowledgeProjectHandoff(handoff.id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to acknowledge handoff');
    } finally {
      setLoading(false);
    }
  };

  const isAcknowledged = handoff.handoffStatus === 'acknowledged';

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            📦 Final Project Handoff Package
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Delivered on {handoff.deliveredAt ? new Date(handoff.deliveredAt).toLocaleDateString() : 'Date'}
          </p>
        </div>

        <span
          className={`px-3 py-1 text-xs font-bold rounded-lg uppercase font-mono border ${
            isAcknowledged
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              : 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
          }`}
        >
          {handoff.handoffStatus}
        </span>
      </div>

      {handoff.summary && (
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-300">
          <span className="font-semibold text-white block mb-1">Handoff Overview:</span>
          {handoff.summary}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-center">
          <span className="block text-lg font-bold text-cyan-400">
            {handoff.approvedDeliverablesCount}
          </span>
          <span className="text-[10px] text-slate-400">Approved Deliverables</span>
        </div>
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-center">
          <span className="block text-lg font-bold text-emerald-400">
            {handoff.completedWorkCount}
          </span>
          <span className="text-[10px] text-slate-400">Completed Items</span>
        </div>
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-center">
          <span className="block text-lg font-bold text-purple-400">
            {handoff.items?.length || 0}
          </span>
          <span className="text-[10px] text-slate-400">Handoff Items</span>
        </div>
      </div>

      {/* Handoff Items List */}
      {handoff.items && handoff.items.length > 0 && (
        <div className="space-y-2 pt-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Handoff Deliverables & Files:
          </span>
          <div className="space-y-1.5">
            {handoff.items.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg text-xs flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-white block">{item.title}</span>
                  {item.description && (
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {item.description}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono uppercase bg-slate-900 border border-slate-700 text-slate-300 px-2 py-0.5 rounded">
                  {item.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer / Acknowledge Action */}
      <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
        {isAcknowledged ? (
          <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
            ✓ Handoff Acknowledged by {handoff.acknowledgedByName || 'Client'} on{' '}
            {handoff.acknowledgedAt ? new Date(handoff.acknowledgedAt).toLocaleDateString() : ''}
          </span>
        ) : isClient ? (
          <button
            onClick={handleAcknowledge}
            disabled={loading}
            className="ml-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-lg transition"
          >
            {loading ? 'Acknowledging...' : 'Acknowledge Handoff'}
          </button>
        ) : (
          <span className="text-xs text-slate-500 italic">
            Awaiting client handoff acknowledgement.
          </span>
        )}
      </div>
    </div>
  );
}
