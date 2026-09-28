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
    <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-5 space-y-4 shadow-md text-[#F8FAFC]">
      <div className="flex items-center justify-between border-b border-[#1F2937] pb-3">
        <div>
          <h3 className="text-base font-extrabold text-[#F8FAFC] flex items-center gap-2">
            📦 Final Project Handoff Package
          </h3>
          <p className="text-xs text-[#94A3B8] font-medium mt-0.5">
            Delivered on {handoff.deliveredAt ? new Date(handoff.deliveredAt).toLocaleDateString() : 'Date'}
          </p>
        </div>

        <span
          className={`px-3 py-1 text-xs font-bold rounded-lg uppercase font-mono border ${
            isAcknowledged
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
          }`}
        >
          {handoff.handoffStatus}
        </span>
      </div>

      {handoff.summary && (
        <div className="p-3 bg-[#0B0F19]/60 rounded-xl border border-[#1F2937] text-xs text-[#94A3B8] font-medium">
          <span className="font-bold text-[#F8FAFC] block mb-1">Handoff Overview:</span>
          {handoff.summary}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-[#0B0F19]/60 border border-[#1F2937] rounded-xl text-center">
          <span className="block text-lg font-extrabold text-cyan-400">
            {handoff.approvedDeliverablesCount}
          </span>
          <span className="text-[10px] text-[#94A3B8] font-mono font-semibold">Approved Deliverables</span>
        </div>
        <div className="p-3 bg-[#0B0F19]/60 border border-[#1F2937] rounded-xl text-center">
          <span className="block text-lg font-extrabold text-emerald-400">
            {handoff.completedWorkCount}
          </span>
          <span className="text-[10px] text-[#94A3B8] font-mono font-semibold">Completed Items</span>
        </div>
        <div className="p-3 bg-[#0B0F19]/60 border border-[#1F2937] rounded-xl text-center">
          <span className="block text-lg font-extrabold text-purple-400">
            {handoff.items?.length || 0}
          </span>
          <span className="text-[10px] text-[#94A3B8] font-mono font-semibold">Handoff Items</span>
        </div>
      </div>

      {/* Handoff Items List */}
      {handoff.items && handoff.items.length > 0 && (
        <div className="space-y-2 pt-2">
          <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider block">
            Handoff Deliverables & Files:
          </span>
          <div className="space-y-1.5">
            {handoff.items.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-[#0B0F19]/60 border border-[#1F2937] rounded-xl text-xs flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-[#F8FAFC] block">{item.title}</span>
                  {item.description && (
                    <span className="text-[11px] text-[#94A3B8] block mt-0.5 font-medium">
                      {item.description}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono uppercase bg-[#151D2E] border border-[#1F2937] text-[#94A3B8] px-2 py-0.5 rounded font-bold">
                  {item.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer / Acknowledge Action */}
      <div className="pt-3 border-t border-[#1F2937] flex items-center justify-between">
        {isAcknowledged ? (
          <span className="text-xs text-emerald-400 font-bold flex items-center gap-1 font-mono">
            ✓ Handoff Acknowledged by {handoff.acknowledgedByName || 'Client'} on{' '}
            {handoff.acknowledgedAt ? new Date(handoff.acknowledgedAt).toLocaleDateString() : ''}
          </span>
        ) : isClient ? (
          <button
            onClick={handleAcknowledge}
            disabled={loading}
            className="ml-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
          >
            {loading ? 'Acknowledging...' : 'Acknowledge Handoff'}
          </button>
        ) : (
          <span className="text-xs text-[#94A3B8] italic font-medium">
            Awaiting client handoff acknowledgement.
          </span>
        )}
      </div>
    </div>
  );
}

