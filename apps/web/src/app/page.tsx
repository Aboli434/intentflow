'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchHealth } from '@/lib/api-client';
import { HealthStatus } from '@intentflow/types';

export default function Home() {
  const [healthState, setHealthState] = useState<{
    status: 'loading' | 'connected' | 'unavailable';
    data?: HealthStatus;
    error?: string;
  }>({ status: 'loading' });

  const checkConnectivity = async () => {
    setHealthState({ status: 'loading' });
    try {
      const data = await fetchHealth();
      setHealthState({ status: 'connected', data });
    } catch (err) {
      setHealthState({
        status: 'unavailable',
        error: err instanceof Error ? err.message : 'API unavailable',
      });
    }
  };

  useEffect(() => {
    checkConnectivity();
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-950 text-slate-100">
      <div className="w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div>
            <span className="inline-block px-2.5 py-1 text-xs font-mono font-medium rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 mb-2">
              Phase 2 — Auth, Orgs & Projects
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              IntentFlow Platform
            </h1>
          </div>
          <div className="flex gap-2">
            <Link href="/login" className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white">
              Sign In
            </Link>
            <Link href="/signup" className="px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white">
              Get Started
            </Link>
          </div>
        </div>

        {/* Status Box */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-300">PostgreSQL API Status</span>
          {healthState.status === 'connected' && (
            <span className="text-xs font-mono text-emerald-400 font-bold">Connected ({healthState.data?.database})</span>
          )}
          {healthState.status === 'unavailable' && (
            <span className="text-xs font-mono text-rose-400 font-bold">Unavailable</span>
          )}
          {healthState.status === 'loading' && (
            <span className="text-xs font-mono text-amber-400 animate-pulse">Checking...</span>
          )}
        </div>

        <div className="pt-2 text-center">
          <Link href="/dashboard" className="inline-block px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-sm font-semibold text-white">
            Go to Workspace Dashboard →
          </Link>
        </div>
      </div>
    </main>
  );
}
