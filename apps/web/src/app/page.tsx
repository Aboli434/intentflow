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
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-50 text-slate-900 selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-6">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-indigo-600">
              IntentFlow Platform
            </h1>
            <p className="text-xs text-slate-500 mt-1">Web & mobile collaboration platform for clients and developers.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/login" className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-all">
              Sign In
            </Link>
            <Link href="/signup" className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-sm transition-all">
              Get Started
            </Link>
          </div>
        </div>

        {/* Status Box */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700">PostgreSQL API Status</span>
          {healthState.status === 'connected' && (
            <span className="text-xs font-mono text-emerald-600 font-bold">Connected ({healthState.data?.database})</span>
          )}
          {healthState.status === 'unavailable' && (
            <span className="text-xs font-mono text-rose-600 font-bold">Unavailable</span>
          )}
          {healthState.status === 'loading' && (
            <span className="text-xs font-mono text-amber-600 animate-pulse">Checking...</span>
          )}
        </div>

        <div className="pt-2 text-center">
          <Link href="/dashboard" className="inline-block px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-bold text-white shadow-md transition-all">
            Go to Workspace Dashboard →
          </Link>
        </div>
      </div>
    </main>
  );
}
